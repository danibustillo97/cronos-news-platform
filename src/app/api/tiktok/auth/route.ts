import { NextRequest, NextResponse } from 'next/server';

/**
 * TikTok OAuth Initiation
 * Redirects user to TikTok authorization page
 */
export async function GET(request: NextRequest) {
  try {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;
    
    if (!clientKey || !redirectUri) {
      return NextResponse.json(
        { error: 'TikTok credentials not configured' },
        { status: 500 }
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
      state 
    });
    
  } catch (error) {
    console.error('TikTok auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate TikTok authentication' },
      { status: 500 }
    );
  }
}
