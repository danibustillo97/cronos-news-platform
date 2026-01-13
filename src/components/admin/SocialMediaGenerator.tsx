import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Download, Search, Image as ImageIcon, Type, Layout, Share2, Copy, 
  Instagram, Facebook, Smartphone, Hash, ExternalLink, Menu, X, 
  Palette, Video, Music, DollarSign, MonitorPlay, RefreshCw,
  Mic, Square, LayoutList, UploadCloud, Plus
} from 'lucide-react';
import { toast } from 'sonner';

interface NewsItem {
  id: string;
  title: string;
  image_url: string;
  category: string;
  created_at: string;
  slug?: string;
  content?: string;
}

interface ScriptSegment {
  text: string;
  duration: number;
  audioBuffer?: AudioBuffer | null;
  image?: string | null; // Optional image override for this segment
}

// Smart Text Splitter for Vertical Video
const smartSplitText = (text: string, maxChars: number = 110): string[] => {
    // 1. Clean extra spaces
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxChars) return [clean];

    // 2. Split by major punctuation first (Sentence boundaries)
    // We want to keep the punctuation with the sentence
    const sentences = clean.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];

    sentences.forEach(sentence => {
        if (sentence.length <= maxChars) {
            chunks.push(sentence);
        } else {
            // 3. Split long sentences by clauses (commas, colons)
            // Regex matches comma/colon/semicolon and the following space
            const parts = sentence.split(/([,;:])\s+/);
            let current = "";
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                // If part is just punctuation, append to current
                if (part.match(/^[,;:]$/)) {
                    current += part;
                } else {
                    // It's a text part
                    if (current.length > 0) {
                        // We have a previous chunk waiting (with punctuation likely)
                        // Check if adding this part fits
                        if ((current + " " + part).length <= maxChars) {
                            current += (current.endsWith(',') || current.endsWith(';') || current.endsWith(':') ? " " : "") + part;
                        } else {
                            // Push current and start new
                            if (current.trim()) chunks.push(current.trim());
                            current = part;
                        }
                    } else {
                        current = part;
                    }
                }
            }
            if (current.trim()) chunks.push(current.trim());
        }
    });

    return chunks;
};

