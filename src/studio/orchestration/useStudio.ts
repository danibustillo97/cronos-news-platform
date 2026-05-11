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
  tiktokAccount: { connected: boolean; display_name?: string; avatar_url?: string | null; is_expired?: boolean } | null;
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

const getCaptionPrefix = (networkId: string) => {
  switch (networkId) {
    case 'tiktok':
      return '🔥 TikTok Trend';
    default:
      return '� TikTok Trend';
  }
};

const formatSocialNetworks = (): SocialNetworkItem[] => [
  { id: 'tiktok', name: 'TikTok Dev', icon: Smartphone, connected: true, color: 'bg-black', subtitle: '9:16 Short-form' },
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
  const [format, setFormat] = useState<FormatType>('story');
  const [fontSize, setFontSize] = useState(48);
  const [showWatermark, setShowWatermark] = useState(true);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorLogo, setSponsorLogo] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [projectImages, setProjectImages] = useState<string[]>([]);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [socialNetworks, setSocialNetworks] = useState<SocialNetworkItem[]>(formatSocialNetworks());
  const [activeNetwork, setActiveNetwork] = useState('tiktok');
  const [smartCaption, setSmartCaption] = useState('');
  const [bgAudioName, setBgAudioName] = useState('');
  const [bgAudioVolume, setBgAudioVolume] = useState(0.4);
  const [micEnabled, setMicEnabled] = useState(false);
  const [tiktokAccount, setTiktokAccount] = useState<StudioApi['tiktokAccount']>(null);

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

  // TikTok functions
  const refreshTikTokAccount = useCallback(async () => {
    try {
      const response = await fetch('/api/tiktok/account');
      if (!response.ok) {
        // Check if it's a config error
        if (response.status === 503) {
          const errorData = await response.json();
          console.warn('TikTok not configured:', errorData.setupInstructions);
          setTiktokAccount({ 
            connected: false, 
            display_name: 'Configuración pendiente',
            is_expired: false 
          });
          return;
        }
        throw new Error('Failed to fetch account');
      }
      const data = await response.json();
      console.log('[useStudio] TikTok account response:', data);
      setTiktokAccount(data.connected ? { ...data.account, connected: true } : null);
    } catch (error) {
      console.error('Failed to refresh TikTok account:', error);
      setTiktokAccount(null);
    }
  }, []);

  // Debug TikTok config
  const debugTikTokConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/tiktok/debug');
      const data = await response.json();
      console.log('[TikTok Debug]', data);
      return data;
    } catch (error) {
      console.error('Failed to debug TikTok config:', error);
      return null;
    }
  }, []);

  const connectTikTok = useCallback(async () => {
    // First run debug check
    const debugInfo = await debugTikTokConfig();
    
    const response = await fetch('/api/tiktok/auth');
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Check if it's a configuration error
      if (response.status === 503 || errorData.error?.includes('not configured')) {
        const debugMsg = debugInfo ? 
          `\n\nDiagnóstico:\nClient Key: ${debugInfo.checks.clientKey.masked || 'NO CONFIGURADO'}\nRedirect URI: ${debugInfo.checks.redirectUri.value || 'NO CONFIGURADO'}` 
          : '';
        
        alert(
          'TikTok Developer no está configurado.' + debugMsg + '\n\n' +
          'Para conectar TikTok:\n' +
          '1. Ve a https://developers.tiktok.com/ y crea una app\n' +
          '2. En Settings > Basic, copia el Client Key y Secret\n' +
          '3. Agrega a tu .env.local:\n' +
          '   TIKTOK_CLIENT_KEY=awx... (tu key real)\n' +
          '   TIKTOK_CLIENT_SECRET=xxx... (tu secret real)\n' +
          '   TIKTOK_REDIRECT_URI=https://tudominio.com/api/tiktok/callback\n\n' +
          '4. En TikTok Developer, añade el Redirect URI en Auth > Redirect domains\n\n' +
          'O usa modo demo: TIKTOK_DEMO_MODE=true'
        );
        throw new Error('TikTok credentials not configured');
      }
      
      throw new Error(errorData.error || 'Failed to initiate auth');
    }
    
    const data = await response.json();
    
    // Handle demo mode
    if (data.demoMode) {
      // Simulate a demo connection
      setTiktokAccount({
        connected: true,
        display_name: 'Demo Account',
        avatar_url: null,
        is_expired: false,
      });
      alert('Modo Demo activado. Los videos no se publicarán en TikTok real.');
      return;
    }
    
    const { authUrl } = data;
    if (!authUrl) {
      throw new Error('No auth URL received');
    }
    
    console.log('[TikTok] Opening auth URL:', authUrl);
    
    // Open in popup
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl,
      'tiktok-auth',
      `width=${width},height=${height},left=${left},top=${top},popup=true`
    );
    
    if (!popup) {
      window.location.href = authUrl;
      return;
    }
    
    // Poll to detect when popup closes
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        console.log('[TikTok] Popup closed, refreshing account...');
        refreshTikTokAccount();
      }
    }, 500);
    
    // Stop checking after 5 minutes
    setTimeout(() => {
      clearInterval(checkClosed);
    }, 5 * 60 * 1000);
  }, [refreshTikTokAccount]);

  const disconnectTikTok = useCallback(async () => {
    const response = await fetch('/api/tiktok/account', { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to disconnect');
    setTiktokAccount(null);
  }, []);

  const publishToTikTok = useCallback(async (videoBlob: Blob, title: string) => {
    const formData = new FormData();
    formData.append('video', videoBlob, 'video.mp4');
    formData.append('title', title);
    formData.append('privacy_level', 'PUBLIC');
    formData.append('disable_duet', 'false');
    formData.append('disable_stitch', 'false');
    formData.append('disable_comment', 'false');

    const response = await fetch('/api/tiktok/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { success: false, error: result.error || 'Upload failed' };
    }

    return { success: true, share_url: result.share_url };
  }, []);

  useEffect(() => {
    generateSmartCaption();
  }, [generateSmartCaption]);

  // Load TikTok account on mount
  useEffect(() => {
    refreshTikTokAccount();
  }, [refreshTikTokAccount]);

  // Listen for TikTok connection from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TIKTOK_CONNECTED') {
        console.log('[useStudio] TikTok connected message received, refreshing account...');
        refreshTikTokAccount();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshTikTokAccount]);

  return {
    activeTab,
    setActiveTab,
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
    setActiveNetwork,
    tiktokAccount,
    connectTikTok,
    disconnectTikTok,
    publishToTikTok,
    refreshTikTokAccount,
    debugTikTokConfig,
  } satisfies StudioApi;
};
