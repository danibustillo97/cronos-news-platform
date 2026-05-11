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
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;
    const isDemoMode = process.env.TIKTOK_DEMO_MODE === 'true';
    
    // Check if credentials are configured
    if (!clientKey || !redirectUri) {
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

    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = generatePKCE();
    
    // Generate random state for CSRF protection
    const state = crypto.randomBytes(16).toString('base64url');
    
    // Store code verifier (expires in 10 minutes)
    codeVerifierStore.set(state, { 
      verifier: codeVerifier, 
      expires: Date.now() + 10 * 60 * 1000 
    });
    
    // TikTok OAuth URL with PKCE
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.append('client_key', clientKey);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', 'video.upload,user.info.basic');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

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
