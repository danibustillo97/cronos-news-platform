import type { ComponentType } from 'react';

export type TabType = 'content' | 'design' | 'editor' | 'video' | 'audio' | 'sponsor';
export type FormatType = 'square' | 'story' | 'video';
export type LayoutMode = 'auto' | 'overlay' | 'split' | 'breaking' | 'minimal';
export type AspectRatio = '9:16' | '16:9';

export interface NewsItem {
  id: string;
  title: string;
  image_url: string;
  category: string;
  created_at: string;
  slug?: string;
  content?: string;
}

export interface ScriptSegment {
  text: string;
  duration: number;
  image?: string | null;
  audioBuffer?: AudioBuffer | null;
}

export interface Voice {
  id: string;
  label: string;
  locale: string;
}

export interface SocialNetworkItem {
  id: string;
  name: string;
  icon: ComponentType<any>;
  connected: boolean;
  color: string;
  subtitle: string;
}

export interface VideoScene {
  id: string;
  type: 'intro' | 'headline' | 'paragraph' | 'outro';
  startMs: number;
  durationMs: number;
  payload: {
    text?: string;
    imageUrl?: string;
  };
}

export interface VideoTimeline {
  durationMs: number;
  scenes: VideoScene[];
  sourceNews: NewsItem;
}

export interface StudioAudioApi {
  voices: Voice[];
  selectedVoice: string;
  setSelectedVoice: (voiceId: string) => void;
  voiceRate: string;
  setVoiceRate: (value: string) => void;
  voicePitch: string;
  setVoicePitch: (value: string) => void;
  rate: number;
  pitch: number;
  isSpeaking: boolean;
  isGenerating: boolean;
  generationProgress: string;
  speak: (text: string) => Promise<void>;
  stop: () => void;
}
