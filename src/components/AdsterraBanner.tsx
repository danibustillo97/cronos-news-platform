// components/AdsterraBanner.tsx
'use client';

import { useEffect, useRef } from 'react';

const AdsterraBanner = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && containerRef.current.childNodes.length === 0) {
      const script = document.createElement('script');
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.src = '//pl27202447.profitableratecpm.com/2d3367d208ec3c9c2bb649af8ebfbc0f/invoke.js';

      containerRef.current.appendChild(script);
    }
  }, []);

  return (
    <div className="my-6 max-w-2xl mx-auto px-2">
      <div
        id="container-2d3367d208ec3c9c2bb649af8ebfbc0f"
        ref={containerRef}
        className="w-full"
        style={{ minHeight: 100 }}
      />
    </div>
  );
};

export default AdsterraBanner;
