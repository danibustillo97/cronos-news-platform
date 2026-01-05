import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Download, Search, Image as ImageIcon, Type, Layout, RefreshCw, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface NewsItem {
  id: string;
  title: string;
  image_url: string;
  category: string;
}

export default function SocialMediaGenerator() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Customization
  const [customTitle, setCustomTitle] = useState('');
  const [layoutMode, setLayoutMode] = useState<'overlay' | 'split' | 'breaking' | 'minimal'>('overlay');
  const [fontSize, setFontSize] = useState(48);
  const [showWatermark, setShowWatermark] = useState(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  useEffect(() => {
    if (selectedNews) {
      setCustomTitle(selectedNews.title);
    }
  }, [selectedNews]);

  useEffect(() => {
    if (selectedNews && canvasRef.current) {
      generateCanvas();
    }
  }, [selectedNews, customTitle, layoutMode, fontSize, showWatermark]);

  const fetchNews = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('news')
      .select('id, title, image_url, category, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (data) setNews(data);
    setLoading(false);
  };

  const generateCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedNews) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas Size (Instagram/FB Post 1080x1080)
    canvas.width = 1080;
    canvas.height = 1080;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = selectedNews.image_url;
    
    img.onload = () => {
      // 1. Background & Base
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- LAYOUT LOGIC ---
      if (layoutMode === 'overlay') {
        renderOverlayLayout(ctx, img);
      } else if (layoutMode === 'split') {
        renderSplitLayout(ctx, img);
      } else if (layoutMode === 'breaking') {
        renderBreakingLayout(ctx, img);
      } else if (layoutMode === 'minimal') {
        renderMinimalLayout(ctx, img);
      }

      // --- COMMON ELEMENTS ---
      if (showWatermark) {
        drawWatermark(ctx);
      }
    };
  };

  // --- RENDERERS ---

  const renderOverlayLayout = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
    // Full Image
    drawImageCover(ctx, img, 0, 0, 1080, 1080);
    
    // Sophisticated Gradient
    const gradient = ctx.createLinearGradient(0, 400, 0, 1080);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.4, 'rgba(0,0,0,0.6)');
    gradient.addColorStop(0.8, 'rgba(0,0,0,0.9)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1080);

    // Top Gradient for Logo
    const topGradient = ctx.createLinearGradient(0, 0, 0, 300);
    topGradient.addColorStop(0, 'rgba(0,0,0,0.8)');
    topGradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, 1080, 300);

    // Content
    drawLogo(ctx, 50, 50, 1.0);
    
    // Category Pill
    const catText = selectedNews?.category?.toUpperCase() || 'NOTICIAS';
    ctx.font = 'bold 24px Arial';
    const catWidth = ctx.measureText(catText).width;
    
    // Glass Pill
    ctx.fillStyle = 'rgba(220, 38, 38, 0.9)'; // Red-600
    drawRoundRect(ctx, 50, 720, catWidth + 40, 44, 22);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(catText, 70, 750);

    // Title
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 20;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    wrapText(ctx, customTitle, 50, 820, 980, fontSize * 1.2);
    ctx.shadowBlur = 0;
  };

  const renderSplitLayout = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
    // Image Top
    drawImageCover(ctx, img, 0, 0, 1080, 650);
    
    // Bottom Card (White/Light Grey)
    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(0, 650, 1080, 430);
    
    // Red Accent Line
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(0, 650, 1080, 12);

    // Logo (Dark Version for Light BG)
    drawLogo(ctx, 50, 690, 0.8, true);

    // Category
    const catText = selectedNews?.category?.toUpperCase() || 'NOTICIAS';
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#DC2626';
    ctx.fillText(catText + ' • ' + new Date().toLocaleDateString(), 50, 800);

    // Title (Dark Text)
    ctx.font = `900 ${fontSize}px Arial`; // Heavier font
    ctx.fillStyle = '#111111';
    wrapText(ctx, customTitle, 50, 850, 980, fontSize * 1.1);
  };

  const renderBreakingLayout = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
    // Image with Red Tint
    drawImageCover(ctx, img, 0, 0, 1080, 1080);
    
    ctx.fillStyle = 'rgba(20, 0, 0, 0.4)';
    ctx.fillRect(0, 0, 1080, 1080);

    // Breaking Frame
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 40;
    ctx.strokeRect(0, 0, 1080, 1080);

    // "URGENTE" Badge
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

    // Bottom Area
    const gradient = ctx.createLinearGradient(0, 600, 0, 1080);
    gradient.addColorStop(0, 'rgba(220, 38, 38, 0)');
    gradient.addColorStop(1, 'rgba(220, 38, 38, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 600, 1080, 480);

    // Title
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 10;
    ctx.font = `900 ${fontSize + 10}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    wrapText(ctx, customTitle, 540, 800, 900, (fontSize + 10) * 1.1);
    ctx.textAlign = 'left'; // Reset
    ctx.shadowBlur = 0;
  };

  const renderMinimalLayout = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
    // Full Image
    drawImageCover(ctx, img, 0, 0, 1080, 1080);
    
    // Very subtle gradient
    const gradient = ctx.createLinearGradient(0, 700, 0, 1080);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1080);

    // Centered Logo
    drawLogo(ctx, 455, 50, 0.8); // Top Center

    // Title centered bottom
    ctx.textAlign = 'center';
    ctx.font = `bold ${fontSize - 10}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 15;
    wrapText(ctx, customTitle, 540, 900, 900, fontSize * 1.2);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
  };

  // --- HELPERS ---

  const drawLogo = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1, darkText: boolean = false) => {
    const size = 70 * scale;
    const padding = 20 * scale;
    
    // Red Box
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#DC2626';
    
    const r = 12 * scale;
    drawRoundRect(ctx, x, y, size, size, r);
    ctx.shadowBlur = 0;

    // "N"
    ctx.font = `900 ${42 * scale}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', x + size/2, y + size/2 + (2 * scale));

    // Text
    ctx.textAlign = 'left';
    ctx.font = `900 ${48 * scale}px Arial`;
    ctx.fillStyle = darkText ? '#111111' : '#FFFFFF';
    ctx.fillText('NEXUS', x + size + padding, y + size/2);

    const nexusWidth = ctx.measureText('NEXUS').width;
    ctx.fillStyle = '#DC2626';
    ctx.fillText('NEWS', x + size + padding + nexusWidth, y + size/2);
  };

  const drawWatermark = (ctx: CanvasRenderingContext2D) => {
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';
    ctx.fillText('WWW.NEXUSNEWS.INFO', 1030, 1040);
    ctx.textAlign = 'left';
  };

  const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const ratio = Math.max(w / img.width, h / img.height);
    const centerShift_x = (w - img.width * ratio) / 2;
    const centerShift_y = (h - img.height * ratio) / 2;
    ctx.save();
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

  return (
    <div className="h-full flex gap-6">
      {/* Left Sidebar: Controls */}
      <div className="w-1/3 bg-neutral-900/50 rounded-xl border border-white/10 p-6 flex flex-col gap-6 overflow-y-auto">
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Share2 className="text-red-500" />
            Social Studio
          </h2>
          <p className="text-sm text-neutral-400">
            Genera imágenes profesionales para Instagram, Facebook y TikTok.
          </p>
        </div>

        {/* News Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-500 uppercase">Seleccionar Noticia</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-neutral-500" size={16} />
            <input 
              type="text" 
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:border-red-500 outline-none"
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 mt-2">
            {news.filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase())).map(n => (
              <div 
                key={n.id} 
                onClick={() => setSelectedNews(n)}
                className={`p-2 rounded cursor-pointer text-sm truncate transition-colors ${selectedNews?.id === n.id ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'hover:bg-white/5 text-neutral-300'}`}
              >
                {n.title}
              </div>
            ))}
          </div>
        </div>

        {selectedNews && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                <Type size={14} /> Texto Personalizado
              </label>
              <textarea 
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none h-24"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                <Layout size={14} /> Diseño
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setLayoutMode('overlay')}
                  className={`p-3 rounded-lg border text-sm font-medium ${layoutMode === 'overlay' ? 'bg-white text-black border-white' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}
                >
                  Premium Overlay
                </button>
                <button 
                  onClick={() => setLayoutMode('split')}
                  className={`p-3 rounded-lg border text-sm font-medium ${layoutMode === 'split' ? 'bg-white text-black border-white' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}
                >
                  Magazine Card
                </button>
                <button 
                  onClick={() => setLayoutMode('breaking')}
                  className={`p-3 rounded-lg border text-sm font-medium ${layoutMode === 'breaking' ? 'bg-red-600 text-white border-red-500' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}
                >
                  URGENTE
                </button>
                <button 
                  onClick={() => setLayoutMode('minimal')}
                  className={`p-3 rounded-lg border text-sm font-medium ${layoutMode === 'minimal' ? 'bg-white text-black border-white' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}
                >
                  Minimalist
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 py-2">
               <input 
                 type="checkbox"
                 id="watermark"
                 checked={showWatermark}
                 onChange={(e) => setShowWatermark(e.target.checked)}
                 className="w-5 h-5 accent-red-500 rounded cursor-pointer"
               />
               <label htmlFor="watermark" className="text-sm text-neutral-300 cursor-pointer select-none">
                 Mostrar Marca de Agua (URL)
               </label>
            </div>

            <div className="space-y-2">
               <label className="text-xs font-bold text-neutral-500 uppercase">Tamaño de Texto: {fontSize}px</label>
               <input 
                 type="range" 
                 min="20" 
                 max="80" 
                 value={fontSize} 
                 onChange={(e) => setFontSize(Number(e.target.value))}
                 className="w-full accent-red-500"
               />
            </div>

            <button 
              onClick={downloadImage}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl font-bold text-white shadow-lg shadow-red-900/20 hover:shadow-red-900/40 transition-all flex items-center justify-center gap-2"
            >
              <Download size={20} />
              Descargar Imagen
            </button>
          </>
        )}
      </div>

      {/* Right Area: Preview */}
      <div className="flex-1 bg-black rounded-xl border border-white/10 flex items-center justify-center p-8 relative">
        <div className="absolute top-4 right-4 bg-neutral-900 px-3 py-1 rounded-full text-xs font-mono text-neutral-500 border border-white/5">
          1080 x 1080 px
        </div>
        
        {selectedNews ? (
          <div className="shadow-2xl shadow-black/50">
             <canvas ref={canvasRef} className="max-w-full max-h-[600px] w-auto h-auto rounded-lg border border-white/10" />
          </div>
        ) : (
          <div className="text-center text-neutral-500">
            <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
            <p>Selecciona una noticia para comenzar</p>
          </div>
        )}
      </div>
    </div>
  );
}
