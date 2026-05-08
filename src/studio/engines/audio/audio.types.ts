import type { Voice } from '@/studio/shared/types';

export interface SpeechOptions {
  voiceId?: string;
  rate: number;
  pitch: number;
}

export interface VoiceProvider {
  getVoices(): Voice[];
  speak(
    text: string,
    options: SpeechOptions,
    onStart: () => void,
    onEnd: () => void
  ): void;
  cancel(): void;
}

export interface AudioEngine {
  loadVoices(): Voice[];
  speak(text: string, options: SpeechOptions): Promise<void>;
  stop(): void;
}
