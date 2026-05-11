'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Play, Pause, Image as ImageIcon, Type, Sparkles, Trash2, 
    ChevronUp, ChevronDown, Wand2, Clock, Layers, Volume2,
    Upload, X, Check, Music, Video, TrendingUp, Target, Trophy,
    Zap, Hash, Share2, Smartphone
} from 'lucide-react';
import { useStudioContext } from './context';

const DS = {
    bg: '#0a0a0b',
    surface: '#141416',
    surfaceHover: '#1a1a1c',
    border: '#27272a',
    accent: '#dc2626',
    txt: '#fafafa',
    txtMuted: '#a1a1aa',
    txtSub: '#71717a',
};

interface Scene {
    id: string;
    type: 'hook' | 'text' | 'image' | 'stat' | 'cta';
    content: string;
    duration: number;
    style?: string;
}

const HOOKS = [
    "🔥 NO VAS A CREER ESTO...",
    "⚡ NOTICIA DE ÚLTIMA HORA",
    "😱 ESTO ACABA DE PASAR",
    "👀 EL SECRETO QUE NADIE CONTEÓ",
    "💥 BOMBA EN EL FÚTBOL",
];

export function StudioEditor() {
    const { 
        news, selectedNews, handleNewsSelect,
        sponsorName, setSponsorName, sponsorLogo, setSponsorLogo,
        isRecording, handleRecordVideo,
        tiktokAccount, connectTikTok, publishToTikTok
    } = useStudioContext();

    const [scenes, setScenes] = useState<Scene[]>([]);
    const [currentScene, setCurrentScene] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeTab, setActiveTab] = useState('news');
    const [isGenerating, setIsGenerating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [title, setTitle] = useState('');

    // Auto-generar de noticia
    useEffect(() => {
        if (selectedNews && scenes.length === 0) {
            generateFromNews();
        }
    }, [selectedNews]);

    // Preview auto-play
    useEffect(() => {
        if (isPlaying && scenes.length > 0) {
            const timer = setTimeout(() => {
                if (currentScene < scenes.length - 1) {
                    setCurrentScene(c => c + 1);
                } else {
                    setIsPlaying(false);
                    setCurrentScene(0);
                }
            }, scenes[currentScene].duration * 1000);
            return () => clearTimeout(timer);
        }
    }, [isPlaying, currentScene, scenes]);

    const generateFromNews = () => {
        if (!selectedNews) return;
        
        const newScenes: Scene[] = [
            {
                id: Date.now().toString(),
                type: 'hook',
                content: HOOKS[Math.floor(Math.random() * HOOKS.length)],
                duration: 3,
                style: 'breaking'
            },
            {
                id: (Date.now() + 1).toString(),
                type: 'image',
                content: selectedNews.image_url || '',
                duration: 4,
                style: 'normal'
            },
            {
                id: (Date.now() + 2).toString(),
                type: 'text',
                content: selectedNews.title,
                duration: 5,
                style: 'normal'
            },
            {
                id: (Date.now() + 3).toString(),
                type: 'text',
                content: (selectedNews.content || 'Más detalles de esta noticia...').substring(0, 100),
                duration: 4,
                style: 'normal'
            },
            {
                id: (Date.now() + 4).toString(),
                type: 'cta',
                content: '👇 ¿Qué opinas? Comenta',
                duration: 3,
                style: 'normal'
            }
        ];
        setScenes(newScenes);
        setCurrentScene(0);
    };

    const addScene = (type: Scene['type']) => {
        const content = type === 'hook' ? '🔥 NUEVO HOOK' : 
                       type === 'cta' ? '👇 Comenta' : 'Nuevo texto';
        const newScene: Scene = {
            id: Date.now().toString(),
            type,
            content,
            duration: type === 'hook' ? 3 : 4,
        };
        setScenes([...scenes, newScene]);
    };

    const updateScene = (index: number, updates: Partial<Scene>) => {
        const newScenes = [...scenes];
        newScenes[index] = { ...newScenes[index], ...updates };
        setScenes(newScenes);
    };

    const moveScene = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === scenes.length - 1) return;
        
        const newScenes = [...scenes];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newScenes[index], newScenes[swapIndex]] = [newScenes[swapIndex], newScenes[index]];
        setScenes(newScenes);
        
        if (currentScene === index) setCurrentScene(swapIndex);
        else if (currentScene === swapIndex) setCurrentScene(index);
    };

    const deleteScene = (index: number) => {
        setScenes(scenes.filter((_, i) => i !== index));
        if (currentScene >= index && currentScene > 0) {
            setCurrentScene(currentScene - 1);
        }
    };

    const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0);
    const filteredNews = news.filter((n: any) => 
        n.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex bg-[#0a0a0b] text-white">
            {/* LEFT SIDEBAR */}
            <div className="w-80 border-r border-[#27272a] flex flex-col bg-[#141416]">
                {/* Header */}
                <div className="h-14 flex items-center px-4 border-b border-[#27272a]">
                    <span className="font-bold">TikTok Studio</span>
                    <span className="ml-auto text-xs text-[#71717a]">{Math.round(totalDuration)}s</span>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#27272a]">
                    {['news', 'templates', 'sponsor', 'publish'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className="flex-1 py-2 text-[11px] font-medium capitalize"
                            style={{
                                background: activeTab === tab ? '#0a0a0b' : 'transparent',
                                color: activeTab === tab ? '#fff' : '#71717a',
                                borderBottom: activeTab === tab ? '2px solid #dc2626' : 'none'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'news' && (
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar noticia..."
                                className="w-full p-2 rounded bg-[#0a0a0b] border border-[#27272a] text-sm"
                            />
                            <div className="space-y-2">
                                {filteredNews.map((n: any) => (
                                    <button
                                        key={n.id}
                                        onClick={() => {
                                            handleNewsSelect(n);
                                            setScenes([]);
                                            setTimeout(generateFromNews, 100);
                                        }}
                                        className="w-full p-3 rounded text-left text-sm border transition-all"
                                        style={{
                                            background: selectedNews?.id === n.id ? '#dc262620' : '#0a0a0b',
                                            borderColor: selectedNews?.id === n.id ? '#dc2626' : '#27272a'
                                        }}
                                    >
                                        <p className="line-clamp-2 text-sm">{n.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#27272a] text-[#a1a1aa]">
                                                {n.category}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-[#71717a] mb-2">Agregar elemento:</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => addScene('text')} className="p-3 rounded bg-[#0a0a0b] border border-[#27272a] text-xs">
                                        <Type size={16} className="mx-auto mb-1" /> Texto
                                    </button>
                                    <button onClick={() => addScene('hook')} className="p-3 rounded bg-[#dc262620] border border-[#dc2626] text-[#dc2626] text-xs">
                                        <Sparkles size={16} className="mx-auto mb-1" /> Hook
                                    </button>
                                    <button onClick={() => addScene('cta')} className="p-3 rounded bg-[#0a0a0b] border border-[#27272a] text-xs">
                                        <Share2 size={16} className="mx-auto mb-1" /> CTA
                                    </button>
                                    <button onClick={() => addScene('stat')} className="p-3 rounded bg-[#0a0a0b] border border-[#27272a] text-xs">
                                        <TrendingUp size={16} className="mx-auto mb-1" /> Stat
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-[#27272a]">
                                <p className="text-xs text-[#71717a] mb-2">Plantillas IA:</p>
                                <button 
                                    onClick={() => {
                                        setIsGenerating(true);
                                        setTimeout(() => {
                                            generateFromNews();
                                            setIsGenerating(false);
                                        }, 1000);
                                    }}
                                    disabled={!selectedNews || isGenerating}
                                    className="w-full p-3 rounded bg-[#7c3aed] text-white text-sm font-medium disabled:opacity-50"
                                >
                                    {isGenerating ? 'Generando...' : '✨ Generar con IA'}
                                </button>
                                
                                <div className="mt-2 space-y-1">
                                    <button className="w-full p-2 rounded bg-[#0a0a0b] border border-[#27272a] text-xs text-left">
                                        ⚔️ VS Battle
                                    </button>
                                    <button className="w-full p-2 rounded bg-[#0a0a0b] border border-[#27272a] text-xs text-left">
                                        📊 Stats Card
                                    </button>
                                    <button className="w-full p-2 rounded bg-[#0a0a0b] border border-[#27272a] text-xs text-left">
                                        🔥 Hot Take
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sponsor' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-[#71717a] block mb-1">Nombre del Sponsor</label>
                                <input
                                    type="text"
                                    value={sponsorName || ''}
                                    onChange={(e) => setSponsorName(e.target.value)}
                                    placeholder="Ej: Nike, Adidas..."
                                    className="w-full p-2 rounded bg-[#0a0a0b] border border-[#27272a] text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[#71717a] block mb-1">Logo</label>
                                <button
                                    onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = 'image/*';
                                        input.onchange = (e) => {
                                            const file = (e.target as HTMLInputElement).files?.[0];
                                            if (file) setSponsorLogo(URL.createObjectURL(file));
                                        };
                                        input.click();
                                    }}
                                    className="w-full p-4 rounded border-2 border-dashed border-[#27272a] flex flex-col items-center"
                                >
                                    {sponsorLogo ? (
                                        <img src={sponsorLogo} alt="" className="h-12 object-contain" />
                                    ) : (
                                        <>
                                            <Upload size={20} className="text-[#71717a] mb-1" />
                                            <span className="text-xs text-[#71717a]">Subir logo</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            {(sponsorName || sponsorLogo) && (
                                <div className="p-3 rounded bg-[#0a0a0b] border border-[#27272a]">
                                    <p className="text-xs text-[#71717a] mb-2">Preview:</p>
                                    <div className="flex items-center gap-2">
                                        {sponsorLogo && <img src={sponsorLogo} alt="" className="w-8 h-8 object-contain" />}
                                        <span className="text-sm">{sponsorName || 'Sponsor'}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'publish' && (
                        <div className="space-y-4">
                            {!tiktokAccount?.connected ? (
                                <button 
                                    onClick={connectTikTok}
                                    className="w-full py-3 rounded bg-[#dc2626] text-white text-sm font-semibold"
                                >
                                    <Smartphone size={16} className="inline mr-2" />
                                    Conectar TikTok
                                </button>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 p-3 rounded bg-[#0a0a0b] border border-[#27272a]">
                                        {tiktokAccount.avatar_url && (
                                            <img src={tiktokAccount.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                                        )}
                                        <div>
                                            <p className="text-sm font-medium">@{tiktokAccount.display_name}</p>
                                            <p className="text-xs text-[#22c55e]">● Conectado</p>
                                        </div>
                                    </div>
                                    
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Título para TikTok..."
                                        className="w-full p-2 rounded bg-[#0a0a0b] border border-[#27272a] text-sm"
                                    />
                                    
                                    <button
                                        onClick={handleRecordVideo}
                                        disabled={isRecording || scenes.length === 0}
                                        className="w-full py-3 rounded bg-green-600 text-white text-sm font-semibold disabled:opacity-50"
                                    >
                                        {isRecording ? 'Grabando...' : '🎥 Grabar Video'}
                                    </button>
                                    
                                    <button
                                        onClick={async () => {
                                            // Aquí iría la publicación real
                                            alert('Video listo para publicar!');
                                        }}
                                        disabled={scenes.length === 0}
                                        className="w-full py-3 rounded bg-[#dc2626] text-white text-sm font-semibold disabled:opacity-50"
                                    >
                                        🚀 Publicar en TikTok
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* CENTER - Canvas */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Toolbar */}
                <div className="h-12 border-b border-[#27272a] flex items-center px-4 bg-[#141416]">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => {
                                if (isPlaying) {
                                    setIsPlaying(false);
                                } else {
                                    setCurrentScene(0);
                                    setIsPlaying(true);
                                }
                            }}
                            disabled={scenes.length === 0}
                            className="px-3 py-1.5 rounded bg-[#2563eb] text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                        >
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                            {isPlaying ? 'Pausa' : 'Preview'}
                        </button>
                        
                        <span className="text-xs text-[#71717a]">
                            Escena {currentScene + 1} de {scenes.length}
                        </span>
                    </div>
                    
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (selectedNews) {
                                    setScenes([]);
                                    setTimeout(generateFromNews, 50);
                                }
                            }}
                            disabled={!selectedNews || isGenerating}
                            className="px-3 py-1.5 rounded bg-[#7c3aed] text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                        >
                            <Wand2 size={14} />
                            IA
                        </button>
                    </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 flex items-center justify-center bg-black p-8">
                    <div className="aspect-[9/16] h-full max-w-[360px] bg-[#141416] rounded overflow-hidden relative">
                        {scenes.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-[#71717a]">
                                <div className="text-center">
                                    <p className="mb-2">Selecciona una noticia</p>
                                    <p className="text-xs">o usa el botón IA para generar</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Scene content */}
                                {scenes.map((scene, idx) => (
                                    <div
                                        key={scene.id}
                                        className="absolute inset-0 flex items-center justify-center p-6 transition-opacity duration-300"
                                        style={{ 
                                            opacity: currentScene === idx ? 1 : 0,
                                            background: idx % 2 === 0 ? '#141416' : '#1a1a1c'
                                        }}
                                    >
                                        {scene.type === 'image' && scene.content && (
                                            <img src={scene.content} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                                        )}
                                        <div className="relative z-10 text-center">
                                            {scene.type === 'hook' && (
                                                <p className="text-2xl font-black text-[#dc2626]">{scene.content}</p>
                                            )}
                                            {scene.type === 'text' && (
                                                <p className="text-xl font-bold">{scene.content}</p>
                                            )}
                                            {scene.type === 'stat' && (
                                                <p className="text-3xl font-black text-[#f59e0b]">{scene.content}</p>
                                            )}
                                            {scene.type === 'cta' && (
                                                <p className="text-lg font-bold text-[#22c55e]">{scene.content}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Progress bar */}
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#27272a]">
                                    <div 
                                        className="h-full bg-[#dc2626] transition-all"
                                        style={{ width: `${((currentScene + 1) / scenes.length) * 100}%` }}
                                    />
                                </div>
                                
                                {/* Playing indicator */}
                                {isPlaying && (
                                    <div className="absolute top-2 left-2 px-2 py-1 bg-red-500/80 rounded text-[10px] flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                        REC
                                    </div>
                                )}
                                
                                {/* Duration */}
                                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-[10px]">
                                    {Math.round(totalDuration)}s
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Timeline */}
                <div className="h-48 border-t border-[#27272a] bg-[#141416] flex flex-col">
                    <div className="h-8 flex items-center px-4 border-b border-[#27272a]">
                        <Layers size={14} className="text-[#71717a] mr-2" />
                        <span className="text-xs text-[#71717a]">Timeline</span>
                        <span className="text-xs text-[#71717a] ml-auto">{scenes.length} escenas</span>
                    </div>
                    <div className="flex-1 overflow-x-auto overflow-y-hidden">
                        <div className="flex gap-2 p-3 min-w-max">
                            {scenes.map((scene, idx) => (
                                <div 
                                    key={scene.id}
                                    onClick={() => setCurrentScene(idx)}
                                    className="w-32 flex-shrink-0 p-3 rounded border cursor-pointer transition-all"
                                    style={{
                                        background: currentScene === idx ? '#dc262620' : '#0a0a0b',
                                        borderColor: currentScene === idx ? '#dc2626' : '#27272a'
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[9px] uppercase text-[#71717a]">{scene.type}</span>
                                        <span className="text-[9px] text-[#71717a]">{scene.duration}s</span>
                                    </div>
                                    <p className="text-[11px] line-clamp-2 mb-2">{scene.content}</p>
                                    
                                    {/* Editable duration */}
                                    <input
                                        type="range"
                                        min={1}
                                        max={10}
                                        value={scene.duration}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            updateScene(idx, { duration: parseInt(e.target.value) });
                                        }}
                                        className="w-full h-1 mb-2"
                                        style={{ accentColor: '#dc2626' }}
                                    />
                                    
                                    {/* Controls */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-0.5">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); moveScene(idx, 'up'); }}
                                                disabled={idx === 0}
                                                className="p-1 rounded hover:bg-[#27272a] disabled:opacity-30 text-[10px]"
                                            >
                                                ↑
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); moveScene(idx, 'down'); }}
                                                disabled={idx === scenes.length - 1}
                                                className="p-1 rounded hover:bg-[#27272a] disabled:opacity-30 text-[10px]"
                                            >
                                                ↓
                                            </button>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); deleteScene(idx); }}
                                            className="p-1 rounded hover:bg-red-500/20 text-red-400"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
