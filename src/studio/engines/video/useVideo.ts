import { useCallback, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createVideoRecorderEngine } from './video.engine';

export const useVideo = (canvasRef: RefObject<HTMLCanvasElement | null>) => {
  const recorderEngineRef = useRef(createVideoRecorderEngine());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [lastRecordedBlob, setLastRecordedBlob] = useState<Blob | null>(null);
  const [lastRecordedUrl, setLastRecordedUrl] = useState<string | null>(null);

  const isSupported = useMemo(() => {
    return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';
  }, []);

  const handleRecordVideo = useCallback(async () => {
    if (!canvasRef.current || isRecording || !isSupported) {
      return;
    }

    const stream = canvasRef.current.captureStream(30);
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

  return {
    isRecording,
    recordingProgress,
    handleRecordVideo,
    lastRecordedBlob,
    lastRecordedUrl,
    clearLastRecording,
  };
};
