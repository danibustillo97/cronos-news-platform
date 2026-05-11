import { NextRequest, NextResponse } from 'next/server';

/**
 * TikTok OAuth Initiation
 * Redirects user to TikTok authorization page
 */
export async function GET(request: NextRequest) {
  try {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;
    const isDemoMode = process.env.TIKTOK_DEMO_MODE === 'true';
    
    // Check if credentials are configured
    if (!clientKey || !redirectUri) {
      // Return demo mode info if enabled
      if (isDemoMode) {
        return NextResponse.json({
          demoMode: true,
          authUrl: null,
          message: 'TikTok credentials not configured. Using demo mode.',
          setupInstructions: {
            step1: 'Create app at https://developers.tiktok.com/',
            step2: 'Add to .env.local: TIKTOK_CLIENT_KEY=xxx TIKTOK_CLIENT_SECRET=xxx',
            step3: 'Set redirect URI in TikTok app settings',
          }
        });
      }
      
      return NextResponse.json(
        { 
          error: 'TikTok credentials not configured',
          missing: {
            clientKey: !clientKey,
            redirectUri: !redirectUri,
          },
          setupInstructions: 'Add TIKTOK_CLIENT_KEY and TIKTOK_REDIRECT_URI to your .env.local file'
        },
        { status: 503 }
      );
    }

    // Generate random state for CSRF protection
    const state = Buffer.from(Math.random().toString()).toString('base64');
    
    // TikTok OAuth URL
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.append('client_key', clientKey);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', 'video.upload,user.info.basic');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);

    // Return the auth URL (frontend will redirect)
    return NextResponse.json({ 
      authUrl: authUrl.toString(),
      state,
      demoMode: false,
    });
    
  } catch (error) {
    console.error('TikTok auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate TikTok authentication', details: String(error) },
      { status: 500 }
    );
  }
}
