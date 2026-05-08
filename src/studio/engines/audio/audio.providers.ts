import type { SpeechOptions, VoiceProvider } from './audio.types';
import type { Voice } from '@/studio/shared/types';

const toVoiceModel = (speechVoice: SpeechSynthesisVoice): Voice => ({
  id: speechVoice.name,
  label: speechVoice.name,
  locale: speechVoice.lang,
});

export class BrowserSpeechProvider implements VoiceProvider {
  private utterance: SpeechSynthesisUtterance | null = null;

  getVoices(): Voice[] {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return [];
    }

    return window.speechSynthesis
      .getVoices()
      .map(toVoiceModel);
  }

  cancel(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    window.speechSynthesis.cancel();
    this.utterance = null;
  }

  speak(
    text: string,
    options: SpeechOptions,
    onStart: () => void,
    onEnd: () => void
  ): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onStart();
      onEnd();
      return;
    }

    this.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    this.utterance = utterance;

    const allVoices = window.speechSynthesis.getVoices();
    const selectedVoice = allVoices.find(v => v.name === options.voiceId);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = Math.max(0.5, Math.min(2, options.rate));
    utterance.pitch = Math.max(0, Math.min(2, options.pitch));

    utterance.onstart = () => onStart();
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();

    window.speechSynthesis.speak(utterance);
  }
}

export const createBrowserSpeechProvider = (): VoiceProvider => new BrowserSpeechProvider();
