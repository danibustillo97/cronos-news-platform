import { useCallback, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createVideoRecorderEngine } from './video.engine';

export const useVideo = (canvasRef: RefObject<HTMLCanvasElement | null>, isTainted = false) => {
  const recorderEngineRef = useRef(createVideoRecorderEngine());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [lastRecordedBlob, setLastRecordedBlob] = useState<Blob | null>(null);
  const [lastRecordedUrl, setLastRecordedUrl] = useState<string | null>(null);

  const isSupported = useMemo(() => {
    return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';
  }, []);

  const handleRecordVideo = useCallback(async () => {
    if (!canvasRef.current || isRecording || !isSupported || isTainted) {
      return;
    }

    let stream: MediaStream;
    try {
      stream = canvasRef.current.captureStream(30);
    } catch (error) {
      console.error('[Studio Video] Canvas is not origin-clean, cannot record', error);
      return;
    }
    if (!stream) {
      return;
    }

    setIsRecording(true);
    setRecordingProgress(0);

    try {
      const blob = await recorderEngineRef.current.record(
        stream,
        5500,
        percent => setRecordingProgress(percent)
      );

      // Save blob for later publishing
      setLastRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setLastRecordedUrl(url);

      // Auto download
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'cronos-tiktok-video.webm';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      console.error('[Studio Video] Recording failed', error);
    } finally {
      setIsRecording(false);
      setRecordingProgress(0);
      stream.getTracks().forEach(track => track.stop());
    }
  }, [canvasRef, isRecording, isSupported]);

  const clearLastRecording = useCallback(() => {
    if (lastRecordedUrl) {
      URL.revokeObjectURL(lastRecordedUrl);
    }
    setLastRecordedBlob(null);
    setLastRecordedUrl(null);
  }, [lastRecordedUrl]);

  // Carga un video ya renderizado externamente (ej. el final_reel.mp4 de un
  // export de LAB) en el mismo slot que ocupa un video grabado en vivo con
  // el canvas -- el resto del Studio (preview, publishToTikTok) no distingue
  // el origen del Blob, así que no hace falta ningún otro cambio.
  const loadRenderedVideo = useCallback((file: File) => {
    if (lastRecordedUrl) {
      URL.revokeObjectURL(lastRecordedUrl);
    }
    setLastRecordedBlob(file);
    setLastRecordedUrl(URL.createObjectURL(file));
  }, [lastRecordedUrl]);

  // Same slot, but sourced from a backend-served reference (rule: frontend
  // never parses/uploads LAB artifacts — it fetches the final_reel the
  // backend already resolved via GET /api/stories/{id}/workspace).
  const loadRenderedVideoFromUrl = useCallback(async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch rendered video: ${response.status}`);
    const blob = await response.blob();
    if (lastRecordedUrl) URL.revokeObjectURL(lastRecordedUrl);
    setLastRecordedBlob(blob);
    setLastRecordedUrl(URL.createObjectURL(blob));
  }, [lastRecordedUrl]);

  return {
    isRecording,
    recordingProgress,
    handleRecordVideo,
    lastRecordedBlob,
    lastRecordedUrl,
    clearLastRecording,
    loadRenderedVideo,
    loadRenderedVideoFromUrl,
  };
};
