export interface TikTokAccount {
  connected: boolean;
  display_name?: string;
  avatar_url?: string | null;
  is_expired?: boolean;
}

export type TikTokAuthOutcome =
  | { kind: 'redirect'; authUrl: string }
  | { kind: 'demo' }
  | { kind: 'not-configured' }
  | { kind: 'error'; message: string };

export async function fetchTikTokAccount(): Promise<TikTokAccount | null> {
  const response = await fetch('/api/tiktok/account');

  if (!response.ok) {
    if (response.status === 503) {
      const errorData = await response.json();
      console.warn('TikTok not configured:', errorData.setupInstructions);
      return { connected: false, display_name: 'Configuración pendiente', is_expired: false };
    }
    throw new Error('Failed to fetch account');
  }

  const data = await response.json();
  return data.connected ? { ...data.account, connected: true } : null;
}

export async function debugTikTokConfig(): Promise<any> {
  try {
    const response = await fetch('/api/tiktok/debug');
    const data = await response.json();
    console.log('[TikTok Debug]', data);
    return data;
  } catch (error) {
    console.error('Failed to debug TikTok config:', error);
    return null;
  }
}

export async function initiateTikTokAuth(): Promise<TikTokAuthOutcome> {
  const response = await fetch('/api/tiktok/auth');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({} as { error?: string }));
    if (response.status === 503 || errorData.error?.includes('not configured')) {
      return { kind: 'not-configured' };
    }
    return { kind: 'error', message: errorData.error || 'Failed to initiate auth' };
  }

  const data = await response.json();
  if (data.demoMode) {
    return { kind: 'demo' };
  }
  if (!data.authUrl) {
    return { kind: 'error', message: 'No auth URL received' };
  }
  return { kind: 'redirect', authUrl: data.authUrl };
}

export async function disconnectTikTokAccount(): Promise<void> {
  const response = await fetch('/api/tiktok/account', { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to disconnect');
}

export async function publishTikTokVideo(
  videoBlob: Blob,
  title: string
): Promise<{ success: boolean; share_url?: string | null; error?: string }> {
  const response = await fetch('/api/tiktok/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoSize: videoBlob.size,
      title,
      privacy_level: 'PUBLIC',
      disable_duet: true,
      disable_stitch: true,
      disable_comment: true,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    return { success: false, error: result.error || 'Upload failed' };
  }

  if (!result.upload_url) {
    return { success: false, error: 'TikTok did not return an upload URL' };
  }

  const upload = await fetch(result.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${videoBlob.size - 1}/${videoBlob.size}`,
    },
    body: videoBlob,
  });
  if (!upload.ok) {
    return { success: false, error: 'The direct TikTok upload failed' };
  }

  return { success: true, share_url: null };
}
