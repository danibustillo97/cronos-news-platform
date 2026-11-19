import { NextRequest, NextResponse } from 'next/server';
import { adminAuthError, requireAdmin } from '@/lib/supabaseAuth';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (error) {
    return adminAuthError(error);
  }

  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  let redirectValid = false;
  if (redirectUri) {
    try {
      const url = new URL(redirectUri);
      redirectValid = url.protocol === 'https:' && url.pathname === '/api/tiktok/callback';
    } catch {
      redirectValid = false;
    }
  }

  return NextResponse.json({
    configured: Boolean(
      process.env.TIKTOK_CLIENT_KEY
      && process.env.TIKTOK_CLIENT_SECRET
      && redirectValid
      && process.env.OAUTH_STATE_SECRET
      && process.env.OAUTH_TOKEN_ENCRYPTION_KEY
    ),
    checks: {
      clientKey: Boolean(process.env.TIKTOK_CLIENT_KEY),
      clientSecret: Boolean(process.env.TIKTOK_CLIENT_SECRET),
      redirectUri: redirectValid,
      oauthStateSecret: Boolean(process.env.OAUTH_STATE_SECRET),
      tokenEncryptionKey: Boolean(process.env.OAUTH_TOKEN_ENCRYPTION_KEY),
    },
  });
}
