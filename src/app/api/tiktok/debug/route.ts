import { NextResponse } from 'next/server';

/**
 * Debug endpoint to verify TikTok configuration
 * Returns safe information about the configuration without exposing secrets
 */
export async function GET() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  const isDemoMode = process.env.TIKTOK_DEMO_MODE === 'true';
  
  // Check each credential
  const checks = {
    clientKey: {
      exists: !!clientKey,
      length: clientKey?.length || 0,
      valid: clientKey ? clientKey.length >= 20 : false, // TikTok keys are typically 20+ chars
      masked: clientKey ? `${clientKey.substring(0, 4)}...${clientKey.substring(clientKey.length - 4)}` : null,
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
  };
  
  const allValid = checks.clientKey.valid && checks.clientSecret.valid && checks.redirectUri.valid;
  
  return NextResponse.json({
    configured: allValid,
    checks,
    recommendations: [
      !checks.clientKey.valid && 'Client key should be from TikTok Developer portal',
      !checks.clientSecret.valid && 'Client secret should be from TikTok Developer portal', 
      !checks.redirectUri.valid && 'Redirect URI must use https://',
      checks.redirectUri.value?.includes('localhost') && 'Production apps cannot use localhost redirect URIs',
      'Ensure the redirect URI is registered in your TikTok app settings',
      'Your TikTok app must be approved for production use',
    ].filter(Boolean),
  });
}
