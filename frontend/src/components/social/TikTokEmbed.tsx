import React from 'react';

interface TikTokEmbedProps {
  videoId: string;
  className?: string;
}

const TikTokEmbed: React.FC<TikTokEmbedProps> = ({ videoId, className = "" }) => {
  return (
    <div className={`rounded-xl overflow-hidden bg-black ${className}`}>
      <blockquote
        className="tiktok-embed"
        cite={`https://www.tiktok.com/@tiktok/video/${videoId}`}
        data-video-id={videoId}
        style={{ maxWidth: '605px', minWidth: '325px' }}
      >
        <section>
          <a
            target="_blank"
            title="@tiktok"
            href="https://www.tiktok.com/@tiktok"
          >
            Loading TikTok...
          </a>
        </section>
      </blockquote>
      <script async src="https://www.tiktok.com/embed.js"></script>
    </div>
  );
};

export default TikTokEmbed;
