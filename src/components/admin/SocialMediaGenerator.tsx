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
  const [layoutMode, setLayoutMode] = useState<'overlay' | 'split'>('overlay');
  const [fontSize, setFontSize] = useState(40);
  
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
  }, [selectedNews, customTitle, layoutMode, fontSize]);

  const fetchNews = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('news')
      .select('id, title, image_url, category')
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
      // Clear
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (layoutMode === 'overlay') {
        // Draw Image Full Cover
        drawImageCover(ctx, img, 0, 0, 1080, 1080);
        
        // Gradient Overlay
        const gradient = ctx.createLinearGradient(0, 540, 0, 1080);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.8, 'rgba(0,0,0,0.9)');
        gradient.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1080);

      } else {
        // Split Layout
        drawImageCover(ctx, img, 0, 0, 1080, 700);
        
        // Bottom Solid Color
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 700, 1080, 380);
        
        // Accent Line
        ctx.fillStyle = '#DC2626'; // Red
        ctx.fillRect(0, 690, 1080, 10);
      }

      // Draw Logo (Nexus News)
      ctx.font = 'bold 30px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText('NEXUS NEWS', 50, 60);
      
      // Category Tag
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#DC2626';
      ctx.fillText(selectedNews.category?.toUpperCase() || 'NOTICIAS', 50, layoutMode === 'overlay' ? 750 : 750);

      // Draw Title
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      
      const textY = layoutMode === 'overlay' ? 820 : 820;
      wrapText(ctx, customTitle, 50, textY, 980, fontSize + 10);
    };
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
                  Full Overlay
                </button>
                <button 
                  onClick={() => setLayoutMode('split')}
                  className={`p-3 rounded-lg border text-sm font-medium ${layoutMode === 'split' ? 'bg-white text-black border-white' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}
                >
                  Split Card
                </button>
              </div>
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
