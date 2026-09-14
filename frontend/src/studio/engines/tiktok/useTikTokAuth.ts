import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  debugTikTokConfig as requestTikTokDebugInfo,
  disconnectTikTokAccount,
  fetchTikTokAccount,
  initiateTikTokAuth,
  publishTikTokVideo,
  type TikTokAccount,
} from './tiktok.engine';

/**
 * Owns TikTok account state and the connect/disconnect/publish flow,
 * including the popup-based OAuth handshake. User-facing errors go through
 * sonner toasts instead of blocking `alert()` calls.
 */
export function useTikTokAuth() {
  const [tiktokAccount, setTiktokAccount] = useState<TikTokAccount | null>(null);

  const refreshTikTokAccount = useCallback(async () => {
    try {
      const account = await fetchTikTokAccount();
      setTiktokAccount(account);
    } catch (error) {
      console.error('Failed to refresh TikTok account:', error);
      setTiktokAccount(null);
    }
  }, []);

  const debugTikTokConfig = useCallback(() => requestTikTokDebugInfo(), []);

  const connectTikTok = useCallback(async () => {
    const debugInfo = await requestTikTokDebugInfo();
    const outcome = await initiateTikTokAuth();

    if (outcome.kind === 'not-configured') {
      const debugMsg = debugInfo
        ? `Client Key: ${debugInfo.checks?.clientKey?.masked || 'NO CONFIGURADO'} · Redirect URI: ${debugInfo.checks?.redirectUri?.value || 'NO CONFIGURADO'}`
        : undefined;
      toast.error('TikTok Developer no está configurado', {
        description: [
          debugMsg,
          'Agrega TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET y TIKTOK_REDIRECT_URI a tu .env.local, o activa TIKTOK_DEMO_MODE=true.',
        ]
          .filter(Boolean)
          .join(' — '),
        duration: 10000,
      });
      return;
    }

    if (outcome.kind === 'error') {
      toast.error('No se pudo iniciar la conexión con TikTok', { description: outcome.message });
      return;
    }

    if (outcome.kind === 'demo') {
      setTiktokAccount({ connected: true, display_name: 'Demo Account', avatar_url: null, is_expired: false });
      toast.info('Modo Demo activado — los videos no se publicarán en TikTok real.');
      return;
    }

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      outcome.authUrl,
      'tiktok-auth',
      `width=${width},height=${height},left=${left},top=${top},popup=true`
    );

    if (!popup) {
      window.location.href = outcome.authUrl;
      return;
    }

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        refreshTikTokAccount();
      }
    }, 500);

    setTimeout(() => clearInterval(checkClosed), 5 * 60 * 1000);
  }, [refreshTikTokAccount]);

  const disconnectTikTok = useCallback(async () => {
    await disconnectTikTokAccount();
    setTiktokAccount(null);
  }, []);

  const publishToTikTok = useCallback(
    (videoBlob: Blob, title: string) => publishTikTokVideo(videoBlob, title),
    []
  );

  useEffect(() => {
    refreshTikTokAccount();
  }, [refreshTikTokAccount]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TIKTOK_CONNECTED') {
        refreshTikTokAccount();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshTikTokAccount]);

  return {
    tiktokAccount,
    connectTikTok,
    disconnectTikTok,
    publishToTikTok,
    refreshTikTokAccount,
    debugTikTokConfig,
  };
}
