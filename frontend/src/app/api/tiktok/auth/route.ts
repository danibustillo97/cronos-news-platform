import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { encodeOAuthState } from '@/lib/oauthState';
import { adminAuthError, requireAdmin } from '@/lib/supabaseAuth';

// Cookie name for storing code verifier
const CODE_VERIFIER_COOKIE = 'tiktok_code_verifier';

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE() {
  // Generate random code verifier (43-128 chars)
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  
  // Generate code challenge (SHA256 of verifier, base64url encoded)
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}

/**
 * TikTok OAuth Initiation
 * Redirects user to TikTok authorization page with PKCE
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    // Trim values to remove accidental spaces or quotes
    const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim().replace(/^["']|["']$/g, '');
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim().replace(/^["']|["']$/g, '');
    const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim().replace(/^["']|["']$/g, '');
    const isDemoMode = process.env.TIKTOK_DEMO_MODE === 'true';
    
    // Check if credentials are configured
    if (!clientKey || !redirectUri || !clientSecret) {
      const missing = {
        clientKey: !clientKey,
        clientSecret: !clientSecret,
        redirectUri: !redirectUri,
      };
      
      if (isDemoMode) {
        return NextResponse.json({
          demoMode: true,
          authUrl: null,
          message: 'TikTok credentials not configured. Using demo mode.',
          missing,
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
          missing,
          setupInstructions: 'Add TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REDIRECT_URI to your .env.local file',
          fileLocation: '.env.local debe estar en la raíz del proyecto (al lado de package.json)',
          format: 'TIKTOK_CLIENT_KEY=awxxxxxxxxxxxxxxxxxx (sin comillas, sin espacios)',
        },
        { status: 503 }
      );
    }

    // Validate client key format first
    const clientKeyValid = /^[a-zA-Z0-9_-]+$/.test(clientKey);
    if (!clientKeyValid) {
      console.error('[TikTok Auth] Invalid client_key format:', clientKey.substring(0, 10) + '...');
      return NextResponse.json(
        { 
          error: 'Invalid client_key format',
          message: 'Client key contains invalid characters. It should only contain letters, numbers, hyphens and underscores.',
          clientKeyPreview: clientKey.substring(0, 10) + '...',
          clientKeyLength: clientKey.length,
        },
        { status: 400 }
      );
    }

    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = generatePKCE();
    
    // Create state that includes code_verifier (encoded) - TikTok returns this unchanged
    // Format: randomId.codeVerifierEncoded
    const unsignedState = crypto.randomBytes(32).toString('base64url');
    const signedState = encodeOAuthState({
      state: unsignedState,
      codeVerifier,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    
    const response = NextResponse.json({
      authUrl: (() => {
        const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
        authUrl.searchParams.set('client_key', clientKey);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', 'video.upload,user.info.basic');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('state', signedState);
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        return authUrl.toString();
      })(),
      state: unsignedState,
      codeChallenge: codeChallenge.substring(0, 20) + '...',
    });
    response.cookies.set('tiktok_oauth_state', signedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
    return response;
    
  } catch (error) {
    if (error instanceof Error && ('status' in error)) {
      return adminAuthError(error);
    }
    console.error('TikTok auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate TikTok authentication', details: String(error) },
      { status: 500 }
    );
  }
}
