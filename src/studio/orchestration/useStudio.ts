import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { Facebook, Twitter, Instagram, Youtube, Linkedin, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAudio } from '@/studio/engines/audio/useAudio';
import { useVideo } from '@/studio/engines/video/useVideo';
import { useScript } from '@/studio/engines/text/useScript';
import {
  renderOverlayLayout,
  renderSplitLayout,
  renderBreakingLayout,
  renderMinimalLayout,
  renderVideoFrame,
} from '@/components/admin/SocialMedia/services/canvas';
import type {
  NewsItem,
  ScriptSegment,
  SocialNetworkItem,
  FormatType,
  LayoutMode,
  AspectRatio,
  TabType,
  StudioAudioApi,
  Voice,
} from '@/studio/shared/types';

export interface StudioApi {
  // Navigation
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  // News
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  news: NewsItem[];
  selectedNews: NewsItem | null;
  handleNewsSelect: (item: NewsItem) => void;
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
}

const getCaptionPrefix = (networkId: string) => {
  switch (networkId) {
    case 'instagram':
      return '🎥 Nuevo post viral';
    case 'tiktok':
      return '🔥 Trend alert';
    case 'facebook':
      return '📰 Flash news';
    case 'youtube':
      return '🎬 Short listo';
    case 'linkedin':
      return '📈 Insights profesionales';
    case 'twitter':
      return '🗣️ Hilo rápido';
    default:
      return '📲 Actualización';
  }
};

const formatSocialNetworks = (): SocialNetworkItem[] => [
  { id: 'facebook', name: 'Facebook', icon: Facebook, connected: true, color: 'bg-blue-500', subtitle: 'Post + Link' },
  { id: 'twitter', name: 'Twitter', icon: Twitter, connected: true, color: 'bg-sky-400', subtitle: 'Thread ready' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, connected: true, color: 'bg-pink-500', subtitle: 'Feed / Reel' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, connected: false, color: 'bg-red-500', subtitle: 'Shorts / Thumbnail' },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, connected: false, color: 'bg-sky-700', subtitle: 'Profesional' },
  { id: 'tiktok', name: 'TikTok', icon: Smartphone, connected: false, color: 'bg-black', subtitle: 'Short-form' },
];

const resolveLayoutForNews = (news: NewsItem): Exclude<LayoutMode, 'auto'> => {
  const category = news.category.toLowerCase();
  const titleLength = news.title.length;

  if (category.includes('urgente') || category.includes('breaking')) {
    return 'breaking';
  }

  if (category.includes('deporte') || category.includes('fútbol')) {
    return 'overlay';
  }

  if (titleLength > 90) {
    return 'split';
  }

  return 'overlay';
};

