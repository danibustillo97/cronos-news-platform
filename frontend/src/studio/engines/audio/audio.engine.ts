import type { AudioEngine, SpeechOptions } from './audio.types';
import type { Voice } from '@/studio/shared/types';
import { createBrowserSpeechProvider } from './audio.providers';

const normalizeRate = (value: number) => Math.max(0.5, Math.min(2, value));
const normalizePitch = (value: number) => Math.max(0, Math.min(2, value));

export const createAudioEngine = (provider = createBrowserSpeechProvider()): AudioEngine => {
  return {
    loadVoices(): Voice[] {
      return provider.getVoices();
    },

    speak(text: string, options: SpeechOptions): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        try {
          const normalizedOptions: SpeechOptions = {
            voiceId: options.voiceId,
            rate: normalizeRate(options.rate),
            pitch: normalizePitch(options.pitch),
          };

          provider.speak(
            text,
            normalizedOptions,
            () => undefined,
            () => resolve()
          );
        } catch (error) {
          reject(error);
        }
      });
    },

    stop(): void {
      provider.cancel();
    },
  };
};
