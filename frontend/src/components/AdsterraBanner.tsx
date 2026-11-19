// components/AdsterraBanner.tsx
'use client';

import { useEffect, useRef } from 'react';
import { getAdProviderConfig } from '@/lib/adConfig';
import { useConsent } from '@/components/ads/ConsentProvider';

const AdsterraBanner = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { choice } = useConsent();
  const config = getAdProviderConfig();

  useEffect(() => {
    if (
      choice === 'accepted'
      && config.adsterraEnabled
      && config.adsterraScriptUrl
      && config.adsterraContainerId
      && containerRef.current
      && containerRef.current.childNodes.length === 0
    ) {
      const script = document.createElement('script');
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.src = config.adsterraScriptUrl;

      containerRef.current.appendChild(script);
    }
  }, [choice, config.adsterraEnabled, config.adsterraScriptUrl, config.adsterraContainerId]);

  return (
    <div className="my-6 max-w-2xl mx-auto px-2">
      <div
        id={config.adsterraContainerId || 'adsterra-disabled'}
        ref={containerRef}
        className="w-full"
        style={{ minHeight: 100 }}
      />
    </div>
  );
};

export default AdsterraBanner;
