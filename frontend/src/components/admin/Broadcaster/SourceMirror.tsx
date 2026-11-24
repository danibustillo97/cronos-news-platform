"use client";

import { useEffect, useRef } from "react";

interface Props {
  /** Returns the always-mounted pool element for the source (it may not exist yet). */
  getElement: () => HTMLVideoElement | undefined;
  className?: string;
}

/**
 * Thumbnail of a source drawn from its pool <video>. The pool element is the only
 * one that decodes the source, so thumbnails can mount and unmount freely without
 * ever taking the source off Preview or Program.
 */
export function SourceMirror({ getElement, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getRef = useRef(getElement);
  getRef.current = getElement;

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < 100) return;
      last = now;
      const canvas = canvasRef.current;
      const video = getRef.current();
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      if (!video?.videoWidth) {
        context.fillStyle = "#000";
        context.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const w = video.videoWidth * scale;
      const h = video.videoHeight * scale;
      context.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} width={320} height={180} className={className} />;
}
