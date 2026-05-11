import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Simple in-memory store for code verifiers (in production, use Redis or database)
const codeVerifierStore = new Map<string, { verifier: string; expires: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of codeVerifierStore.entries()) {
    if (value.expires < now) {
      codeVerifierStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

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
    // Trim values to remove accidental spaces or quotes
    const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim().replace(/^["']|["']$/g, '');
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim().replace(/^["']|["']$/g, '');
    const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim().replace(/^["']|["']$/g, '');
    const isDemoMode = process.env.TIKTOK_DEMO_MODE === 'true';
    
    console.log('[TikTok Auth] Checking credentials:', {
      hasClientKey: !!clientKey,
      clientKeyLength: clientKey?.length,
      hasRedirectUri: !!redirectUri,
      hasClientSecret: !!clientSecret,
    });
    
    // Check if credentials are configured
    if (!clientKey || !redirectUri || !clientSecret) {
      const missing = {
        clientKey: !clientKey,
        clientSecret: !clientSecret,
        redirectUri: !redirectUri,
      };
      
      console.log('[TikTok Auth] Missing credentials:', missing);
      
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

    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = generatePKCE();
    
    // Generate random state for CSRF protection
    const state = crypto.randomBytes(16).toString('base64url');
    
    // Store code verifier (expires in 10 minutes)
    codeVerifierStore.set(state, { 
      verifier: codeVerifier, 
      expires: Date.now() + 10 * 60 * 1000 
    });
    
    // Validate client key format (TikTok keys are typically alphanumeric, starting with letters)
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
    
    // TikTok OAuth URL with PKCE
    // Note: TikTok requires exact format
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    
    // Use set() instead of append() to avoid duplicates
    authUrl.searchParams.set('client_key', clientKey);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'video.upload,user.info.basic');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    const finalUrl = authUrl.toString();
    
    // Debug logging
    console.log('[TikTok Auth] Generated URL:', finalUrl);
    console.log('[TikTok Auth] Client key:', clientKey.substring(0, 10) + '... (length: ' + clientKey.length + ')');
    console.log('[TikTok Auth] Redirect URI:', redirectUri);
    console.log('[TikTok Auth] Code challenge:', codeChallenge.substring(0, 20) + '...');

    // Return the auth URL (frontend will redirect)
    return NextResponse.json({ 
      authUrl: finalUrl,
      state,
      demoMode: false,
      debug: {
        clientKeyLength: clientKey.length,
        clientKeyValid,
        redirectUri: redirectUri,
        hasCodeChallenge: !!codeChallenge,
        fullUrl: finalUrl, // So frontend can verify
      }
    });
    
  } catch (error) {
    console.error('TikTok auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate TikTok authentication', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get code verifier for a state (used by callback)
 */
export function getCodeVerifier(state: string): string | null {
  const stored = codeVerifierStore.get(state);
  if (!stored || stored.expires < Date.now()) {
    return null;
  }
  // Delete after use (one-time use)
  codeVerifierStore.delete(state);
  return stored.verifier;
}