export const useStudio = () => {
  const [activeTab, setActiveTab] = useState<StudioApi['activeTab']>('content');
  const [searchTerm, setSearchTerm] = useState('');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('overlay');
  const [format, setFormat] = useState<FormatType>('square');
  const [fontSize, setFontSize] = useState(48);
  const [showWatermark, setShowWatermark] = useState(true);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorLogo, setSponsorLogo] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [projectImages, setProjectImages] = useState<string[]>([]);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [socialNetworks, setSocialNetworks] = useState<SocialNetworkItem[]>(formatSocialNetworks());
  const [activeNetwork, setActiveNetwork] = useState('instagram');
  const [smartCaption, setSmartCaption] = useState('');
  const [bgAudioName, setBgAudioName] = useState('');
  const [bgAudioVolume, setBgAudioVolume] = useState(0.4);
  const [micEnabled, setMicEnabled] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [isTainted, setIsTainted] = useState(false);

  const audio = useAudio();
  const script = useScript([]);
  const video = useVideo(canvasRef);

  const loadNews = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('news')
        .select('id, title, image_url, category, created_at, slug, content')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setNews(data);
        if (!selectedNews && data.length > 0) {
          handleNewsSelect(data[0]);
        }
      }
    } catch (error) {
      console.error('[Studio] Failed to load news', error);
    }
  }, [selectedNews]);

  const handleNewsSelect = useCallback(
    (item: NewsItem) => {
      setSelectedNews(item);
      setCustomTitle(item.title);
      setProjectImages([item.image_url]);
      script.generateVideoScript(item.title, item);
    },
    [script]
  );

  useEffect(() => {
    void loadNews();
  }, [loadNews]);

  const loadImage = useCallback(async (url: string): Promise<HTMLImageElement> => {
    const cached = imageCacheRef.current.get(url);
    if (cached) {
      return cached;
    }

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = url;

      image.onload = () => {
        setIsTainted(false);
        imageCacheRef.current.set(url, image);
        resolve(image);
      };

      image.onerror = () => {
        const fallback = new Image();
        fallback.src = url;
        fallback.onload = () => {
          setIsTainted(true);
          imageCacheRef.current.set(url, fallback);
          resolve(fallback);
        };
        fallback.onerror = reject;
      };
    });
  }, []);

  const generateCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedNews) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const width = 1080;
    const height = format === 'story' ? 1920 : 1080;
    canvas.width = width;
    canvas.height = height;

    try {
      const image = await loadImage(selectedNews.image_url);
      const effectiveLayout = layoutMode === 'auto' ? resolveLayoutForNews(selectedNews) : layoutMode;

      const title = selectedNews.title;
      if (effectiveLayout === 'overlay') renderOverlayLayout(ctx, image, width, height, selectedNews, title, fontSize);
      else if (effectiveLayout === 'split') renderSplitLayout(ctx, image, width, height, format, selectedNews, title, fontSize);
      else if (effectiveLayout === 'breaking') renderBreakingLayout(ctx, image, width, height, title, fontSize);
      else renderMinimalLayout(ctx, image, width, height, title, fontSize);
    } catch {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      ctx.font = '28px sans-serif';
      ctx.fillText('No se pudo cargar la imagen', 30, 80);
    }
  }, [format, fontSize, layoutMode, loadImage, selectedNews, showWatermark, sponsorName, sponsorLogo]);

  const startPreviewLoop = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedNews) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const width = aspectRatio === '16:9' ? 1920 : 1080;
    const height = aspectRatio === '16:9' ? 1080 : 1920;
    canvas.width = width;
    canvas.height = height;

    const image = await loadImage(selectedNews.image_url);
    const totalDuration = script.videoScript.reduce((acc, segment) => acc + segment.duration, 0) || 15000;
    const startTime = performance.now();

    const loop = (time: number) => {
      const elapsed = time - startTime;
      renderVideoFrame(
        ctx,
        image,
        width,
        height,
        elapsed % totalDuration,
        totalDuration,
        null,
        script.videoScript,
        selectedNews,
        selectedNews.title,
        layoutMode,
        fontSize,
        format,
        showWatermark,
        sponsorName
      );
      animationRef.current = requestAnimationFrame(loop);
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    animationRef.current = requestAnimationFrame(loop);
  }, [aspectRatio, format, fontSize, layoutMode, loadImage, selectedNews, script.videoScript, showWatermark, sponsorName]);

  useEffect(() => {
    if (!selectedNews) {
      return;
    }

    if (format === 'video') {
      void startPreviewLoop();
    } else {
      void generateCanvas();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [format, generateCanvas, selectedNews, startPreviewLoop]);

  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isTainted) {
      return;
    }

    canvas.toBlob(blob => {
      if (!blob) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'social-studio-image.png';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });
  }, [isTainted]);

  const copyCaption = useCallback(async () => {
    if (!smartCaption || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(smartCaption);
  }, [smartCaption]);

  const handleSmartShare = useCallback(async () => {
    if (!smartCaption || typeof navigator === 'undefined') {
      return;
    }

    if (navigator.share) {
      await navigator.share({ title: 'Social Studio', text: smartCaption });
      return;
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(smartCaption);
    }
  }, [smartCaption]);

  const handleSupabaseUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const toggleNetworkConnection = useCallback((id: string) => {
    setSocialNetworks(prev => prev.map(network =>
      network.id === id ? { ...network, connected: !network.connected } : network
    ));
  }, []);

  const generateSmartCaption = useCallback(() => {
    if (!selectedNews) {
      setSmartCaption('');
      return;
    }

    const tags = socialNetworks
      .filter(network => network.connected)
      .map(network => `#${network.name.replace(/\s+/g, '')}`)
      .slice(0, 4)
      .join(' ');

    setSmartCaption(`${getCaptionPrefix(activeNetwork)}: ${selectedNews.title}\n\n${tags} #NexusNews`);
  }, [activeNetwork, selectedNews, socialNetworks]);

  const generateVideoScript = useCallback(() => {
    script.generateVideoScript(customTitle || selectedNews?.title || 'Narración generada.', selectedNews);
  }, [customTitle, script, selectedNews]);

  const handleLogoUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSponsorLogo(url);
  }, []);

  const handleAudioUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBgAudioName(file.name);
  }, []);

  useEffect(() => {
    generateSmartCaption();
  }, [generateSmartCaption]);

  return {
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    news,
    selectedNews,
    handleNewsSelect,
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
    socialNetworks,
    activeNetwork,
    toggleNetworkConnection,
    smartCaption,
    generateSmartCaption,
    handleSmartShare,
    copyCaption,
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
    bgAudioName,
    bgAudioVolume,
    setBgAudioVolume,
    handleAudioUpload,
    handleLogoUpload,
    micEnabled,
    handleMicToggle,
    generateNeuralAudio,
    setActiveNetwork,
  } satisfies StudioApi;
};
