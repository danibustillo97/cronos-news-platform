/**
 * TikTok API Service
 * Frontend service for TikTok Developer API integration
 */

export interface TikTokAccount {
  connected: boolean;
  open_id?: string;
  display_name?: string;
  avatar_url?: string | null;
  is_expired?: boolean;
  expires_at?: string;
}

export interface TikTokUploadResult {
  success: boolean;
  publish_id?: string;
  status?: string;
  share_url?: string | null;
  error?: string;
}

/**
 * Check TikTok connection status
 */
export async function getTikTokAccount(): Promise<TikTokAccount> {
  const response = await fetch('/api/tiktok/account');
  
  if (!response.ok) {
    throw new Error('Failed to check TikTok account status');
  }
  
  return response.json();
}

/**
 * Initiate TikTok OAuth flow
 */
export async function connectTikTok(): Promise<void> {
  const response = await fetch('/api/tiktok/auth');
  
  if (!response.ok) {
    throw new Error('Failed to initiate TikTok authentication');
  }
  
  const { authUrl } = await response.json();
  
  // Open TikTok auth in popup
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  
  const popup = window.open(
    authUrl,
    'tiktok-auth',
    `width=${width},height=${height},left=${left},top=${top},popup=true`
  );
  
  if (!popup) {
    // Fallback: redirect in same window
    window.location.href = authUrl;
  }
}

/**
 * Disconnect TikTok account
 */
export async function disconnectTikTok(): Promise<void> {
  const response = await fetch('/api/tiktok/account', {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to disconnect TikTok account');
  }
}

/**
 * Upload video to TikTok
 */
export async function uploadToTikTok(
  videoBlob: Blob,
  options: {
    title: string;
    privacyLevel?: 'PUBLIC' | 'PRIVATE' | 'FRIENDS';
    allowDuet?: boolean;
    allowStitch?: boolean;
    allowComment?: boolean;
  }
): Promise<TikTokUploadResult> {
  const response = await fetch('/api/tiktok/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoSize: videoBlob.size,
      title: options.title,
      privacy_level: options.privacyLevel || 'PUBLIC',
      disable_duet: !options.allowDuet,
      disable_stitch: !options.allowStitch,
      disable_comment: !options.allowComment,
    }),
  });

  const result = await response.json();
  
  if (!response.ok) {
    return {
      success: false,
      error: result.error || 'Failed to upload to TikTok',
    };
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
  return upload.ok
    ? { success: true, publish_id: result.publish_id }
    : { success: false, error: 'The direct TikTok upload failed' };
}

/**
 * Monitor TikTok auth callback (for popup flow)
 */
export function listenForTikTokCallback(
  onSuccess: () => void,
  onError: (error: string) => void
): () => void {
  const handleMessage = (event: MessageEvent) => {
    // Verify origin
    if (event.origin !== window.location.origin) return;
    
    if (event.data?.type === 'TIKTOK_AUTH_SUCCESS') {
      onSuccess();
    } else if (event.data?.type === 'TIKTOK_AUTH_ERROR') {
      onError(event.data.error || 'Authentication failed');
    }
  };

  window.addEventListener('message', handleMessage);
  
  return () => window.removeEventListener('message', handleMessage);
}
