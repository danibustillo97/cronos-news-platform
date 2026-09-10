import { useCallback, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { useAudio } from '@/studio/engines/audio/useAudio';
import { useVideo } from '@/studio/engines/video/useVideo';
import { useScript } from '@/studio/engines/text/useScript';
import { useNews } from '@/studio/engines/news/useNews';
import { useCanvasRenderer } from '@/studio/engines/canvas/useCanvasRenderer';
import { useTikTokAuth } from '@/studio/engines/tiktok/useTikTokAuth';
import { useSocialShare } from '@/studio/engines/share/useSocialShare';
import type { TikTokAccount } from '@/studio/engines/tiktok/tiktok.engine';
import type {
  NewsItem,
  ScriptSegment,
  SocialNetworkItem,
  FormatType,
  LayoutMode,
  AspectRatio,
  StudioAudioApi,
  Voice,
} from '@/studio/shared/types';

export interface StudioApi {
  // News
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  news: NewsItem[];
  selectedNews: NewsItem | null;
  handleNewsSelect: (item: NewsItem) => void;
  setSelectedNews: (item: NewsItem | null) => void;
  // Content
  customTitle: string;
  setCustomTitle: (value: string) => void;
  // Design
  layoutMode: LayoutMode;
  setLayoutMode: (value: LayoutMode) => void;
  format: FormatType;
  setFormat: (value: FormatType) => void;
  fontSize: number;
  setFontSize: (value: number) => void;
  showWatermark: boolean;
  setShowWatermark: (value: boolean) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (value: AspectRatio) => void;
  // Sponsor
  sponsorName: string;
  setSponsorName: (value: string) => void;
  sponsorLogo: string | null;
  setSponsorLogo: (value: string | null) => void;
  handleLogoUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  // Script / media
  videoScript: ScriptSegment[];
  setVideoScript: (segments: ScriptSegment[] | ((prev: ScriptSegment[]) => ScriptSegment[])) => void;
  generateVideoScript: () => void;
  projectImages: string[];
  setProjectImages: (images: string[] | ((prev: string[]) => string[])) => void;
  editingSegmentIndex: number | null;
  setEditingSegmentIndex: (index: number | null) => void;
  isUploading: boolean;
  handleSupabaseUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  assignImageToSegment: (index: number, imageUrl: string) => void;
  // Social networks
  socialNetworks: SocialNetworkItem[];
  activeNetwork: string;
  setActiveNetwork: (id: string) => void;
  toggleNetworkConnection: (id: string) => void;
  // TikTok
  tiktokAccount: TikTokAccount | null;
  connectTikTok: () => Promise<void>;
  disconnectTikTok: () => Promise<void>;
  publishToTikTok: (videoBlob: Blob, title: string) => Promise<{ success: boolean; share_url?: string | null; error?: string }>;
  // Caption / share
  smartCaption: string;
  generateSmartCaption: () => void;
  handleSmartShare: () => Promise<void>;
  copyCaption: () => Promise<void>;
  downloadImage: () => void;
  // Canvas
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isTainted: boolean;
  // Video recording
  isRecording: boolean;
  recordingProgress: number;
  handleRecordVideo: () => void;
  lastRecordedBlob: Blob | null;
  lastRecordedUrl: string | null;
  clearLastRecording: () => void;
  // Audio engine
  voices: Voice[];
  selectedVoice: string;
  setSelectedVoice: (voiceId: string) => void;
  voiceRate: string;
  setVoiceRate: (value: string) => void;
  voicePitch: string;
  setVoicePitch: (value: string) => void;
  isSpeaking: boolean;
  isGeneratingAudio: boolean;
  generationProgress: string;
  generateNeuralAudio: () => Promise<void>;
  stop: () => void;
  speak: (text: string) => Promise<void>;
  bgAudioName: string;
  bgAudioVolume: number;
  setBgAudioVolume: (value: number) => void;
  handleAudioUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  micEnabled: boolean;
  handleMicToggle: (value: boolean) => void;
  // TikTok account state
  refreshTikTokAccount: () => Promise<void>;
  debugTikTokConfig: () => Promise<any>;
}

/**
 * Composes the Content Studio's domain hooks into the single `StudioApi`
 * surface consumed by TopBar/Sidebar/WorkArea. Each domain (news, canvas
 * rendering, TikTok auth, social share, plus the pre-existing audio/video/
 * text engines) owns its own state — this hook only wires them together and
 * keeps the small bits of UI-only state that don't warrant their own file.
 */
export const useStudio = () => {
  const [customTitle, setCustomTitle] = useState('');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('overlay');
  const [format, setFormat] = useState<FormatType>('story');
  const [fontSize, setFontSize] = useState(48);
  const [showWatermark, setShowWatermark] = useState(true);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorLogo, setSponsorLogo] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [projectImages, setProjectImages] = useState<string[]>([]);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [bgAudioName, setBgAudioName] = useState('');
  const [bgAudioVolume, setBgAudioVolume] = useState(0.4);
  const [micEnabled, setMicEnabled] = useState(false);

  const audio = useAudio();
  const script = useScript([]);

  const handleNewsSelected = useCallback(
    (item: NewsItem) => {
      setCustomTitle(item.title);
      setProjectImages([item.image_url]);
      script.generateVideoScript(item.title, item);
    },
    [script]
  );

  const { searchTerm, setSearchTerm, news, selectedNews, setSelectedNews, handleNewsSelect } =
    useNews(handleNewsSelected);

  const { canvasRef, isTainted, downloadImage } = useCanvasRenderer({
    selectedNews,
    format,
    layoutMode,
    fontSize,
    aspectRatio,
    showWatermark,
    sponsorName,
    videoScript: script.videoScript,
  });

  const video = useVideo(canvasRef);
  const tiktok = useTikTokAuth();
  const share = useSocialShare(selectedNews);

  const handleSupabaseUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    try {
      const url = URL.createObjectURL(file);
      setProjectImages(prev => [...prev, url]);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleMicToggle = useCallback((value: boolean) => {
    setMicEnabled(value);
  }, []);

  const generateNeuralAudio = useCallback(async () => {
    if (!script.videoScript.length) {
      return;
    }

    const text = script.videoScript
      .map(segment => segment.text)
      .filter(text => text !== 'INTRO_SEQUENCE' && text !== 'OUTRO_SEQUENCE')
      .join('. ');

    if (!text) {
      return;
    }

    await audio.speak(text);
  }, [audio, script.videoScript]);

  const assignImageToSegment = useCallback((index: number, imageUrl: string) => {
    script.setVideoScript(prev => prev.map((segment, segmentIndex) =>
      segmentIndex === index ? { ...segment, image: imageUrl } : segment
    ));
  }, [script]);

  const generateVideoScript = useCallback(() => {
    script.generateVideoScript(customTitle || selectedNews?.title || 'Narración generada.', selectedNews);
  }, [customTitle, script, selectedNews]);

  const handleLogoUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSponsorLogo(URL.createObjectURL(file));
  }, []);

  const handleAudioUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBgAudioName(file.name);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    news,
    selectedNews,
    handleNewsSelect,
    setSelectedNews,
    customTitle,
    setCustomTitle,
    layoutMode,
    setLayoutMode,
    format,
    setFormat,
    fontSize,
    setFontSize,
    showWatermark,
    setShowWatermark,
    sponsorName,
    setSponsorName,
    sponsorLogo,
    setSponsorLogo,
    aspectRatio,
    setAspectRatio,
    videoScript: script.videoScript,
    setVideoScript: script.setVideoScript,
    generateVideoScript,
    projectImages,
    setProjectImages,
    editingSegmentIndex,
    setEditingSegmentIndex,
    isUploading,
    handleSupabaseUpload,
    assignImageToSegment,
    socialNetworks: share.socialNetworks,
    activeNetwork: share.activeNetwork,
    setActiveNetwork: share.setActiveNetwork,
    toggleNetworkConnection: share.toggleNetworkConnection,
    smartCaption: share.smartCaption,
    generateSmartCaption: share.generateSmartCaption,
    handleSmartShare: share.handleSmartShare,
    copyCaption: share.copyCaption,
    downloadImage,
    canvasRef,
    isTainted,
    voices: audio.voices,
    selectedVoice: audio.selectedVoice,
    setSelectedVoice: audio.setSelectedVoice,
    voiceRate: audio.voiceRate,
    setVoiceRate: audio.setVoiceRate,
    voicePitch: audio.voicePitch,
    setVoicePitch: audio.setVoicePitch,
    isSpeaking: audio.isSpeaking,
    isGeneratingAudio: audio.isGenerating,
    generationProgress: audio.generationProgress,
    speak: audio.speak,
    stop: audio.stop,
    isRecording: video.isRecording,
    recordingProgress: video.recordingProgress,
    handleRecordVideo: video.handleRecordVideo,
    lastRecordedBlob: video.lastRecordedBlob,
    lastRecordedUrl: video.lastRecordedUrl,
    clearLastRecording: video.clearLastRecording,
    bgAudioName,
    bgAudioVolume,
    setBgAudioVolume,
    handleAudioUpload,
    handleLogoUpload,
    micEnabled,
    handleMicToggle,
    generateNeuralAudio,
    tiktokAccount: tiktok.tiktokAccount,
    connectTikTok: tiktok.connectTikTok,
    disconnectTikTok: tiktok.disconnectTikTok,
    publishToTikTok: tiktok.publishToTikTok,
    refreshTikTokAccount: tiktok.refreshTikTokAccount,
    debugTikTokConfig: tiktok.debugTikTokConfig,
  } satisfies StudioApi;
};
