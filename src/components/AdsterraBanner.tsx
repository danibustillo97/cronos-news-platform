// components/AdsterraBanner.tsx
'use client';

import { useEffect } from 'react';

const AdsterraBanner = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = '//pl27202447.profitableratecpm.com/2d3367d208ec3c9c2bb649af8ebfbc0f/invoke.js';

    const container = document.getElementById('adsterra-container');
    if (container && !container.hasChildNodes()) {
      container.appendChild(script);
    }
  }, []);

  return (
    <div className="my-6 max-w-2xl mx-auto px-2">
      <div id="adsterra-container" />
    </div>
  );
};

export default AdsterraBanner;
