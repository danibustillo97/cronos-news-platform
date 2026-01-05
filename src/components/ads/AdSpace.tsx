import React, { useEffect, useRef } from 'react';

interface AdSpaceProps {
  slotId?: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  className?: string;
  label?: string;
}

const AdSpace: React.FC<AdSpaceProps> = ({ 
  slotId = "8962635274", // Default slot ID (example)
  format = "auto",
  className = "",
  label = "Publicidad"
}) => {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

  return (
    <div className={`w-full flex flex-col items-center justify-center my-8 ${className}`}>
      {label && (
        <span className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">
          {label}
        </span>
      )}
      <div className="w-full bg-neutral-900/50 rounded-lg overflow-hidden min-h-[100px] flex items-center justify-center border border-white/5">
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client="ca-pub-9550834544643550" // ID del usuario tomado del layout
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
};

export default AdSpace;
