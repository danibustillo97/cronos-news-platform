import { useCallback, useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import type { NewsItem, SocialNetworkItem } from '@/studio/shared/types';

const CAPTION_PREFIX = '🔥 TikTok Trend';

const formatSocialNetworks = (): SocialNetworkItem[] => [
  { id: 'tiktok', name: 'TikTok Dev', icon: Smartphone, connected: true, color: 'bg-black', subtitle: '9:16 Short-form' },
];

/** Caption generation and the connected-networks toggle for the share panel. */
export function useSocialShare(selectedNews: NewsItem | null) {
  const [socialNetworks, setSocialNetworks] = useState<SocialNetworkItem[]>(formatSocialNetworks());
  const [activeNetwork, setActiveNetwork] = useState('tiktok');
  const [smartCaption, setSmartCaption] = useState('');

  const toggleNetworkConnection = useCallback((id: string) => {
    setSocialNetworks(prev => prev.map(network =>
      network.id === id ? { ...network, connected: !network.connected } : network
    ));
  }, []);

  const generateSmartCaption = useCallback(() => {
    if (!selectedNews) {
      setSmartCaption('');
      return;
    }

    const tags = socialNetworks
      .filter(network => network.connected)
      .map(network => `#${network.name.replace(/\s+/g, '')}`)
      .slice(0, 4)
      .join(' ');

    setSmartCaption(`${CAPTION_PREFIX}: ${selectedNews.title}\n\n${tags} #NexusNews`);
  }, [selectedNews, socialNetworks]);

  const copyCaption = useCallback(async () => {
    if (!smartCaption || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(smartCaption);
  }, [smartCaption]);

  const handleSmartShare = useCallback(async () => {
    if (!smartCaption || typeof navigator === 'undefined') {
      return;
    }

    if (navigator.share) {
      await navigator.share({ title: 'Social Studio', text: smartCaption });
      return;
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(smartCaption);
    }
  }, [smartCaption]);

  useEffect(() => {
    generateSmartCaption();
  }, [generateSmartCaption]);

  return {
    socialNetworks,
    activeNetwork,
    setActiveNetwork,
    toggleNetworkConnection,
    smartCaption,
    generateSmartCaption,
    copyCaption,
    handleSmartShare,
  };
}
