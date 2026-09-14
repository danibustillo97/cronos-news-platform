export interface VideoRecorderEngine {
  record(
    stream: MediaStream,
    durationMs: number,
    onProgress?: (percent: number) => void
  ): Promise<Blob>;
}

const chooseSupportedMimeType = (): string | undefined => {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return undefined;
  }

  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    return 'video/webm;codecs=vp9';
  }

  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
    return 'video/webm;codecs=vp8';
  }

  if (MediaRecorder.isTypeSupported('video/webm')) {
    return 'video/webm';
  }

  return undefined;
};

export const createVideoRecorderEngine = (): VideoRecorderEngine => {
  return {
    async record(stream, durationMs, onProgress) {
      return new Promise<Blob>((resolve, reject) => {
        if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
          reject(new Error('MediaRecorder is not available in this environment.'));
          return;
        }

        const mimeType = chooseSupportedMimeType();
        if (!mimeType) {
          reject(new Error('No supported video mime type is available.'));
          return;
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: BlobPart[] = [];
        let elapsed = 0;
        const interval = 100;
        let progressTimer: number | null = null;

        const updateProgress = () => {
          elapsed += interval;
          const percent = Math.min(100, Math.round((elapsed / durationMs) * 100));
          onProgress?.(percent);
          if (elapsed < durationMs) {
            progressTimer = window.setTimeout(updateProgress, interval);
          }
        };

        recorder.ondataavailable = event => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onerror = () => {
          if (progressTimer !== null) {
            clearTimeout(progressTimer);
          }
          reject(new Error('Video recording failed.'));
        };

        recorder.onstop = () => {
          if (progressTimer !== null) {
            clearTimeout(progressTimer);
          }
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };

        recorder.start();
        updateProgress();
        window.setTimeout(() => {
          recorder.stop();
        }, durationMs);
      });
    },
  };
};
