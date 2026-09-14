import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { extractCodeVerifier } from '../auth/route';

/**
 * TikTok OAuth Callback
 * Exchanges code for access token and stores in database
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.json(
        { error: `TikTok authorization failed: ${error}` },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: 'No authorization code received' },
        { status: 400 }
      );
    }

    // Trim values to remove accidental spaces or quotes
    const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim().replace(/^["']|["']$/g, '');
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim().replace(/^["']|["']$/g, '');
    const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim().replace(/^["']|["']$/g, '');

    if (!clientKey || !clientSecret || !redirectUri) {
      console.error('[TikTok Callback] Missing credentials:', { clientKey: !!clientKey, clientSecret: !!clientSecret, redirectUri: !!redirectUri });
      return NextResponse.json(
        { error: 'TikTok credentials not configured' },
        { status: 500 }
      );
    }

    // Extract code verifier from state (PKCE)
    const codeVerifier = state ? extractCodeVerifier(state) : null;
    
    if (!codeVerifier) {
      return NextResponse.json(
        { error: 'Invalid or expired session. Please try connecting again.' },
        { status: 400 }
      );
    }

    // Exchange code for access token with PKCE
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('TikTok token error:', errorData);
      return NextResponse.json(
        { error: 'Failed to exchange code for token' },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    let userInfo = null;
    if (userResponse.ok) {
      userInfo = await userResponse.json();
    }

    // Store tokens in Supabase (in a real app, encrypt these)
    const { error: dbError } = await supabase
      .from('tiktok_accounts')
      .upsert({
        open_id: tokenData.open_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        created_at: new Date().toISOString(),
        user_info: userInfo?.data?.user || null,
      }, {
        onConflict: 'open_id'
      });

    if (dbError) {
      console.error('Database error details:', dbError);
      return NextResponse.json(
        { 
          error: 'Failed to store TikTok credentials',
          details: dbError.message,
          code: dbError.code
        },
        { status: 500 }
      );
    }

    // Return HTML that closes popup and notifies parent window
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>TikTok Connected</title>
  <style>
    body { 
      font-family: system-ui, sans-serif; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      height: 100vh; 
      margin: 0;
      background: #000;
      color: #fff;
    }
    .container { text-align: center; }
    .success { color: #22c55e; font-size: 48px; margin-bottom: 16px; }
    h2 { margin: 0 0 8px 0; }
    p { color: #888; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">✓</div>
    <h2>¡TikTok conectado!</h2>
    <p>Puedes cerrar esta ventana</p>
  </div>
  <script>
    // Try to close this popup window
    if (window.opener) {
      // Notify parent window to reload
      window.opener.postMessage({ type: 'TIKTOK_CONNECTED' }, '*');
    }
    // Close after 2 seconds
    setTimeout(() => {
      window.close();
    }, 2000);
  </script>
</body>
</html>`;
    
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
    
  } catch (error) {
    console.error('TikTok callback error:', error);
    return NextResponse.json(
      { error: 'Failed to complete TikTok authentication' },
      { status: 500 }
    );
  }
}
