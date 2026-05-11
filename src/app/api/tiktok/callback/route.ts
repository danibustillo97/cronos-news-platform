import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getCodeVerifier } from '../auth/route';

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

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    if (!clientKey || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'TikTok credentials not configured' },
        { status: 500 }
      );
    }

    // Get code verifier from state (PKCE)
    const codeVerifier = state ? getCodeVerifier(state) : null;
    
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
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to store TikTok credentials' },
        { status: 500 }
      );
    }

    // Redirect back to studio with success
    return NextResponse.redirect(new URL('/admin?view=social&tiktok=connected', request.url));
    
  } catch (error) {
    console.error('TikTok callback error:', error);
    return NextResponse.json(
      { error: 'Failed to complete TikTok authentication' },
      { status: 500 }
    );
  }
}
