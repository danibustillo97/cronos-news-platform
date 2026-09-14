import { useCallback, useEffect, useRef, useState } from 'react';
import {
  renderOverlayLayout,
  renderSplitLayout,
  renderBreakingLayout,
  renderMinimalLayout,
  renderVideoFrame,
} from '@/components/admin/SocialMedia/services/canvas';
import { resolveLayoutForNews } from '@/studio/engines/news/news.engine';
import type { AspectRatio, FormatType, LayoutMode, NewsItem, ScriptSegment } from '@/studio/shared/types';

interface UseCanvasRendererParams {
  selectedNews: NewsItem | null;
  format: FormatType;
  layoutMode: LayoutMode;
  fontSize: number;
  aspectRatio: AspectRatio;
  showWatermark: boolean;
  sponsorName: string;
  videoScript: ScriptSegment[];
}

/**
 * Owns the 2D canvas preview: still-image layouts for square/story format,
 * and a requestAnimationFrame loop over the video timeline for video format.
 * Pure drawing logic lives in services/canvas — this hook only wires it to
 * the canvas element and the studio's current settings.
 */
export function useCanvasRenderer({
  selectedNews,
  format,
  layoutMode,
  fontSize,
  aspectRatio,
  showWatermark,
  sponsorName,
  videoScript,
}: UseCanvasRendererParams) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [isTainted, setIsTainted] = useState(false);

  const loadImage = useCallback(async (url: string): Promise<HTMLImageElement> => {
    const cached = imageCacheRef.current.get(url);
    if (cached) {
      return cached;
    }

    // Remote images (Supabase storage, etc.) rarely send CORS headers, which
    // taints the canvas and breaks captureStream()/toBlob(). Route those
    // through our own proxy (which does add Access-Control-Allow-Origin) so
    // crossOrigin="anonymous" actually succeeds instead of falling back to a
    // tainted load. Local blob:/data:/relative URLs go through untouched.
    const loadUrl = /^https?:\/\//.test(url) ? `/api/proxy-image?url=${encodeURIComponent(url)}` : url;

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = loadUrl;

      image.onload = () => {
        setIsTainted(false);
        imageCacheRef.current.set(url, image);
        resolve(image);
      };

      image.onerror = () => {
        const fallback = new Image();
        fallback.src = url;
        fallback.onload = () => {
          setIsTainted(true);
          imageCacheRef.current.set(url, fallback);
          resolve(fallback);
        };
        fallback.onerror = reject;
      };
    });
  }, []);

  const generateCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedNews) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const width = 1080;
    const height = format === 'story' ? 1920 : 1080;
    canvas.width = width;
    canvas.height = height;

    try {
      const image = await loadImage(selectedNews.image_url);
      const effectiveLayout = layoutMode === 'auto' ? resolveLayoutForNews(selectedNews) : layoutMode;
      const title = selectedNews.title;

      if (effectiveLayout === 'overlay') renderOverlayLayout(ctx, image, width, height, selectedNews, title, fontSize);
      else if (effectiveLayout === 'split') renderSplitLayout(ctx, image, width, height, format, selectedNews, title, fontSize);
      else if (effectiveLayout === 'breaking') renderBreakingLayout(ctx, image, width, height, title, fontSize);
      else renderMinimalLayout(ctx, image, width, height, title, fontSize);
    } catch {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      ctx.font = '28px sans-serif';
      ctx.fillText('No se pudo cargar la imagen', 30, 80);
    }
  }, [format, fontSize, layoutMode, loadImage, selectedNews]);

  const startPreviewLoop = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedNews) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const width = aspectRatio === '16:9' ? 1920 : 1080;
    const height = aspectRatio === '16:9' ? 1080 : 1920;
    canvas.width = width;
    canvas.height = height;

    const image = await loadImage(selectedNews.image_url);
    const totalDuration = videoScript.reduce((acc, segment) => acc + segment.duration, 0) || 15000;
    const startTime = performance.now();

    const loop = (time: number) => {
      const elapsed = time - startTime;
      renderVideoFrame(
        ctx,
        image,
        width,
        height,
        elapsed % totalDuration,
        totalDuration,
        null,
        videoScript,
        selectedNews,
        selectedNews.title,
        layoutMode,
        fontSize,
        format,
        showWatermark,
        sponsorName
      );
      animationRef.current = requestAnimationFrame(loop);
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    animationRef.current = requestAnimationFrame(loop);
  }, [aspectRatio, format, fontSize, layoutMode, loadImage, selectedNews, videoScript, showWatermark, sponsorName]);

  useEffect(() => {
    if (!selectedNews) {
      return;
    }

    if (format === 'video') {
      void startPreviewLoop();
    } else {
      void generateCanvas();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [format, generateCanvas, selectedNews, startPreviewLoop]);

  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isTainted) {
      return;
    }

    canvas.toBlob(blob => {
      if (!blob) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'social-studio-image.png';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });
  }, [isTainted]);

  return { canvasRef, isTainted, downloadImage };
}
