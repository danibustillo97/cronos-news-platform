import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Debug endpoint to verify TikTok configuration
 * Returns safe information about the configuration without exposing secrets
 */
export async function GET() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  const isDemoMode = process.env.TIKTOK_DEMO_MODE === 'true';
  
  // Check each credential with detailed info
  const checks = {
    clientKey: {
      exists: !!clientKey,
      length: clientKey?.length || 0,
      valid: clientKey ? clientKey.length >= 20 : false,
      masked: clientKey ? `${clientKey.substring(0, 4)}...${clientKey.substring(clientKey.length - 4)}` : null,
      // Show first few chars to verify it's the right format
      preview: clientKey ? `${clientKey.substring(0, 10)}...` : null,
      hasSpaces: clientKey ? clientKey.includes(' ') : false,
      hasQuotes: clientKey ? clientKey.includes('"') || clientKey.includes("'") : false,
    },
    clientSecret: {
      exists: !!clientSecret,
      length: clientSecret?.length || 0,
      valid: clientSecret ? clientSecret.length >= 20 : false,
      masked: clientSecret ? `${clientSecret.substring(0, 4)}...${clientSecret.substring(clientSecret.length - 4)}` : null,
    },
    redirectUri: {
      exists: !!redirectUri,
      value: redirectUri,
      valid: redirectUri ? redirectUri.startsWith('https://') : false,
      isProduction: redirectUri ? !redirectUri.includes('localhost') : false,
    },
    demoMode: isDemoMode,
    // Environment info
    env: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV || 'not-set',
    }
  };
  
  const allValid = checks.clientKey.valid && checks.clientSecret.valid && checks.redirectUri.valid;
  
  // Generate what the auth URL would look like
  let sampleAuthUrl = null;
  if (clientKey && redirectUri) {
    const codeChallenge = crypto.randomBytes(32).toString('base64url');
    const state = crypto.randomBytes(16).toString('base64url');
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.set('client_key', clientKey.trim()); // Trim any spaces
    url.searchParams.set('redirect_uri', redirectUri.trim());
    url.searchParams.set('scope', 'video.upload,user.info.basic');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    sampleAuthUrl = url.toString();
  }
  
  return NextResponse.json({
    configured: allValid,
    checks,
    sampleAuthUrl: sampleAuthUrl ? sampleAuthUrl.substring(0, 200) + '...' : null,
    recommendations: [
      !checks.clientKey.valid && 'Client key should be ~20 chars from TikTok Developer portal',
      !checks.clientKey.valid && 'Make sure .env.local is at project root (not in src/)',
      !checks.clientKey.valid && 'Restart Next.js dev server after adding env vars',
      checks.clientKey.hasSpaces && 'Client key has spaces - remove them from .env.local',
      checks.clientKey.hasQuotes && 'Client key has quotes - remove quotes from .env.local',
      !checks.clientSecret.valid && 'Client secret should be from TikTok Developer portal', 
      !checks.redirectUri.valid && 'Redirect URI must use https://',
      checks.redirectUri.value?.includes('localhost') && 'Production apps cannot use localhost redirect URIs',
      'Ensure the redirect URI is registered in your TikTok app settings',
      'Your TikTok app must be approved for production use',
    ].filter(Boolean),
    tips: [
      'Format correcto de .env.local:',
      'TIKTOK_CLIENT_KEY=awxxxxxxxxxxxxxxxx (sin comillas, sin espacios)',
      'TIKTOK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxx (sin comillas, sin espacios)',
      'TIKTOK_REDIRECT_URI=https://tudominio.com/api/tiktok/callback',
    ],
  });
}