export default function SocialMediaGenerator() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Customization
  const [customTitle, setCustomTitle] = useState('');
  const [layoutMode, setLayoutMode] = useState<'overlay' | 'split' | 'breaking' | 'minimal'>('overlay');
  const [format, setFormat] = useState<'square' | 'story' | 'video'>('square');
  const [fontSize, setFontSize] = useState(48);
  const [showWatermark, setShowWatermark] = useState(true);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorLogo, setSponsorLogo] = useState<string | null>(null);
  
  // Smart Content
  const [smartCaption, setSmartCaption] = useState('');
  
  // Video State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [videoScript, setVideoScript] = useState<ScriptSegment[]>([]);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const bgGainRef = useRef<GainNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const bgSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const speechTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const [bgAudioName, setBgAudioName] = useState<string>('');
  const [bgAudioVolume, setBgAudioVolume] = useState<number>(0.4);
  const [micEnabled, setMicEnabled] = useState<boolean>(false);
  const [availableVoices, setAvailableVoices] = useState<any[]>([]); // Changed to any for API voices
  const [selectedVoice, setSelectedVoice] = useState<string>('es-MX-DaliaNeural'); // Default Neural Voice
  const [voiceRate, setVoiceRate] = useState<string>('-10%');
  const [voicePitch, setVoicePitch] = useState<string>('+0Hz');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTainted, setIsTainted] = useState(false);
  
  // New State for Multi-Image & YouTube
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [projectImages, setProjectImages] = useState<string[]>([]);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const hasPlayedOutroRef = useRef(false);
  const hasPlayedIntroRef = useRef(false);
  const lastPlayedSegmentIndex = useRef<number>(-1);
  const activeAudioSources = useRef<AudioBufferSourceNode[]>([]);
  const loadRequestId = useRef(0);
  const renderRequestId = useRef(0);

  // UI State
  const [activeTab, setActiveTab] = useState<'content' | 'design' | 'video' | 'audio' | 'sponsor' | 'editor'>('content');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Persistence
  useEffect(() => {
    const savedSettings = localStorage.getItem('nexus_social_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.layoutMode) setLayoutMode(parsed.layoutMode);
        if (parsed.format) setFormat(parsed.format);
        if (parsed.fontSize) setFontSize(parsed.fontSize);
        if (parsed.showWatermark !== undefined) setShowWatermark(parsed.showWatermark);
        if (parsed.sponsorName) setSponsorName(parsed.sponsorName);
        if (parsed.bgAudioVolume !== undefined) setBgAudioVolume(parsed.bgAudioVolume);
        if (parsed.micEnabled !== undefined) setMicEnabled(parsed.micEnabled);
        if (parsed.selectedVoice) setSelectedVoice(parsed.selectedVoice);
        if (parsed.voiceRate) setVoiceRate(parsed.voiceRate);
        if (parsed.voicePitch) setVoicePitch(parsed.voicePitch);
        if (parsed.aspectRatio) setAspectRatio(parsed.aspectRatio);
        // Persist Video Script if it exists and is valid
        if (parsed.videoScript && Array.isArray(parsed.videoScript)) setVideoScript(parsed.videoScript);
      } catch (e) {
        console.error("Error loading settings", e);
      }
    }
  }, []);

  useEffect(() => {
    const settings = {
      layoutMode,
      format,
      fontSize,
      showWatermark,
      sponsorName,
      bgAudioVolume,
      micEnabled,
      selectedVoice,
      voiceRate,
      voicePitch,
      videoScript,
      aspectRatio
    };
    localStorage.setItem('nexus_social_settings', JSON.stringify(settings));
  }, [layoutMode, format, fontSize, showWatermark, sponsorName, bgAudioVolume, micEnabled, selectedVoice, voiceRate, voicePitch, videoScript, aspectRatio]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleNewsSelect = (n: NewsItem) => {
    // Clear previous state to prevent data leaks
    setVideoScript([]);
    setCustomTitle('');
    setSelectedNews(n);
    setProjectImages([n.image_url]); // Initialize with main news image
    // Stop any playing audio
    activeAudioSources.current.forEach(s => { try { s.stop(); } catch {} });
    activeAudioSources.current = [];
  };

  useEffect(() => {
    return () => {
        activeAudioSources.current.forEach(s => { try { s.stop(); } catch {} });
    };
  }, []);

  useEffect(() => {
    fetchNews();
  }, []);

  useEffect(() => {
    // Load Neural Voices from API
    const loadVoices = async () => {
        try {
            const res = await fetch('/api/tts', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                // Prioritize best voices
                const sorted = data.sort((a: any, b: any) => {
                     // Prioritize MX and Neural
                     const score = (v: any) => {
                         if (v.ShortName === 'es-MX-DaliaNeural') return 100;
                         if (v.ShortName === 'es-AR-TomasNeural') return 90;
                         if (v.Locale === 'es-MX') return 80;
                         if (v.Locale === 'es-US') return 70;
                         return 0;
                     };
                     return score(b) - score(a);
                });
                setAvailableVoices(sorted);
                if (sorted.length && !selectedVoice) {
                    setSelectedVoice('es-MX-DaliaNeural');
                }
            }
        } catch (e) {
            console.error("Failed to load voices", e);
        }
    };
    loadVoices();
  }, []);

  /* REMOVED OLD SPEECH SYNTHESIS LOGIC */

  useEffect(() => {
    const channel = supabase
      .channel('realtime:news')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news' }, (payload: any) => {
        const n = payload?.new;
        if (n?.status === 'published') {
          handleNewsSelect({
            id: n.id,
            title: n.title,
            image_url: n.image_url,
            category: n.category,
            created_at: n.created_at,
            slug: n.slug,
            content: n.content
          });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedNews) {
      setCustomTitle(selectedNews.title);
      generateSmartCaption();
      generateVideoScript();
    }
  }, [selectedNews]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (selectedNews && canvasRef.current && format !== 'video') {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      generateCanvas();
    } else if (format === 'video' && selectedNews) {
        startPreviewLoop();
    }
    return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [selectedNews, customTitle, layoutMode, fontSize, showWatermark, format, sponsorName, sponsorLogo, videoScript, aspectRatio]);

  const generateVideoScript = () => {
       if (!selectedNews) return;
       
       // Clean content for script (remove HTML)
       const cleanContent = selectedNews.content 
            ? selectedNews.content.replace(/<[^>]*>?/gm, '')
            : `La noticia de ${selectedNews.category} que está dando la vuelta al mundo.`;

       const segments: {text: string, duration: number, audioBuffer?: AudioBuffer | null}[] = [];
       
       // 1. Intro Hook (EPIC INTRO)
       segments.push({ text: "INTRO_SEQUENCE", duration: 4000 });
       
       segments.push({ text: "⚠️ ÚLTIMA HORA", duration: 1500 });
       segments.push({ text: selectedNews.title.toUpperCase(), duration: 3000 });
       segments.push({ text: "👇 LO QUE PASÓ", duration: 1500 });

       // 2. Smart Splitting
       const chunks = smartSplitText(cleanContent);
       
       chunks.forEach((chunk) => {
            // Calculate approximate duration (min 2.5s)
            // A good reading speed is ~150 words per minute -> ~2.5 words per second.
            // Chars / 15 chars per sec roughly.
            const duration = Math.max(2500, chunk.length * 60); 
            segments.push({ text: chunk, duration: duration });
       });

       // 3. Outro (Extended for Animation)
       segments.push({ text: "OUTRO_SEQUENCE", duration: 4000 });
       
       setVideoScript(segments);
   };

  // --- AUDIO HELPERS (Synthesized Sounds) ---
  
  const playIntroSound = async () => {
    // Soft, Pleasant Intro Swell + Ding
    await ensureAudioContext();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const t = ctx.currentTime;
    const dest = audioDestRef.current;
    
    const connect = (node: AudioNode) => {
        if (dest) node.connect(dest);
        node.connect(ctx.destination);
    };

    // 1. Soft Swell (Sine + Triangle Pad)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(220, t); // A3
    osc1.frequency.linearRampToValueAtTime(440, t + 2); // Slide up to A4
    
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0, t);
    gain1.gain.linearRampToValueAtTime(0.2, t + 1);
    gain1.gain.linearRampToValueAtTime(0, t + 3);
    
    osc1.connect(gain1);
    connect(gain1);
    osc1.start(t);
    osc1.stop(t + 3.5); // Stop after fade out

    // 2. Gentle "Sparkle" (High Pitch Sine Arpeggio)
    const notes = [660, 880, 1100, 1320];
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t + 0.5 + (i * 0.1));
        gain.gain.exponentialRampToValueAtTime(0.05, t + 0.5 + (i * 0.1) + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5 + (i * 0.1) + 1.5);
        
        osc.connect(gain);
        connect(gain);
        osc.start(t + 0.5 + (i * 0.1));
        osc.stop(t + 0.5 + (i * 0.1) + 2.0); // Stop individual notes
    });
  };

  const playOutroSound = async () => {
    // Professional "News Closing" Jingle - Copyright Free (Synthesized)
    // Sound: Deep Whoosh + Impact + High Tech "Ding"
    
    await ensureAudioContext();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const t = ctx.currentTime;
    const dest = audioDestRef.current; // Connect to recording stream
    
    // Helper to connect node to both destination (rec) and speakers (local)
    const connect = (node: AudioNode) => {
        if (dest) node.connect(dest);
        node.connect(ctx.destination);
    };

    // 1. Deep Swish (Low Pass Noise)
    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 1.5);
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connect(noiseGain);
    noise.start(t);
    noise.stop(t + 2.0); // Stop noise source
    
    // 2. Impact "Boom" (Low Sine Drop)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(120, t + 0.5); // Start slightly delayed
    osc1.frequency.exponentialRampToValueAtTime(40, t + 1.5);
    
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0, t + 0.5);
    gain1.gain.linearRampToValueAtTime(0.8, t + 0.6);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 2.5);
    
    osc1.connect(gain1);
    connect(gain1);
    osc1.start(t + 0.5);
    osc1.stop(t + 3.0); // Stop impact oscillator
    
    // 3. Tech "Chime" (Glassy Sound)
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, t + 1.0); // A5
    
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, t + 1.0);
    gain2.gain.linearRampToValueAtTime(0.3, t + 1.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 3.0);
    
    osc2.connect(gain2);
    connect(gain2);
    osc2.start(t + 1.0);
    osc2.stop(t + 3.5); // Stop chime oscillator
  };

  const generateNeuralAudio = async () => {
      if (!videoScript.length) return;
      setIsGeneratingAudio(true);
      
      try {
        await ensureAudioContext();
        const ctx = audioCtxRef.current!;
        if (ctx.state === 'suspended') await ctx.resume();

        const newScript = [...videoScript];
        let hasUpdates = false;
        
        // Process in chunks to avoid rate limits if any
        for (let i = 0; i < newScript.length; i++) {
            const seg = newScript[i];
            if (seg.text === 'INTRO_SEQUENCE' || seg.text === 'OUTRO_SEQUENCE' || seg.text.startsWith('⚠️') || seg.audioBuffer) {
                continue;
            }
            
            try {
                 // Use selected voice or default
                 const voice = selectedVoice || 'es-MX-DaliaNeural';
                 const rate = voiceRate || '-10%';
                 const pitch = voicePitch || '+0Hz';

                 // Add pause/rate params
                 const res = await fetch(`/api/tts?text=${encodeURIComponent(seg.text)}&voice=${voice}&rate=${rate}&pitch=${pitch}`);
                 if (res.ok) {
                     const arrayBuffer = await res.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    newScript[i].audioBuffer = audioBuffer;
                    // Update duration based on actual audio length + padding
                    newScript[i].duration = (audioBuffer.duration * 1000) + 300; 
                    hasUpdates = true;
                }
            } catch (e) {
                console.error("Audio gen error", i, e);
            }
        }

        if (hasUpdates) {
            setVideoScript(newScript);
            // toast.success("Narración generada");
        }
      } catch (err) {
          console.error("Audio generation failed", err);
      } finally {
          setIsGeneratingAudio(false);
      }
  };

  const startPreviewLoop = async () => {
      const currentId = ++renderRequestId.current;
      const canvas = canvasRef.current;
      if (!canvas || !selectedNews) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Canvas Size for Video (Adaptive)
      const width = aspectRatio === '16:9' ? 1920 : 1080;
      const height = aspectRatio === '16:9' ? 1080 : 1920;
      canvas.width = width;
      canvas.height = height;

      try {
          // Pre-load all project images and Sponsor Logo
          const loadedImages = new Map<string, HTMLImageElement>();
          let sponsorImg: HTMLImageElement | null = null;
          
          const loadOne = async (url: string) => {
              if (loadedImages.has(url)) return;
              try {
                  const img = await loadImage(url);
                  loadedImages.set(url, img);
              } catch (e) {
                  console.warn("Failed to load project image", url);
              }
          };
          
          if (sponsorLogo) {
              try {
                  sponsorImg = await loadImage(sponsorLogo);
              } catch (e) {
                  console.warn("Failed to load sponsor logo", e);
              }
          }
          
          await loadOne(selectedNews.image_url);
          // Load others in background or parallel
          projectImages.forEach(url => loadOne(url));
          
          if (currentId !== renderRequestId.current) return;

          const loop = async (timestamp: number) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const elapsed = timestamp - startTimeRef.current;
            
            // Loop total duration based on script
            const totalDuration = videoScript.reduce((acc, seg) => acc + seg.duration, 0) || 15000;
            const progress = (elapsed % totalDuration);

            // AUDIO TRIGGER: Check if we are in Outro range (last 3800ms to allow small offset)
            if (progress > totalDuration - 3800) {
                if (!hasPlayedOutroRef.current) {
                    playOutroSound();
                    hasPlayedOutroRef.current = true;
                }
            } else if (progress < 1000) {
                 hasPlayedOutroRef.current = false;
            }

            // INTRO AUDIO TRIGGER
            if (progress < 100 && !hasPlayedIntroRef.current) {
                playIntroSound();
                hasPlayedIntroRef.current = true;
            } else if (progress > 4000) {
                hasPlayedIntroRef.current = false;
            }
            
            // NEURAL VOICE TRIGGER & CURRENT SEGMENT
            let activeSegmentIndex = -1;
            let currentSegmentStart = 0;
            let currentSegment: ScriptSegment | null = null;
            
            for (let i = 0; i < videoScript.length; i++) {
                const seg = videoScript[i];
                if (progress >= currentSegmentStart && progress < currentSegmentStart + seg.duration) {
                    activeSegmentIndex = i;
                    currentSegment = seg;
                    break;
                }
                currentSegmentStart += seg.duration;
            }

            if (activeSegmentIndex !== -1 && activeSegmentIndex !== lastPlayedSegmentIndex.current) {
                lastPlayedSegmentIndex.current = activeSegmentIndex;
                const seg = videoScript[activeSegmentIndex];
                
                if (seg.audioBuffer && audioCtxRef.current) {
                     // Stop previous voice sources for cleanliness
                     activeAudioSources.current.forEach(s => {
                         try { s.stop(); } catch {}
                     });
                     activeAudioSources.current = [];

                     const source = audioCtxRef.current.createBufferSource();
                     source.buffer = seg.audioBuffer;
                     // Connect to Recorder Destination AND Speakers
                     if (audioDestRef.current) source.connect(audioDestRef.current);
                     source.connect(audioCtxRef.current.destination);
                     source.start();
                     activeAudioSources.current.push(source);
                }
            }
            
            // Reset index on loop restart
            if (progress < 100 && lastPlayedSegmentIndex.current > 0) {
                 lastPlayedSegmentIndex.current = -1;
            }

            // DETERMINE CURRENT IMAGE
            let currentImgUrl = selectedNews.image_url;
            if (currentSegment && currentSegment.image) {
                currentImgUrl = currentSegment.image;
            }
            
            // Ensure image is loaded
            let img = loadedImages.get(currentImgUrl);
            if (!img) {
                // Try to load it quickly if missing (async, might miss a frame)
                 try {
                     img = await loadImage(currentImgUrl);
                     loadedImages.set(currentImgUrl, img);
                 } catch {
                     img = loadedImages.get(selectedNews.image_url)!; // Fallback
                 }
            }
            
            if (img) {
                renderVideoFrame(ctx, img, width, height, progress, totalDuration, sponsorImg);
            }
            
            if (format === 'video') {
                animationRef.current = requestAnimationFrame(loop);
            }
          };
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
          animationRef.current = requestAnimationFrame(loop);

      } catch (error) {
          drawErrorPlaceholder(ctx, width, height);
      }
  };

   const renderVideoFrame = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, timeMs: number, totalDuration: number = 14000, sponsorImg: HTMLImageElement | null = null) => {
       // 1. Dynamic Background (Zoom Effect) - Improved for Mobile Aspect Ratio
       // We use a safe zoom that preserves aspect ratio and doesn't distort
       const zoomLevel = 1 + (timeMs / totalDuration) * 0.15; // Subtle 15% zoom
       
       ctx.save();
       ctx.imageSmoothingEnabled = true;
       ctx.imageSmoothingQuality = 'high';

       // Draw image covering the canvas with zoom
       const ratio = Math.max(w / img.width, h / img.height);
       const scaledW = img.width * ratio * zoomLevel;
       const scaledH = img.height * ratio * zoomLevel;
       const x = (w - scaledW) / 2;
       const y = (h - scaledH) / 2;
       
       ctx.drawImage(img, x, y, scaledW, scaledH);
       ctx.restore();

       // 2. Overlay Gradient (General + Strong Header Vignette)
       const gradient = ctx.createLinearGradient(0, 0, 0, h);
       gradient.addColorStop(0, 'rgba(0,0,0,0.85)');   // Very Dark Top for Header/Title
       gradient.addColorStop(0.25, 'rgba(0,0,0,0.4)'); // Fade out quickly
       gradient.addColorStop(0.5, 'rgba(0,0,0,0.1)');  // Middle clear
       gradient.addColorStop(1, 'rgba(0,0,0,0.9)');    // Dark Bottom (existing)
       ctx.fillStyle = gradient;
       ctx.fillRect(0, 0, w, h);

       // 3. Script Overlay with Transition Logic
       let currentText = "";
       let accumulatedTime = 0;
       let isOutro = false;
       let isIntro = false;
       let segmentStartTime = 0;
       
       for (const segment of videoScript) {
           if (timeMs >= accumulatedTime && timeMs < accumulatedTime + segment.duration) {
               currentText = segment.text;
               if (currentText === 'OUTRO_SEQUENCE') isOutro = true;
               if (currentText === 'INTRO_SEQUENCE') isIntro = true;
               segmentStartTime = accumulatedTime;
               break;
           }
           accumulatedTime += segment.duration;
       }

       // --- INTRO ANIMATION OVERRIDE ---
       if (isIntro) {
           const localTime = timeMs - segmentStartTime;
           
           // A. Clean Background (Image + Gradient)
           // We want the image to be visible but cinematic (maybe B&W or dark)
           ctx.save();
           
           // Zoom Effect (Slow zoom in)
           const introZoom = 1 + (localTime / 4000) * 0.1;
           const ratio = Math.max(w / img.width, h / img.height);
           const scaledW = img.width * ratio * introZoom;
           const scaledH = img.height * ratio * introZoom;
           const ix = (w - scaledW) / 2;
           const iy = (h - scaledH) / 2;
           
           ctx.drawImage(img, ix, iy, scaledW, scaledH);
           
           // Darken Overlay (Fade out slightly at the end)
           const overlayOpacity = Math.max(0.3, 0.7 - (localTime / 4000) * 0.4);
           ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
           ctx.fillRect(0, 0, w, h);
           
           // B. Elements Animation
           
           // 1. NEXUS LOGO (Top Left -> Center -> Top Left)
           // It starts big in center, then moves to top left? Or just fades in?
           // User wants "Epic". Let's do:
           // 0-2s: Logo & Title Center Stage
           // 2-4s: Elements move to final positions? No, just a cut might be cleaner or a quick slide.
           // Let's stick to "Epic Entrance":
           // Logo drops from top. Title fades in.
           
           const easeOutElastic = (t: number) => {
                const c4 = (2 * Math.PI) / 3;
                return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
           };

           // Logo Animation Sequence
           // 1. Drop In (0-1.5s)
           // 2. Stay (1.5s-2.5s)
           // 3. Move to Top-Left (2.5s-3.5s) to match fixed header
           
           const centerLogoSize = 1.8; // Reduced size to prevent overflow
           const finalLogoScale = 0.7;
           const safeMargin = 40;
           const headerY = 60;
           
           // Calculate Center Position (Approximate width for centering)
           // "NEXUS" (5 chars) + "NEWS" (4 chars) + Icon
           const centerVisualWidth = 390 * centerLogoSize;
           const centerX = (w - centerVisualWidth) / 2;
           const centerY = (h / 2) - 150;
           
           let currentScale = centerLogoSize;
           let currentX = centerX;
           let currentY = centerY;
           let currentAlpha = 1;

           if (localTime < 2500) {
               // Phase 1 & 2: Drop In and Hold
               const dropProgress = Math.min(localTime / 1500, 1);
               const dropEase = easeOutElastic(dropProgress);
               currentAlpha = dropProgress;
               // We can add a slight bounce to Y if desired, but keeping it simple
           } else {
               // Phase 3: Move to Top-Left
               const moveProgress = Math.min((localTime - 2500) / 1000, 1);
               // Smooth Ease InOut
               const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
               const p = easeInOut(moveProgress);
               
               currentScale = centerLogoSize + (finalLogoScale - centerLogoSize) * p;
               currentX = centerX + (safeMargin - centerX) * p;
               currentY = centerY + (headerY - centerY) * p;
           }

           // Draw Animated Logo
           ctx.save();
           ctx.globalAlpha = currentAlpha;
           // Ensure we don't draw outside canvas if something goes wrong, but coordinates should be fine
           drawLogo(ctx, currentX, currentY, currentScale, false);
           ctx.restore();

           // 2. Title (Below Logo) - Scale Up
           // Only show title in center during the first phase. 
           // Fade it out when logo moves up? Or keep it?
           // User said "que el titulo se diferencie... y luego se mantenga arriba".
           // The "Fixed Title" is drawn in the standard loop.
           // In Intro, we show the title "Epicly".
           // Let's fade out the INTRO title as the logo moves up, so the standard title takes over smoothly (or we transition it too).
           // Standard title is at Y=150.
           
           if (localTime > 500) {
                const titleProgress = Math.min((localTime - 500) / 1000, 1);
                const titleEase = easeOutElastic(titleProgress);
                
                // Fade out title when logo moves up (at 2.5s)
                let titleAlpha = 1;
                if (localTime > 2500) {
                    titleAlpha = 1 - Math.min((localTime - 2500) / 500, 1);
                }

                if (titleAlpha > 0) {
                    ctx.save();
                    ctx.globalAlpha = titleAlpha;
                    ctx.translate(w/2, h/2 + 50);
                    ctx.scale(titleEase, titleEase);
                    
                    ctx.font = `900 ${fontSize * 1.2}px Arial`;
                    ctx.fillStyle = '#FFFFFF';
                    ctx.shadowColor = '#DC2626';
                    ctx.shadowBlur = 20;
                    ctx.textAlign = 'center';
                    
                    // Wrap title in center
                    const lines = getLines(ctx, customTitle, w - 100);
                    lines.forEach((l, i) => {
                        ctx.fillText(l.trim(), 0, (i * fontSize * 1.3));
                    });
                    
                    ctx.restore();
                }
           }
           
           // 3. Sponsor (Bottom) - Fade In
           if (sponsorName || sponsorLogo) {
               if (localTime > 1500) {
                    const sponsorProgress = Math.min((localTime - 1500) / 1000, 1);
                    ctx.globalAlpha = sponsorProgress;
                    
                    ctx.fillStyle = '#FFFFFF';
                    ctx.textAlign = 'center';
                    ctx.font = 'bold 24px Arial';
                    ctx.fillText('PRESENTADO POR', w/2, h - 150);
                    
                    if (sponsorImg) {
                         // Draw Circular Sponsor Logo
                         const logoSize = 80;
                         const lx = w/2 - logoSize/2;
                         const ly = h - 130;
                         
                         ctx.save();
                         ctx.beginPath();
                         ctx.arc(lx + logoSize/2, ly + logoSize/2, logoSize/2, 0, Math.PI*2);
                         ctx.clip();
                         ctx.fillStyle = 'white';
                         ctx.fillRect(lx, ly, logoSize, logoSize);
                         drawImageCover(ctx, sponsorImg, lx, ly, logoSize, logoSize);
                         ctx.restore();
                         
                         // Name below logo
                         ctx.font = '900 32px Arial';
                         ctx.fillStyle = '#DC2626';
                         ctx.fillText(sponsorName.toUpperCase(), w/2, h - 20);
                    } else {
                         ctx.font = '900 48px Arial';
                         ctx.fillStyle = '#DC2626';
                         ctx.fillText(sponsorName.toUpperCase(), w/2, h - 90);
                    }
                    ctx.globalAlpha = 1;
               }
           }

           ctx.restore();
           return; // Skip standard render for Intro
       }

       // --- OUTRO ANIMATION OVERRIDE ---
       if (isOutro) {
           const localTime = timeMs - segmentStartTime;
           const outroDuration = 4000;
           
           // 1. Fade to Background (Transition)
           ctx.save();
           const fadeProgress = Math.min(localTime / 800, 1); // First 800ms fade
           
           // Dynamic Background: Dark Red Gradient
           const bgGradient = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w);
           bgGradient.addColorStop(0, '#1a0505'); // Deep dark center
           bgGradient.addColorStop(1, '#000000'); // Black edges
           
           ctx.globalAlpha = fadeProgress;
           ctx.fillStyle = bgGradient;
           ctx.fillRect(0, 0, w, h);
           
           // 2. Logo Animation (Move from Top-Left to Center & Scale Up)
           // Initial State (Top Left): x=40, y=60, scale=0.7 (approx size 50)
           // Final State (Center): x=w/2, y=h/2 - 100, scale=3.0
           
           const animProgress = Math.min(Math.max((localTime - 200) / 1200, 0), 1); // Start at 200ms, take 1.2s
           // Ease Out Back function for "Pop" effect
           const ease = (t: number) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
           const easedProgress = ease(animProgress);
           
           const startScale = 0.7;
           const endScale = 1.8; // Reduced from 2.5
           const currentScale = startScale + (endScale - startScale) * easedProgress;
           
           // Start Position (Fixed Header Top-Left)
           const startX = 40; 
           const startY = 60;
           
           // End Position (Center Screen Top-Left)
           const totalLogoWidth = 390 * currentScale; // Dynamic width based on scale
           const finalVisualWidth = 390 * endScale;
           const endX = (w - finalVisualWidth) / 2;
           const endY = (h / 2) - 150;
           
           // Interpolate Top-Left Coordinates
           const currentX = startX + (endX - startX) * easedProgress;
           const currentY = startY + (endY - startY) * easedProgress;
           
           // Draw Logo with Glow
           ctx.shadowColor = '#DC2626';
           ctx.shadowBlur = 30 * easedProgress;
           
           // Use currentX/Y directly as they are top-left coordinates
           drawLogo(ctx, currentX, currentY, currentScale, false); 
           ctx.shadowBlur = 0;
           
           // 3. "SÍGUENOS" Text Animation (Slide Up + Fade In)
           // Starts after logo settles (approx 1.5s localTime)
           if (localTime > 1200) {
               const textProgress = Math.min((localTime - 1200) / 800, 1);
               const textAlpha = textProgress;
               const textYOffset = 50 * (1 - textProgress); // Slide up 50px
               
               ctx.save();
               ctx.globalAlpha = textAlpha;
               ctx.textAlign = 'center';
               
               // "SÍGUENOS PARA MÁS"
               ctx.fillStyle = '#FFFFFF';
               ctx.font = '900 48px Arial';
               ctx.shadowColor = 'black';
               ctx.shadowBlur = 20;
               ctx.fillText("SÍGUENOS PARA MÁS", w/2, h/2 + 50 + textYOffset);
               
               // "@NEXUSNEWS" (Brand Color)
               ctx.fillStyle = '#DC2626';
               ctx.font = '900 64px Arial';
               ctx.fillText("@NEXUSNEWS", w/2, h/2 + 130 + textYOffset);
               
               // Social Icons (Simple Circles representation)
               const iconY = h/2 + 220 + textYOffset;
               ctx.fillStyle = '#FFFFFF';
               ctx.beginPath(); ctx.arc(w/2 - 60, iconY, 15, 0, Math.PI*2); ctx.fill(); // Left dot
               ctx.beginPath(); ctx.arc(w/2, iconY, 15, 0, Math.PI*2); ctx.fill();      // Center dot
               ctx.beginPath(); ctx.arc(w/2 + 60, iconY, 15, 0, Math.PI*2); ctx.fill(); // Right dot
               
               ctx.restore();
           }
           
           ctx.restore();
           return; // Stop rendering other layers (Title, Header, etc)
       }

       // Animated Text Effect (Normal Flow)
       if (currentText) {
           ctx.save();
           
           // Fade In Transition
           const segmentProgress = timeMs - segmentStartTime;
           const fadeDuration = 600; // 600ms fade in
           const textAlpha = Math.min(Math.max(segmentProgress / fadeDuration, 0), 1);
           ctx.globalAlpha = textAlpha;
           
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           
           // Responsive Font Size (Slightly reduced to prevent overflow)
           const isHeadline = currentText === selectedNews?.title.toUpperCase();
           const fontSize = isHeadline ? 60 : 42; // Reduced from 50 to 42 for paragraphs
           ctx.font = `900 ${fontSize}px Arial`;
           
           // Wrap Text Logic
           const maxWidth = w - 120;
           const lineHeight = fontSize * 1.3;
           const words = currentText.split(' ');
           let line = '';
           const lines = [];
           
           for (let n = 0; n < words.length; n++) {
               const testLine = line + words[n] + ' ';
               const metrics = ctx.measureText(testLine);
               if (metrics.width > maxWidth && n > 0) {
                   lines.push(line);
                   line = words[n] + ' ';
               } else {
                   line = testLine;
               }
           }
           lines.push(line);
           
           // --- TEXT LAYOUT & BACKGROUND LOGIC ---
           
           // 1. Calculate Dimensions
           const textBlockHeight = lines.length * lineHeight;
           
           // 2. Positioning: ANCHOR BOTTOM (Grow Upwards)
           // We set a fixed bottom margin (e.g., 200px from bottom)
           // The startY moves up as the text gets longer
           const bottomMargin = 250; 
           const startY = h - bottomMargin - textBlockHeight;
           
           // 3. SMOKE EFFECT BACKGROUND (Linear from Bottom - "Desde abajo entre blanco y rojo")
           const gradientTop = startY - 100; // Start fading out well above the text
           const gradientHeight = h - gradientTop;
           
           ctx.save();
           // Gradient from Bottom (h) to Top (gradientTop)
           const smokeGradient = ctx.createLinearGradient(0, h, 0, gradientTop);
           
           // "Entre blanco y rojo tipo humo" - INVERTED (White at Bottom)
            smokeGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');   // Bottom: Subtle White Mist (Blanco leve abajo)
            smokeGradient.addColorStop(0.3, 'rgba(220, 20, 60, 0.9)');   // Lower-Mid: Vibrant Red taking over
            smokeGradient.addColorStop(0.7, 'rgba(160, 0, 0, 0.8)');     // Upper-Mid: Deep Dark Red for contrast
            smokeGradient.addColorStop(1, 'rgba(160, 0, 0, 0)');         // Top: Transparent (fading out)
           
           ctx.fillStyle = smokeGradient;
           ctx.fillRect(0, gradientTop, w, gradientHeight);
           ctx.restore();
           
           // 4. Draw Text
           ctx.save();
           // Strong shadow and stroke for readability over white/red smoke
           ctx.shadowColor = 'black';
           ctx.shadowBlur = 15;
           ctx.shadowOffsetX = 3;
           ctx.shadowOffsetY = 3;
           
           ctx.lineWidth = 4;
           ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
           
           ctx.fillStyle = '#FFFFFF';
           
           lines.forEach((l, i) => {
               // Draw text centered
               const ly = startY + (i * lineHeight) + lineHeight/2;
               ctx.strokeText(l.trim(), w/2, ly); // Outline first
               ctx.fillText(l.trim(), w/2, ly);   // Fill second
           });
           ctx.restore();
       }

       // 4. Progress Bar
       const progressWidth = (timeMs / totalDuration) * w;
       ctx.fillStyle = '#DC2626';
       ctx.fillRect(0, h - 15, progressWidth, 15);
       
       // --- 5. HEADER LAYOUT (Fixed Top) ---
       const headerY = 60;
       const safeMargin = 40;
       
       // A. NEXUS LOGO (Top Left) - Always visible
       drawLogo(ctx, safeMargin, headerY, 0.7);
       
       // B. SPONSOR (Top Right) - Cleaner, Minimalist
       if (sponsorName || sponsorLogo) {
           ctx.save();
           const spRight = w - safeMargin;
           
           // Draw circular sponsor logo if available
           if (sponsorImg) {
              const logoSize = 50;
              const logoX = spRight - logoSize/2;
              const logoY = headerY + 5; // Centered relative to name
              
              ctx.save();
              ctx.beginPath();
              ctx.arc(logoX, logoY, logoSize/2, 0, Math.PI*2);
              ctx.clip();
              // Draw white background for logo
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(logoX - logoSize/2, logoY - logoSize/2, logoSize, logoSize);
              
              drawImageCover(ctx, sponsorImg, logoX - logoSize/2, logoY - logoSize/2, logoSize, logoSize);
              ctx.restore();
              
              // Adjust text position to the left of the logo
              ctx.textAlign = 'right';
              ctx.textBaseline = 'middle';
              
              // Label
              ctx.font = 'bold 12px Arial';
              ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
              ctx.fillText('PRESENTADO POR', spRight - logoSize - 10, headerY - 10);
              
              // Name
              ctx.font = '900 20px Arial';
              ctx.fillStyle = '#FFFFFF';
              ctx.shadowColor = 'black';
              ctx.shadowBlur = 10;
              ctx.fillText(sponsorName ? sponsorName.toUpperCase() : 'SPONSOR', spRight - logoSize - 10, headerY + 15);
              
           } else {
               // Text only
               ctx.textAlign = 'right';
               ctx.textBaseline = 'middle';
               
               // Label
               ctx.font = 'bold 12px Arial';
               ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
               ctx.fillText('PRESENTADO POR', spRight, headerY - 10);
               
               // Name
               ctx.font = '900 20px Arial';
               ctx.fillStyle = '#FFFFFF';
               ctx.shadowColor = 'black';
               ctx.shadowBlur = 10;
               ctx.fillText(sponsorName ? sponsorName.toUpperCase() : 'SPONSOR', spRight, headerY + 15);
           }
           
           ctx.restore();
       }

       // C. PERSISTENT TITLE (Fixed Below Header) - No Overlap, No Box, Big & Bold
        // "Que se mantenga arriba no tapando... las letras no parecen titulo"
        
        if (selectedNews?.title) {
            ctx.save();
            const titleText = selectedNews.title.toUpperCase();
            const centerX = w / 2;
            
            // Move Title DOWN to avoid logo/sponsor row entirely
            // Header elements are around Y=60-100. Let's put title at Y=150.
            const titleY = 150; 
            
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Style: Big, Impactful, No Background Box
            ctx.font = '900 36px "Arial Black", Arial'; // Increased size and weight
            ctx.fillStyle = '#FFFFFF';
            
            // Strong Shadow/Outline for visibility without the "ugly box"
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 20; // Increased blur for better lift
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Heavy Text Stroke (Outline) to make it pop like a real title
            ctx.lineWidth = 6; 
            ctx.strokeStyle = 'rgba(0,0,0, 1.0)';
            ctx.lineJoin = 'round';
            
            // WRAPPING LOGIC (Multi-line)
            // "Caer hacia abajo" and "Respeta sangrias"
            const maxTitleWidth = w - 80; // 40px margin on each side (more safe)
            const lineHeight = 42; // For 36px font
            
            const words = titleText.split(' ');
            let line = '';
            const lines = [];
            
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxTitleWidth && n > 0) {
                    lines.push(line);
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);
            
            // Draw Lines
            // Adjust starting Y so the block is centered or starts at titleY
            // If we want it "Fixed Below Header" (starting at 150), we just loop down.
            
            ctx.fillStyle = '#FFFFFF';
            
            lines.forEach((l, i) => {
                const ly = titleY + (i * lineHeight);
                ctx.strokeText(l.trim(), centerX, ly);
                ctx.fillText(l.trim(), centerX, ly);
            });
            
            ctx.restore();
        }
    };

  const ensureAudioContext = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioDestRef.current = audioCtxRef.current.createMediaStreamDestination();
      bgGainRef.current = audioCtxRef.current.createGain();
      micGainRef.current = audioCtxRef.current.createGain();
      bgGainRef.current.gain.value = bgAudioVolume;
      micGainRef.current.gain.value = 1.0;
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await ensureAudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioCtxRef.current!.decodeAudioData(arrayBuffer);
      if (bgSourceRef.current) {
        try { bgSourceRef.current.stop(); } catch {}
        bgSourceRef.current.disconnect();
      }
      const source = audioCtxRef.current!.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(bgGainRef.current!);
      bgGainRef.current!.connect(audioDestRef.current!);
      bgSourceRef.current = source;
      setBgAudioName(file.name);
      toast.success('Audio de fondo preparado');
    } catch (err) {
      console.error(err);
      toast.error('Error cargando audio');
    }
  };

  const handleMicToggle = async (enable: boolean) => {
    setMicEnabled(enable);
    if (enable) {
      await ensureAudioContext();
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = mic;
        const micNode = audioCtxRef.current!.createMediaStreamSource(mic);
        micNode.connect(micGainRef.current!);
        micGainRef.current!.connect(audioDestRef.current!);
        toast.success('Micrófono listo');
      } catch (err) {
        console.error(err);
        toast.error('No se pudo acceder al micrófono');
        setMicEnabled(false);
      }
    } else {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    speechTimeoutsRef.current.forEach(id => clearTimeout(id));
    speechTimeoutsRef.current = [];
    setIsSpeaking(false);
  };

  const speakScriptPreview = () => {
    if (!videoScript.length) return;
    stopSpeaking();
    setIsSpeaking(true);

    const voice = availableVoices.find(v => v.name === selectedVoice);
    
    // Queue all segments
    videoScript.forEach((seg, idx) => {
      const utter = new SpeechSynthesisUtterance(seg.text);
      if (voice) utter.voice = voice;
      utter.rate = 1.0;
      utter.pitch = 1.0;
      
      if (idx === videoScript.length - 1) {
          utter.onend = () => setIsSpeaking(false);
      }
      
      window.speechSynthesis?.speak(utter);
    });
    toast.info('Reproduciendo narración...');
  };

  const handleAddProjectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                const url = event.target.result as string;
                setProjectImages(prev => [...prev, url]);
                toast.success("Imagen añadida a la biblioteca local");
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSupabaseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `video-assets/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          // Try to upload to 'media' bucket
          const { error: uploadError, data } = await supabase.storage
              .from('media')
              .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
              .from('media')
              .getPublicUrl(fileName);

          setProjectImages(prev => [...prev, publicUrl]);
          toast.success("Imagen subida a Supabase y lista para usar");
      } catch (error: any) {
          console.error("Upload error", error);
          if (error.message?.includes("Bucket not found") || error.error === "Bucket not found" || (error.statusCode === '404' && error.message?.includes('bucket'))) {
             toast.error("⚠️ Falta Configuración en Supabase", {
                 description: "El bucket 'media' no existe. Copia el SQL de 'supabase_setup.sql' y ejecútalo en tu Supabase SQL Editor.",
                 duration: 10000,
                 action: {
                     label: "Ver SQL",
                     onClick: () => window.open('https://supabase.com/dashboard/project/_/sql', '_blank')
                 }
             });
          } else {
             toast.error("Error subiendo a Supabase: " + (error.message || "Verifica que el bucket 'media' exista y sea público"));
          }
      } finally {
          setIsUploading(false);
      }
  };

  const assignImageToSegment = (segmentIndex: number, imageUrl: string) => {
      const newScript = [...videoScript];
      newScript[segmentIndex].image = imageUrl;
      setVideoScript(newScript);
  };

  const handleRecordVideo = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      setIsRecording(true);
      setRecordingProgress(0);
       
      const stream = canvas.captureStream(30); // 30 FPS
      
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      } catch (e) {
        console.warn('VP9 not supported, falling back to default', e);
        mediaRecorder = new MediaRecorder(stream);
      }
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `nexus-${aspectRatio === '16:9' ? 'youtube' : 'reel'}-${Date.now()}.webm`;
          a.click();
          setIsRecording(false);
          try { bgSourceRef.current?.stop(); } catch {}
          if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
          }
          toast.success('Video generado correctamente!');
      };

      (async () => {
        await ensureAudioContext();
        const canvasStream = stream;
        const tracks = [...canvasStream.getVideoTracks()];
        if (bgSourceRef.current) {
          bgSourceRef.current.start(0);
        }
        if (audioDestRef.current) {
          const audioTracks = audioDestRef.current.stream.getAudioTracks();
          tracks.push(...audioTracks);
        }
        const mixedStream = new MediaStream(tracks as any);
        let mixedRecorder;
        try {
          mixedRecorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm;codecs=vp9' });
        } catch {
          mixedRecorder = new MediaRecorder(mixedStream);
        }
        mediaRecorderRef.current = mixedRecorder;
        mixedRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mixedRecorder.onstop = mediaRecorder.onstop!;
        mixedRecorder.start();
      })();

      // Reset animation to 0 and record exactly one loop
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      
      // Load all images for recording
      const loadedImages = new Map<string, HTMLImageElement>();
      const loadAll = async () => {
          // Pre-load all project images
          for (const url of projectImages) {
              try {
                const i = await loadImage(url);
                loadedImages.set(url, i);
              } catch {}
          }
          if (!loadedImages.has(selectedNews!.image_url)) {
              try {
                const i = await loadImage(selectedNews!.image_url);
                loadedImages.set(selectedNews!.image_url, i);
              } catch {}
          }
      };

      loadAll().then(() => {
        const startTime = performance.now();
        const duration = videoScript.reduce((acc, seg) => acc + seg.duration, 0) || 15000;
        
        // Reset Audio Flag for Recording
        hasPlayedOutroRef.current = false;
        hasPlayedIntroRef.current = false;

        const recordLoop = (timestamp: number) => {
            const elapsed = timestamp - startTime;
            
            if (elapsed >= duration) {
                mediaRecorderRef.current?.stop();
                startPreviewLoop(); // Go back to preview
                return;
            }

            // Trigger Audio during Recording
            if (elapsed > duration - 3800) {
                 if (!hasPlayedOutroRef.current) {
                     playOutroSound();
                     hasPlayedOutroRef.current = true;
                 }
            }

            // Trigger Intro Audio during Recording
            if (elapsed < 100 && !hasPlayedIntroRef.current) {
                playIntroSound();
                hasPlayedIntroRef.current = true;
            }

            // Update Progress
            setRecordingProgress(Math.min(100, (elapsed / duration) * 100));

            // Determine Image
            let currentImgUrl = selectedNews!.image_url;
            let currentSegmentStart = 0;
            for (const seg of videoScript) {
                if (elapsed >= currentSegmentStart && elapsed < currentSegmentStart + seg.duration) {
                    if (seg.image) currentImgUrl = seg.image;
                    break;
                }
                currentSegmentStart += seg.duration;
            }
            
            const img = loadedImages.get(currentImgUrl) || loadedImages.get(selectedNews!.image_url)!;

            // Render
            renderVideoFrame(canvas.getContext('2d')!, img, canvas.width, canvas.height, elapsed, duration, sponsorImg);
            requestAnimationFrame(recordLoop);
        };
        requestAnimationFrame(recordLoop);
      });
  };


  const fetchNews = async () => {
    const currentRequestId = ++loadRequestId.current;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('news')
        .select('id, title, image_url, category, created_at, slug, content')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (data && currentRequestId === loadRequestId.current) {
        setNews(data);
        // Auto-select the latest news for agility
        if (data.length > 0 && !selectedNews) {
          handleNewsSelect(data[0]);
        }
      }
    } finally {
      if (currentRequestId === loadRequestId.current) {
        setLoading(false);
      }
    }
  };

  const generateSmartCaption = () => {
    if (!selectedNews) return;
    const cleanCategory = selectedNews.category.replace(/\s+/g, '');
    const tags = `#${cleanCategory} #NexusNews #Noticias #Deportes #${selectedNews.category.split(' ')[0]}`;
    const link = `https://nexusnews.info/noticia/${selectedNews.slug || selectedNews.id}`;
    setSmartCaption(`${selectedNews.title}\n\n${tags}\n\n📲 Lee más aquí: ${link}`);
  };

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        // Strategy 1: Direct CORS load
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        
        img.onload = () => {
            setIsTainted(false);
            resolve(img);
        };

        img.onerror = () => {
            console.log("Direct CORS failed, trying proxy...");
            
            // Strategy 2: Proxy load (Bypass CORS via server)
            const proxyImg = new Image();
            proxyImg.crossOrigin = "Anonymous";
            proxyImg.src = `/api/proxy-image?url=${encodeURIComponent(url)}`;
            
            proxyImg.onload = () => {
                setIsTainted(false); // Proxy returns clean headers
                resolve(proxyImg);
            };

            proxyImg.onerror = () => {
                console.log("Proxy failed, falling back to tainted mode...");
                
                // Strategy 3: Tainted load (Last resort, no download)
                const taintedImg = new Image();
                taintedImg.src = url; // No crossOrigin
                
                taintedImg.onload = () => {
                    setIsTainted(true);
                    toast.warning("Imagen protegida. Se desactivaron las descargas por seguridad del navegador.");
                    resolve(taintedImg);
                };
                
                taintedImg.onerror = () => {
                    reject(new Error("Failed to load image"));
                };
            };
        };
    });
  };

  const generateCanvas = async () => {
    const currentId = ++renderRequestId.current;
    const canvas = canvasRef.current;
    if (!canvas || !selectedNews) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas Size
    const width = 1080;
    const height = format === 'story' ? 1920 : 1080;
    
    canvas.width = width;
    canvas.height = height;

    try {
        const img = await loadImage(selectedNews.image_url);
        if (currentId !== renderRequestId.current) return;
        
        const renderContent = (logoImg: HTMLImageElement | null) => {
            // 1. Background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // --- LAYOUT LOGIC ---
            if (layoutMode === 'overlay') {
                renderOverlayLayout(ctx, img, width, height);
            } else if (layoutMode === 'split') {
                renderSplitLayout(ctx, img, width, height);
            } else if (layoutMode === 'breaking') {
                renderBreakingLayout(ctx, img, width, height);
            } else if (layoutMode === 'minimal') {
                renderMinimalLayout(ctx, img, width, height);
            }

            // --- COMMON ELEMENTS ---
            if (showWatermark) {
                drawWatermark(ctx, width, height);
            }

            if (sponsorName || logoImg) {
                drawSponsor(ctx, width, height, layoutMode, logoImg);
            }
        };

        if (sponsorLogo) {
            const logoImg = new Image();
            logoImg.src = sponsorLogo;
            logoImg.onload = () => renderContent(logoImg);
            logoImg.onerror = () => renderContent(null);
        } else {
            renderContent(null);
        }

    } catch (error) {
        console.error("Canvas generation error:", error);
        drawErrorPlaceholder(ctx, width, height);
        toast.error("No se pudo cargar la imagen de la noticia.");
    }
  };

  const drawErrorPlaceholder = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'center';
      ctx.font = 'bold 40px Arial';
      ctx.fillText('Imagen No Disponible', w/2, h/2);
      ctx.font = '20px Arial';
      ctx.fillStyle = '#666666';
      ctx.fillText('Intenta seleccionar otra noticia', w/2, h/2 + 50);
  };

  // --- RENDERERS ---

  const renderOverlayLayout = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
    drawImageCover(ctx, img, 0, 0, w, h);
    
    // Sophisticated Gradient
    const gradient = ctx.createLinearGradient(0, h * 0.3, 0, h);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.7)');
    gradient.addColorStop(0.8, 'rgba(0,0,0,0.9)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Top Gradient
    const topGradient = ctx.createLinearGradient(0, 0, 0, 300);
    topGradient.addColorStop(0, 'rgba(0,0,0,0.8)');
    topGradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, w, 300);

    drawLogo(ctx, 50, 50, 1.0);
    
    // Category Pill
    const catText = selectedNews?.category?.toUpperCase() || 'NOTICIAS';
    ctx.font = 'bold 24px Arial';
    const catWidth = ctx.measureText(catText).width;
    
    const pillY = h - 350;
    ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
    drawRoundRect(ctx, 50, pillY, catWidth + 40, 44, 22);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(catText, 70, pillY + 30);

    // Title with enhanced shadow/glow for differentiation
    const titleY = h - 250;
    
    // Glow effect
    ctx.save();
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    wrapText(ctx, customTitle, 50, titleY, w - 100, fontSize * 1.2);
    ctx.restore();
  };

  const renderSplitLayout = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
    // Optimized Split Height: More space for text in Square mode
    const splitH = format === 'story' ? h * 0.65 : h * 0.55;
    
    drawImageCover(ctx, img, 0, 0, w, splitH);
    
    // Bottom Card (White)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, splitH, w, h - splitH);
    
    // Red Accent
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(0, splitH, w, 8); // Slightly thinner accent

    // Compact Header Layout
    const headerStart = splitH + 35; // Moved up
    
    drawLogo(ctx, 50, headerStart, 0.7, true); // Slightly smaller logo (0.8 -> 0.7)

    const catText = selectedNews?.category?.toUpperCase() || 'NOTICIAS';
    ctx.font = 'bold 18px Arial'; // Slightly smaller
    ctx.fillStyle = '#DC2626';
    ctx.fillText(catText + ' • ' + new Date().toLocaleDateString(), 50, headerStart + 80);

    // Title Positioning
    const titleY = headerStart + 130;
    const maxTitleHeight = h - titleY - 40; // Leave 40px padding at bottom
    
    ctx.font = `900 ${fontSize}px Arial`;
    ctx.fillStyle = '#111111';
    
    // Dynamic font scaling if text is too long for the box
    let currentFontSize = fontSize;
    let lines = getLines(ctx, customTitle, w - 100);
    const lineHeightRatio = 1.1;
    
    // Simple auto-fit logic
    while ((lines.length * currentFontSize * lineHeightRatio) > maxTitleHeight && currentFontSize > 24) {
        currentFontSize -= 2;
        ctx.font = `900 ${currentFontSize}px Arial`;
        lines = getLines(ctx, customTitle, w - 100);
    }
    
    wrapText(ctx, customTitle, 50, titleY, w - 100, currentFontSize * lineHeightRatio);
  };

  // Helper to calculate lines without drawing
  const getLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
  };

  const renderBreakingLayout = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
    drawImageCover(ctx, img, 0, 0, w, h);
    
    ctx.fillStyle = 'rgba(20, 0, 0, 0.4)';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 40;
    ctx.strokeRect(0, 0, w, h);

    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.moveTo(0, 80);
    ctx.lineTo(400, 80);
    ctx.lineTo(360, 180);
    ctx.lineTo(0, 180);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 60px Arial';
    ctx.fillText('URGENTE', 40, 150);

    const bottomH = h * 0.4;
    const gradient = ctx.createLinearGradient(0, h - bottomH, 0, h);
    gradient.addColorStop(0, 'rgba(220, 38, 38, 0)');
    gradient.addColorStop(1, 'rgba(220, 38, 38, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, h - bottomH, w, bottomH);

    ctx.shadowColor = 'black';
    ctx.shadowBlur = 10;
    ctx.font = `900 ${fontSize + 10}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    wrapText(ctx, customTitle, w / 2, h - 300, w - 180, (fontSize + 10) * 1.1);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
  };

  const renderMinimalLayout = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
    drawImageCover(ctx, img, 0, 0, w, h);
    
    const gradient = ctx.createLinearGradient(0, h * 0.7, 0, h);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    drawLogo(ctx, w/2 - 85, 50, 0.8);

    ctx.textAlign = 'center';
    ctx.font = `bold ${fontSize - 10}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 15;
    wrapText(ctx, customTitle, w / 2, h - 180, w - 180, fontSize * 1.2);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
  };

  // --- HELPERS ---

  const drawLogo = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1, darkText: boolean = false) => {
    const size = 70 * scale;
    const padding = 20 * scale;
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#DC2626';
    
    const r = 12 * scale;
    drawRoundRect(ctx, x, y, size, size, r);
    ctx.shadowBlur = 0;

    ctx.font = `900 ${42 * scale}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', x + size/2, y + size/2 + (2 * scale));

    ctx.textAlign = 'left';
    ctx.font = `900 ${48 * scale}px Arial`;
    ctx.fillStyle = darkText ? '#111111' : '#FFFFFF';
    ctx.fillText('NEXUS', x + size + padding, y + size/2);

    const nexusWidth = ctx.measureText('NEXUS').width;
    ctx.fillStyle = '#DC2626';
    ctx.fillText('NEWS', x + size + padding + nexusWidth, y + size/2);
  };

  const drawWatermark = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';
    ctx.fillText('WWW.NEXUSNEWS.INFO', w - 50, h - 40);
    ctx.textAlign = 'left';
  };

  const drawSponsor = (ctx: CanvasRenderingContext2D, w: number, h: number, layout: string, logo: HTMLImageElement | null) => {
    ctx.save();
    
    // --- CONFIGURATION ---
    const isSplit = layout === 'split';
    
    // Position Calculation
    let x, y;
    
    if (isSplit) {
      // In Split layout, align with the Nexus Logo in the white card header
      // Recalculate splitH based on format to match renderSplitLayout
      const splitH = format === 'story' ? h * 0.65 : h * 0.55;
      
      // Header starts at splitH + 35
      // Nexus Logo center is roughly at splitH + 35 + 25 = splitH + 60
      
      x = w - 40; 
      y = splitH + 60; // Aligned with logo center
    } else {
      // In other layouts (Overlay, etc), Top Right corner
      x = w - 40;
      y = 60;
    }

    // --- STYLING ---
    const bgColor = isSplit ? '#F3F4F6' : 'rgba(255, 255, 255, 0.95)'; // Light gray on white, almost white on image
    const textColor = '#111827'; // Always dark for readability on the pill
    const accentColor = '#DC2626'; // Red accent
    const shadowColor = 'rgba(0,0,0,0.2)';

    // Dimensions
    const logoSize = 50; // Standardized Circle Diameter
    const padding = 12;
    const gap = 12;
    
    // Calculate Width
    ctx.font = 'bold 18px Arial';
    const nameWidth = sponsorName ? ctx.measureText(sponsorName.toUpperCase()).width : 0;
    
    ctx.font = 'bold 10px Arial';
    const labelText = 'PUBLICIDAD';
    const labelWidth = ctx.measureText(labelText).width;
    
    // Total Width Logic
    // Layout: [Logo (Circle)] [Vertical Stack: Label / Name]
    let totalWidth = padding * 2;
    if (logo) {
      totalWidth += logoSize + gap;
    }
    const textSectionWidth = Math.max(nameWidth, labelWidth);
    totalWidth += textSectionWidth;

    // Badge Position (Top Right Anchor)
    const badgeX = x - totalWidth;
    const badgeY = y - (logoSize / 2) - padding;
    const badgeH = logoSize + (padding * 2);

    // --- DRAWING ---

    // 1. Badge Background (Pill Shape)
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 4;
    
    ctx.fillStyle = bgColor;
    // User requested less rounded ("no tan redondeado"), so we use a smaller radius like 12
    drawRoundRect(ctx, badgeX, badgeY, totalWidth, badgeH, 12); 
    
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 2. Content
    let currentX = badgeX + padding;
    const centerY = badgeY + (badgeH / 2);

    // Draw Logo (Circular & Standardized)
    if (logo) {
      const radius = logoSize / 2;
      const logoCenterX = currentX + radius;
      const logoCenterY = centerY;

      ctx.save();
      ctx.beginPath();
      ctx.arc(logoCenterX, logoCenterY, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      
      // Draw image cover-style in the circle
      // Calculate aspect ratio to cover
      const scale = Math.max(logoSize / logo.width, logoSize / logo.height);
      const dWidth = logo.width * scale;
      const dHeight = logo.height * scale;
      const dx = logoCenterX - (dWidth / 2);
      const dy = logoCenterY - (dHeight / 2);
      
      ctx.fillStyle = '#FFFFFF'; // White bg for transparent logos
      ctx.fill();
      ctx.drawImage(logo, dx, dy, dWidth, dHeight);
      
      // Inner Border for logo
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
      
      currentX += logoSize + gap;
    }

    // Draw Text (Vertical Stack)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Label "PUBLICIDAD" or "PATROCINADO"
    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = '#6B7280'; // Gray 500
    ctx.fillText(labelText, currentX, centerY - 4);

    // Sponsor Name
    if (sponsorName) {
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = textColor;
      ctx.fillText(sponsorName.toUpperCase(), currentX, centerY + 14);
    } else if (!logo) {
       // Fallback if no logo and no name? Should not happen based on UI check
       ctx.font = 'bold 18px Arial';
       ctx.fillStyle = textColor;
       ctx.fillText('SPONSOR', currentX, centerY + 14);
    }

    ctx.restore();
  };

  const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const ratio = Math.max(w / img.width, h / img.height);
    const centerShift_x = (w - img.width * ratio) / 2;
    const centerShift_y = (h - img.height * ratio) / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, img.width, img.height, x + centerShift_x, y + centerShift_y, img.width * ratio, img.height * ratio);
    ctx.restore();
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  };

  const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  };

  const downloadImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `nexus-social-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    toast.success('Imagen descargada correctamente');
  };

  const handleSmartShare = async () => {
    if (!canvasRef.current) return;
    
    try {
      const blob = await new Promise<Blob | null>(resolve => canvasRef.current?.toBlob(resolve, 'image/png'));
      if (!blob) return;

      const file = new File([blob], `nexus-social-${Date.now()}.png`, { type: 'image/png' });

      // 1. Try Native Share (Mobile)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Nexus News',
          text: smartCaption
        });
        toast.success('Compartido con éxito!');
      } else {
        // 2. Desktop Fallback: Clipboard
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          toast.success('📸 Imagen copiada! Pégala en Facebook/Instagram (Ctrl+V)');
        } catch (err) {
          console.error('Clipboard failed', err);
          toast.error('No se pudo copiar. Descargando...');
          downloadImage();
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Error al intentar compartir');
    }
  };

  const copyCaption = () => {
    navigator.clipboard.writeText(smartCaption);
    toast.success('📝 Texto copiado al portapapeles');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSponsorLogo(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSocialAction = async (url: string, platform: string) => {
    // Try Native Share First (Mobile/Tablet)
    if (canvasRef.current && navigator.share && navigator.canShare) {
      try {
        const blob = await new Promise<Blob | null>(resolve => canvasRef.current?.toBlob(resolve, 'image/png'));
        if (blob) {
          const file = new File([blob], `nexus-social-${Date.now()}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Nexus News',
              text: smartCaption
            });
            toast.success('Compartido con éxito!');
            return; // Exit if native share worked
          }
        }
      } catch (e) {
        console.log('Native share failed, falling back to desktop flow', e);
      }
    }

    // Fallback: Desktop Flow (Copy -> Download -> Open)

    // 1. Copy Caption to Clipboard
    try {
      await navigator.clipboard.writeText(smartCaption);
    } catch (e) {
      console.error('Failed to copy text', e);
    }

    // 2. Trigger Download (Ensure user has the file)
    downloadImage();

    // 3. Open Platform
    window.open(url, '_blank');

    // 4. Instructions
    toast.success(`Listos para ${platform}!`, {
      description: 'Imagen descargada y texto copiado. Sube la imagen y pega (Ctrl+V) el texto.',
      duration: 6000, // Longer duration to read
    });
  };

  // --- DYNAMIC TABS LOGIC ---
  const getVisibleTabs = () => {
      const baseTabs = [
          { id: 'content', icon: Layout, label: 'Contenido' },
      ];

      if (format === 'video') {
          baseTabs.push({ id: 'editor', icon: LayoutList, label: 'Editor Studio' }); // New Timeline Editor
          baseTabs.push({ id: 'video', icon: Video, label: 'Guion' });
          baseTabs.push({ id: 'audio', icon: Music, label: 'Audio' });
      } else {
          baseTabs.push({ id: 'design', icon: Palette, label: 'Diseño' });
      }

      baseTabs.push({ id: 'sponsor', icon: DollarSign, label: 'Sponsor' });
      return baseTabs;
  };

  const tabs = getVisibleTabs();

  // Reset active tab if it disappears
  useEffect(() => {
      const visibleIds = tabs.map(t => t.id);
      if (!visibleIds.includes(activeTab)) {
          setActiveTab('content');
      }
  }, [format]);

  const renderActiveTabContent = () => (
    <div className="p-4 space-y-6">
       {activeTab === 'content' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
               {/* MOVED FORMAT SELECTOR HERE FOR BETTER LOGIC */}
               <div className="space-y-2 pb-4 border-b border-white/10">
                   <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                       <Smartphone size={14} /> 1. Elige el Formato
                   </label>
                   <div className="grid grid-cols-3 gap-2">
                       <button 
                       onClick={() => setFormat('square')}
                       className={`p-2 rounded-lg border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${format === 'square' ? 'bg-white text-black border-white shadow-lg scale-105' : 'bg-neutral-900 border-white/10 text-neutral-400 hover:bg-neutral-800'}`}
                       >
                       <Layout size={14} /> Post
                       </button>
                       <button 
                       onClick={() => setFormat('story')}
                       className={`p-2 rounded-lg border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${format === 'story' ? 'bg-white text-black border-white shadow-lg scale-105' : 'bg-neutral-900 border-white/10 text-neutral-400 hover:bg-neutral-800'}`}
                       >
                       <Smartphone size={14} /> Story
                       </button>
                       <button 
                       onClick={() => setFormat('video')}
                       className={`relative p-2 rounded-lg border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${format === 'video' ? 'bg-red-600 text-white border-red-500 shadow-lg scale-105' : 'bg-neutral-900 border-white/10 text-neutral-400 hover:bg-neutral-800'}`}
                       >
                       {format !== 'video' && <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                       <Video size={14} /> Video AI
                       </button>
                   </div>
               </div>

               <div className="space-y-2">
                   <label className="text-xs font-bold text-neutral-500 uppercase">2. Seleccionar Noticia</label>
                   <div className="relative">
                       <Search className="absolute left-3 top-2.5 text-neutral-500" size={16} />
                       <input 
                       type="text" 
                       placeholder="Buscar noticia..."
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       className="w-full bg-black border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:border-red-500 outline-none"
                       />
                   </div>
                   <div className="max-h-60 overflow-y-auto space-y-1 mt-2 custom-scrollbar border border-white/5 rounded-lg p-1">
                       {news.filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase())).map(n => (
                       <div 
                           key={n.id} 
                           onClick={() => handleNewsSelect(n)}
                           className={`p-3 rounded-md cursor-pointer text-sm transition-all ${selectedNews?.id === n.id ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'hover:bg-white/5 text-neutral-300 border border-transparent'}`}
                       >
                           <div className="font-medium line-clamp-2">{n.title}</div>
                           <div className="text-[10px] text-neutral-500 mt-1">{new Date(n.created_at).toLocaleDateString()}</div>
                       </div>
                       ))}
                   </div>
               </div>

               <div className="space-y-2">
                   <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                       <Type size={14} /> Título Personalizado
                   </label>
                   <textarea 
                       value={customTitle}
                       onChange={(e) => setCustomTitle(e.target.value)}
                       className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none h-24 resize-none"
                       placeholder="Escribe un título llamativo..."
                   />
               </div>
           </div>
       )}

       {activeTab === 'design' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="space-y-2">
                   <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                       <Palette size={14} /> Estilo Visual
                   </label>
                   <div className="grid grid-cols-2 gap-2">
                       <button onClick={() => setLayoutMode('overlay')} className={`p-2 rounded-lg border text-xs font-medium ${layoutMode === 'overlay' ? 'bg-white text-black border-white' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}>Premium Overlay</button>
                       <button onClick={() => setLayoutMode('split')} className={`p-2 rounded-lg border text-xs font-medium ${layoutMode === 'split' ? 'bg-white text-black border-white' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}>Magazine Card</button>
                       <button onClick={() => setLayoutMode('breaking')} className={`p-2 rounded-lg border text-xs font-medium ${layoutMode === 'breaking' ? 'bg-red-600 text-white border-red-500' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}>URGENTE</button>
                       <button onClick={() => setLayoutMode('minimal')} className={`p-2 rounded-lg border text-xs font-medium ${layoutMode === 'minimal' ? 'bg-white text-black border-white' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}>Minimalist</button>
                   </div>
               </div>

               <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Tamaño de Fuente: {fontSize}px</label>
                    <input 
                       type="range" 
                       min="24" max="120" 
                       value={fontSize} 
                       onChange={(e) => setFontSize(Number(e.target.value))}
                       className="w-full accent-red-500"
                    />
               </div>

               <div className="flex items-center gap-2">
                    <input 
                       type="checkbox" 
                       checked={showWatermark} 
                       onChange={(e) => setShowWatermark(e.target.checked)}
                       className="rounded border-neutral-700 bg-neutral-800 text-red-500 focus:ring-red-500"
                    />
                    <label className="text-sm text-neutral-300">Mostrar Marca de Agua</label>
               </div>
           </div>
       )}

       {activeTab === 'editor' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
               {/* Media Library */}
               <div className="space-y-4">
                   <div className="flex items-center justify-between">
                       <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                           <ImageIcon size={14} /> Biblioteca de Medios (Supabase)
                       </label>
                       <label className={`cursor-pointer text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-2 transition-all ${isUploading ? 'bg-neutral-800 text-neutral-500' : 'bg-red-600 text-white hover:bg-red-500'}`}>
                           {isUploading ? <RefreshCw className="animate-spin" size={12} /> : <UploadCloud size={12} />}
                           {isUploading ? 'Subiendo...' : 'Subir Imagen'}
                           <input type="file" accept="image/*" onChange={handleSupabaseUpload} className="hidden" disabled={isUploading} />
                       </label>
                   </div>
                   
                   <div className="grid grid-cols-4 gap-2 bg-neutral-900/50 p-3 rounded-lg border border-white/5 min-h-[100px]">
                        <div 
                           onClick={() => {
                               if (editingSegmentIndex !== null && selectedNews) {
                                   assignImageToSegment(editingSegmentIndex, selectedNews.image_url);
                                   setEditingSegmentIndex(null);
                               }
                           }}
                           className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all ${editingSegmentIndex !== null ? 'hover:border-green-500 border-white/20' : 'border-transparent hover:border-white/20'}`}
                        >
                           <img src={selectedNews?.image_url} className="w-full h-full object-cover" />
                           <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white p-1 text-center">Principal</span>
                        </div>
                        {projectImages.map((url, idx) => (
                            <div 
                               key={idx}
                               onClick={() => {
                                   if (editingSegmentIndex !== null) {
                                       assignImageToSegment(editingSegmentIndex, url);
                                       setEditingSegmentIndex(null);
                                   }
                               }}
                               className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all ${editingSegmentIndex !== null ? 'hover:border-green-500 border-white/20' : 'border-transparent hover:border-white/20'}`}
                            >
                               <img src={url} className="w-full h-full object-cover" />
                            </div>
                        ))}
                   </div>
                   <p className="text-[10px] text-neutral-500">
                       {editingSegmentIndex !== null ? <span className="text-green-400 animate-pulse">Selecciona una imagen arriba para asignarla al segmento seleccionado 👇</span> : "Haz clic en una imagen en la línea de tiempo para cambiarla."}
                   </p>
               </div>

               {/* Timeline */}
               <div className="space-y-4">
                    <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                       <LayoutList size={14} /> Línea de Tiempo
                   </label>
                   
                   <div className="space-y-2">
                       {videoScript.map((segment, idx) => {
                            const isIntroOutro = segment.text === 'INTRO_SEQUENCE' || segment.text === 'OUTRO_SEQUENCE';
                            const currentImg = segment.image || selectedNews?.image_url;
                            
                            if (isIntroOutro) return (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-neutral-900/30 rounded-lg border border-white/5 opacity-50">
                                    <div className="w-12 h-12 bg-neutral-800 rounded flex items-center justify-center">
                                        <Video size={16} className="text-neutral-500" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-neutral-400">{segment.text === 'INTRO_SEQUENCE' ? 'INTRO ANIMATION' : 'OUTRO ANIMATION'}</div>
                                        <div className="text-[10px] text-neutral-600">{segment.duration}ms</div>
                                    </div>
                                </div>
                            );

                            return (
                                <div key={idx} className={`flex items-center gap-3 p-3 bg-neutral-900/50 rounded-lg border transition-all ${editingSegmentIndex === idx ? 'border-green-500 bg-green-900/10' : 'border-white/5 hover:bg-neutral-800'}`}>
                                    {/* Image Slot */}
                                    <div 
                                       onClick={() => setEditingSegmentIndex(editingSegmentIndex === idx ? null : idx)}
                                       className="relative w-16 h-16 bg-black rounded-md overflow-hidden cursor-pointer flex-shrink-0 group border border-white/10 hover:border-white/30"
                                    >
                                        <img src={currentImg} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <RefreshCw size={12} className="text-white" />
                                        </div>
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-mono text-neutral-500">Segmento {idx + 1} • {(segment.duration/1000).toFixed(1)}s</span>
                                            {segment.image && (
                                                <button 
                                                   onClick={(e) => { e.stopPropagation(); assignImageToSegment(idx, ''); }}
                                                   className="text-[10px] text-red-400 hover:text-red-300"
                                                >
                                                    Resetear Imagen
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-neutral-300 line-clamp-2">{segment.text}</p>
                                    </div>
                                </div>
                            );
                       })}
                   </div>
               </div>
           </div>
       )}

       {activeTab === 'video' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {format === 'video' && (
                   <div className="space-y-4">
                       <div className="flex items-center justify-between">
                           <label className="text-xs font-bold text-neutral-500 uppercase">Guion Inteligente</label>
                           <div className="flex gap-2">
                               <button onClick={generateNeuralAudio} disabled={isGeneratingAudio || !videoScript.length} className="text-[10px] flex items-center gap-1 text-green-400 hover:text-green-300 disabled:opacity-50">
                                   <Mic size={10} /> {isGeneratingAudio ? 'Generando...' : 'Generar Voces'}
                               </button>
                               <button onClick={generateVideoScript} className="text-[10px] flex items-center gap-1 text-red-400 hover:text-red-300">
                                   <RefreshCw size={10} /> Regenerar
                               </button>
                           </div>
                       </div>
                       
                       <div className="bg-black/50 border border-white/10 rounded-lg p-2 max-h-60 overflow-y-auto space-y-3 custom-scrollbar">
                           {videoScript.map((segment, idx) => (
                               <div key={idx} className="flex gap-2 text-xs items-start group">
                                   <span className="text-neutral-600 font-mono pt-1 w-6">{idx * 2}s</span>
                                   <div className="w-full">
                                        <textarea 
                                            value={segment.text}
                                            onChange={(e) => {
                                                const newScript = [...videoScript];
                                                newScript[idx].text = e.target.value;
                                                // Invalidate audio if text changes
                                                newScript[idx].audioBuffer = null;
                                                setVideoScript(newScript);
                                            }}
                                            className="bg-transparent text-white w-full outline-none border-b border-transparent focus:border-red-500/50 resize-none h-auto overflow-hidden"
                                            rows={2}
                                        />
                                        {segment.audioBuffer && (
                                            <div className="flex items-center gap-1 text-[9px] text-green-500 mt-1">
                                                <Volume2 size={8} /> Audio Generado ({Math.round(segment.duration/100)/10}s)
                                            </div>
                                        )}
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
                )}
           </div>
       )}

       {activeTab === 'audio' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="space-y-4">
                   <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                      <Music size={14} /> Música de Fondo
                   </label>
                   <div className="flex items-center gap-2">
                       <label className="flex-1 cursor-pointer bg-neutral-800 border border-white/10 rounded-lg p-3 flex items-center justify-center gap-2 hover:bg-neutral-700 transition-colors group">
                       <ImageIcon size={16} className="text-neutral-400 group-hover:text-white" />
                       <span className="text-xs text-neutral-300 group-hover:text-white truncate max-w-[150px]">
                           {bgAudioName ? bgAudioName : 'Subir audio (*.mp3)'}
                       </span>
                       <input 
                           type="file" 
                           accept="audio/*"
                           onChange={handleAudioUpload}
                           className="hidden"
                       />
                       </label>
                   </div>
                   <div className="space-y-1">
                       <div className="flex justify-between text-[10px] text-neutral-400">
                           <span>Silencio</span>
                           <span>Volumen {Math.round(bgAudioVolume * 100)}%</span>
                       </div>
                       <input 
                       type="range" 
                       min={0} max={1} step={0.01}
                       value={bgAudioVolume}
                       onChange={(e) => {
                           const v = parseFloat(e.target.value);
                           setBgAudioVolume(v);
                           if (bgGainRef.current) bgGainRef.current.gain.value = v;
                       }}
                       className="w-full accent-green-500"
                       />
                   </div>
               </div>

               <div className="space-y-4 pt-4 border-t border-white/10">
                    <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                      <Mic size={14} /> Narración IA (Beta)
                   </label>
                   
                   <div className="space-y-3">
                       <select 
                            value={selectedVoice}
                            onChange={(e) => setSelectedVoice(e.target.value)}
                            className="w-full bg-neutral-900 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-red-500 transition-colors"
                       >
                            <option value="">-- Seleccionar Voz Neural --</option>
                            {availableVoices.map((v: any) => (
                              <option key={v.ShortName || v.name} value={v.ShortName || v.name}>
                                {v.FriendlyName || v.name} ({v.Locale || v.lang})
                              </option>
                            ))}
                       </select>

                       <div className="grid grid-cols-2 gap-3 p-2 bg-neutral-900/50 rounded-lg border border-white/5">
                           <div className="space-y-1">
                               <div className="flex justify-between text-[10px] text-neutral-400">
                                   <span>Velocidad</span>
                                   <span className="text-white font-mono">{voiceRate}</span>
                               </div>
                               <input 
                                   type="range" 
                                   min={-50} max={50} step={5}
                                   value={parseInt(voiceRate.replace('%', '')) || 0}
                                   onChange={(e) => setVoiceRate(`${e.target.value}%`)}
                                   className="w-full accent-red-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                               />
                           </div>
                           <div className="space-y-1">
                               <div className="flex justify-between text-[10px] text-neutral-400">
                                   <span>Tono</span>
                                   <span className="text-white font-mono">{voicePitch}</span>
                               </div>
                               <input 
                                   type="range" 
                                   min={-20} max={20} step={2}
                                   value={parseInt(voicePitch.replace('Hz', '')) || 0}
                                   onChange={(e) => {
                                       const val = parseInt(e.target.value);
                                       setVoicePitch(`${val >= 0 ? '+' : ''}${val}Hz`);
                                   }}
                                   className="w-full accent-red-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                               />
                           </div>
                       </div>
                       
                       <div className="flex gap-2">
                           <button 
                               onClick={generateNeuralAudio}
                               disabled={isGeneratingAudio || !videoScript.length}
                               className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${isGeneratingAudio ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-white text-black hover:bg-neutral-200'}`}
                           >
                               <MonitorPlay size={14} /> 
                               {isGeneratingAudio ? generationProgress || 'Generando...' : 'Generar y Escuchar'}
                           </button>
                           
                           {isSpeaking && (
                               <button 
                                   onClick={stopSpeaking}
                                   className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                   title="Detener narración"
                               >
                                   <Square size={14} fill="currentColor" />
                               </button>
                           )}
                       </div>

                       <div className="flex items-center gap-2 pt-2">
                           <label className={`flex-1 py-2 rounded-lg text-xs border flex items-center justify-center gap-2 cursor-pointer transition-colors ${micEnabled ? 'bg-red-900/20 border-red-500/50 text-red-400' : 'bg-neutral-800 border-white/10 text-neutral-400 hover:bg-neutral-700'}`}>
                               <input 
                                   type="checkbox" 
                                   checked={micEnabled}
                               onChange={(e) => handleMicToggle(e.target.checked)}
                               className="hidden"
                           />
                           <span>{micEnabled ? 'Micrófono ON' : 'Activar Mic'}</span>
                       </label>
                   </div>
               </div>
           </div>
           </div>
       )}

       {activeTab === 'sponsor' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="p-4 bg-gradient-to-br from-yellow-900/10 to-transparent border border-yellow-500/20 rounded-lg">
                   <h3 className="text-yellow-500 font-bold text-sm mb-2 flex items-center gap-2">
                       <DollarSign size={16} /> Monetización
                   </h3>
                   <p className="text-xs text-neutral-400 mb-4">Añade branding de patrocinadores a tus noticias.</p>
                   
                   <div className="space-y-4">
                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-neutral-500 uppercase">Nombre del Patrocinador</label>
                           <input 
                               type="text" 
                               placeholder="Ej: COCA-COLA"
                               value={sponsorName}
                               onChange={(e) => setSponsorName(e.target.value)}
                               className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-white focus:border-yellow-500/50 outline-none"
                           />
                       </div>

                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-neutral-500 uppercase">Logo</label>
                           <div className="flex items-center gap-2">
                               <label className="flex-1 cursor-pointer bg-neutral-800 border border-white/10 rounded-lg p-2 flex items-center justify-center gap-2 hover:bg-neutral-700 transition-colors h-12">
                                   <ImageIcon size={16} className="text-neutral-400" />
                                   <span className="text-xs text-neutral-300">
                                       {sponsorLogo ? 'Cambiar Logo' : 'Subir Logo (PNG)'}
                                   </span>
                                   <input 
                                       type="file" 
                                       accept="image/*"
                                       onChange={handleLogoUpload}
                                       className="hidden"
                                   />
                               </label>
                               
                               {sponsorLogo && (
                                   <button 
                                   onClick={() => setSponsorLogo(null)}
                                   className="h-12 w-12 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg border border-red-500/30 hover:bg-red-900/40"
                                   >
                                   <X size={16} />
                                   </button>
                               )}
                           </div>
                       </div>
                   </div>
               </div>
           </div>
       )}
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:flex-row bg-black text-white overflow-hidden font-sans">
      
      {/* ---------------- MOBILE HEADER ---------------- */}
      <div className="md:hidden flex items-center justify-between p-3 border-b border-white/10 bg-neutral-900 z-50">
        <h2 className="text-sm font-bold flex items-center gap-2">
            <Share2 className="text-red-500" size={18} />
            Social Studio
        </h2>
        <div className="flex gap-2">
            <button onClick={downloadImage} disabled={isTainted} className={`p-2 rounded-lg ${isTainted ? 'bg-white/5 text-neutral-600' : 'bg-white/10 text-white'}`}>
                <Download size={18} />
            </button>
            <button onClick={handleSmartShare} disabled={isTainted} className={`p-2 rounded-lg ${isTainted ? 'bg-white/5 text-neutral-600' : 'bg-purple-600/20 text-purple-400'}`}>
                <Share2 size={18} />
            </button>
        </div>
      </div>

      {/* ---------------- DESKTOP SIDEBAR ---------------- */}
      <div className="hidden md:flex flex-col w-80 bg-neutral-900 border-r border-white/10 h-full z-20 shadow-xl">
         {/* Header */}
         <div className="flex items-center gap-3 p-5 border-b border-white/10 bg-neutral-900">
            <div className="bg-red-500/10 p-2 rounded-lg">
                <Share2 className="text-red-500" size={20} />
            </div>
            <div>
                <h2 className="font-bold text-base leading-none">Social Studio</h2>
                <p className="text-[10px] text-neutral-400 mt-1">Viral Content Generator</p>
            </div>
         </div>

         {/* Desktop Tabs */}
         <div className="grid grid-cols-5 gap-1 p-2 bg-black/20 border-b border-white/5">
            {tabs.map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)} 
                    className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'bg-white text-black shadow-lg scale-105' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                >
                    <tab.icon size={16} />
                    <span className="text-[9px] font-bold uppercase">{tab.label}</span>
                </button>
            ))}
         </div>

         {/* Active Tab Content (Scrollable) */}
         <div className="flex-1 overflow-y-auto custom-scrollbar bg-neutral-900/50">
            {renderActiveTabContent()}
         </div>
      </div>

      {/* ---------------- MAIN CANVAS AREA ---------------- */}
      <div className="flex-1 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-neutral-950">
         {/* Background Gradient */}
         <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none"></div>
         
         {/* Canvas Wrapper */}
         <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden z-10 pb-20 md:pb-8">
            
            {/* The Canvas */}
            <div 
                className={`relative shadow-2xl rounded-xl overflow-hidden border border-white/10 transition-all duration-500 bg-black group
                ${format === 'story' || format === 'video' 
                    ? aspectRatio === '16:9' 
                        ? 'aspect-video w-full max-w-[90%] md:max-w-[60%]' // YouTube Landscape
                        : 'aspect-[9/16] h-[55vh] md:h-[80vh] max-h-[55vh] md:max-h-[85vh]' // Vertical
                    : 'aspect-square h-[45vh] md:h-[70vh] max-h-[50vh] md:max-h-[80vh]'
                }`}
            >
                <canvas ref={canvasRef} className="w-full h-full object-contain" />
                
                {/* Recording Indicator */}
                {isRecording && (
                    <div className="absolute top-4 right-4 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 animate-pulse shadow-lg z-20">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                        REC {Math.round(recordingProgress)}%
                    </div>
                )}
            </div>

            {/* Desktop Action Bar (Floating) */}
            <div className="hidden md:flex mt-6 items-center gap-3 bg-black/80 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
                {format === 'video' ? (
                     <button 
                        onClick={handleRecordVideo}
                        disabled={isRecording || isTainted}
                        title={isTainted ? "Grabación deshabilitada por seguridad del navegador (CORS)" : "Grabar Video"}
                        className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${isRecording || isTainted ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50'}`}
                     >
                        {isRecording ? <span className="animate-spin"><RefreshCw size={16}/></span> : <Video size={16} />}
                        {isRecording ? 'Grabando...' : 'Grabar Video'}
                     </button>
                ) : (
                    <>
                        <button onClick={downloadImage} disabled={isTainted} title={isTainted ? "Descarga deshabilitada (CORS)" : "Descargar"} className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-transform ${isTainted ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-white text-black hover:bg-neutral-200 hover:scale-105'}`}>
                            <Download size={16} /> Descargar
                        </button>
                        <button onClick={handleSmartShare} disabled={isTainted} title={isTainted ? "Compartir deshabilitado (CORS)" : "Compartir"} className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-transform ${isTainted ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/30 hover:scale-105'}`}>
                            <Share2 size={16} /> Compartir
                        </button>
                    </>
                )}
            </div>
            
            {/* Quick Copy Caption (Mobile & Desktop) */}
            {smartCaption && (
                <div className="absolute bottom-20 md:bottom-24 bg-black/50 border border-white/10 rounded-xl p-2 flex items-center gap-3 backdrop-blur-sm max-w-[90%] md:max-w-md">
                    <p className="text-[10px] text-neutral-400 flex-1 truncate font-mono">{smartCaption}</p>
                    <button onClick={copyCaption} className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-300 transition-colors" title="Copiar Caption">
                        <Copy size={14} />
                    </button>
                </div>
            )}
         </div>
      </div>

      {/* ---------------- MOBILE BOTTOM SHEET & TOOLBAR ---------------- */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col pointer-events-none">
          
          {/* Bottom Sheet Content (Slide Up) */}
          <div 
            className={`pointer-events-auto bg-neutral-900 border-t border-white/10 rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out flex flex-col
            ${isMobileMenuOpen ? 'translate-y-0' : 'translate-y-[100%]'}
            `}
            style={{ maxHeight: '60vh', marginBottom: '60px' /* Space for toolbar */ }}
          >
             {/* Drag Handle / Close */}
             <div 
                className="w-full flex items-center justify-center p-2 border-b border-white/5 cursor-pointer hover:bg-white/5"
                onClick={() => setIsMobileMenuOpen(false)}
             >
                 <div className="w-12 h-1.5 bg-neutral-700 rounded-full"></div>
             </div>

             {/* Content */}
             <div className="overflow-y-auto p-4 custom-scrollbar bg-neutral-900 pb-10">
                 {renderActiveTabContent()}
             </div>
          </div>

          {/* Bottom Toolbar (Fixed) */}
          <div className="pointer-events-auto absolute bottom-0 inset-x-0 h-[60px] bg-black border-t border-white/10 flex items-center justify-around px-2 pb-2 z-50">
             {tabs.map(tab => (
                 <button
                    key={tab.id}
                    onClick={() => {
                        setActiveTab(tab.id as any);
                        setIsMobileMenuOpen(true);
                    }}
                    className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${activeTab === tab.id && isMobileMenuOpen ? 'text-red-500' : 'text-neutral-500'}`}
                 >
                     <tab.icon size={20} className={activeTab === tab.id && isMobileMenuOpen ? 'fill-current' : ''} />
                     <span className="text-[9px] font-medium">{tab.label}</span>
                 </button>
             ))}
          </div>
      </div>

    </div>
  );
}
