import { useEffect, useMemo, useRef, useState } from 'react';
import { createAudioEngine } from './audio.engine';
import type { Voice, StudioAudioApi } from '@/studio/shared/types';

const parseRateValue = (value: string) => {
  const parsed = Number(value.replace('%', ''));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const parsePitchValue = (value: string) => {
  const parsed = Number(value.replace('Hz', ''));
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const useAudio = () => {
  const engineRef = useRef(createAudioEngine());
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voiceRate, setVoiceRate] = useState('0%');
  const [voicePitch, setVoicePitch] = useState('+0Hz');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');

  const rate = useMemo(() => {
    const normalized = parseRateValue(voiceRate);
    return Math.max(0.5, Math.min(2, normalized / 100 + 1));
  }, [voiceRate]);

  const pitch = useMemo(() => {
    const normalized = parsePitchValue(voicePitch);
    return Math.max(0, Math.min(2, normalized / 50 + 1));
  }, [voicePitch]);

  useEffect(() => {
    const loadedVoices = engineRef.current.loadVoices();
    setVoices(loadedVoices);
    if (!selectedVoice && loadedVoices.length > 0) {
      setSelectedVoice(loadedVoices[0].id);
    }

    const handleVoicesChanged = () => {
      const updated = engineRef.current.loadVoices();
      setVoices(updated);
      setSelectedVoice(prev => (prev || updated[0]?.id || ''));
    };

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    }

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [selectedVoice]);

  const speak = async (text: string) => {
    if (!text) {
      return;
    }

    setIsGenerating(true);
    setGenerationProgress('Preparing speech…');
    setIsSpeaking(true);

    try {
      await engineRef.current.speak(text, {
        voiceId: selectedVoice,
        rate,
        pitch,
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
      setIsSpeaking(false);
    }
  };

  const stop = () => {
    engineRef.current.stop();
    setIsSpeaking(false);
  };

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    voiceRate,
    setVoiceRate,
    voicePitch,
    setVoicePitch,
    rate,
    pitch,
    isSpeaking,
    isGenerating,
    generationProgress,
    speak,
    stop,
  } satisfies StudioAudioApi;
};
