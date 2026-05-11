'use client';

import React, { useState, useCallback } from 'react';
import { 
    ImagePlus, Type, Sticker, Music2, Video, 
    LayoutGrid, Clock, Hash, Sparkles, Trash2,
    ChevronRight, Plus, Upload, Link2
} from 'lucide-react';
import { useStudioContext } from './context';

const DS = {
    bg: '#09090b',
    surface: '#111114',
    surfaceMid: '#16161a',
    border: '#1e1e24',
    accent: '#e5173f',
    accentDim: 'rgba(229,23,63,0.12)',
    txt: '#e8e8f0',
    sub: '#50505c',
    muted: '#28282e',
} as const;

// Viral content blocks
const CONTENT_BLOCKS = [
    {
        id: 'image',
        name: 'Imagen',
        icon: <ImagePlus size={18} />,
        color: '#22c55e',
        description: 'Agrega una imagen',
        shortcut: 'IMG',
    },
    {
        id: 'video',
        name: 'Video Clip',
        icon: <Video size={18} />,
        color: '#e5173f',
        description: 'Importa un video',
        shortcut: 'VID',
    },
    {
        id: 'text',
        name: 'Texto Viral',
        icon: <Type size={18} />,
        color: '#00f2ea',
        description: 'Texto con estilo TikTok',
        shortcut: 'TXT',
    },
    {
        id: 'sticker',
        name: 'Sticker',
        icon: <Sticker size={18} />,
        color: '#f59e0b',
        description: 'Emoji o sticker animado',
        shortcut: 'STK',
    },
    {
        id: 'hook',
        name: 'Hook 3s',
        icon: <Sparkles size={18} />,
        color: '#a855f7',
        description: 'Primeros 3 segundos virales',
        shortcut: 'HK',
    },
    {
        id: 'sound',
        name: 'Sonido',
        icon: <Music2 size={18} />,
        color: '#ec4899',
        description: 'Música trending o efecto',
        shortcut: 'SND',
    },
];

// Pre-made viral layouts
const VIRAL_LAYOUTS = [
    {
        id: 'breaking',
        name: 'Breaking News',
        preview: '🔴 NOTICIA DE ÚLTIMA HORA',
        duration: 15,
        elements: ['hook', 'image', 'text', 'sound'],
    },
    {
        id: 'comparison',
        name: 'VS Battle',
        preview: '⚔️ Equipo A vs Equipo B',
        duration: 20,
        elements: ['image', 'image', 'text', 'sound'],
    },
    {
        id: 'stats',
        name: 'Stats Card',
        preview: '📊 Estadísticas del jugador',
        duration: 12,
        elements: ['image', 'text', 'text', 'text'],
    },
    {
        id: 'reaction',
        name: 'Reaction',
        preview: '😱 Mi reacción al gol...',
        duration: 18,
        elements: ['video', 'text', 'sticker'],
    },
];

export function ContentBlocks() {
    const { selectedNews, customTitle, setCustomTitle, projectImages, setProjectImages } = useStudioContext();
    const [activeTab, setActiveTab] = useState<'blocks' | 'layouts'>('blocks');
    const [uploading, setUploading] = useState(false);

    const handleUpload = useCallback(async (type: 'image' | 'video') => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = type === 'image' ? 'image/*' : 'video/*';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            
            setUploading(true);
            
            // Create object URL for preview
            const url = URL.createObjectURL(file);
            
            if (type === 'image') {
                setProjectImages([...(projectImages || []), url]);
            }
            
            setUploading(false);
        };
        input.click();
    }, [projectImages, setProjectImages]);

    const addTextBlock = useCallback(() => {
        // Add a text overlay to the canvas
        const newTitle = customTitle ? `${customTitle}\n\n✨ NUEVO TEXTO` : '✨ Texto Viral';
        setCustomTitle(newTitle);
    }, [customTitle, setCustomTitle]);

    const addHook = useCallback(() => {
        const hooks = [
            "🔥 ESTO ES LOCURA...",
            "😱 No vas a creer esto...",
            "⚡ URGENTE:",
            "👀 El secreto de...",
            "💥 INCREÍBLE pero real..."
        ];
        const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
        setCustomTitle(`${randomHook}\n\n${customTitle || ''}`);
    }, [customTitle, setCustomTitle]);

    const applyLayout = useCallback((layout: typeof VIRAL_LAYOUTS[0]) => {
        setCustomTitle(layout.preview);
        // Set template duration
        // This would integrate with the timeline
    }, [setCustomTitle]);

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: DS.txt }}>
                    <LayoutGrid size={16} style={{ color: DS.accent }} />
                    Agregar Contenido
                </h3>
                <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: DS.surface }}>
                    <button
                        onClick={() => setActiveTab('blocks')}
                        className="px-2 py-1 rounded text-[10px] font-medium transition-all"
                        style={{
                            background: activeTab === 'blocks' ? DS.accent : 'transparent',
                            color: activeTab === 'blocks' ? '#fff' : DS.sub,
                        }}
                    >
                        Elementos
                    </button>
                    <button
                        onClick={() => setActiveTab('layouts')}
                        className="px-2 py-1 rounded text-[10px] font-medium transition-all"
                        style={{
                            background: activeTab === 'layouts' ? DS.accent : 'transparent',
                            color: activeTab === 'layouts' ? '#fff' : DS.sub,
                        }}
                    >
                        Layouts
                    </button>
                </div>
            </div>

            {/* Blocks Tab */}
            {activeTab === 'blocks' && (
                <div className="grid grid-cols-3 gap-2">
                    {CONTENT_BLOCKS.map((block) => (
                        <button
                            key={block.id}
                            onClick={() => {
                                if (block.id === 'image' || block.id === 'video') {
                                    handleUpload(block.id as 'image' | 'video');
                                } else if (block.id === 'text') {
                                    addTextBlock();
                                } else if (block.id === 'hook') {
                                    addHook();
                                }
                            }}
                            disabled={uploading}
                            className="p-3 rounded-xl text-center transition-all border-2 hover:scale-105 disabled:opacity-50"
                            style={{
                                background: `${block.color}10`,
                                borderColor: `${block.color}30`,
                            }}
                        >
                            <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2"
                                style={{ background: `${block.color}20`, color: block.color }}
                            >
                                {uploading && (block.id === 'image' || block.id === 'video') ? (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    block.icon
                                )}
                            </div>
                            <p className="text-[10px] font-semibold" style={{ color: DS.txt }}>
                                {block.name}
                            </p>
                            <p className="text-[8px] mt-0.5" style={{ color: DS.sub }}>
                                {block.shortcut}
                            </p>
                        </button>
                    ))}
                </div>
            )}

            {/* Layouts Tab */}
            {activeTab === 'layouts' && (
                <div className="space-y-2">
                    {VIRAL_LAYOUTS.map((layout) => (
                        <button
                            key={layout.id}
                            onClick={() => applyLayout(layout)}
                            className="w-full p-3 rounded-xl text-left transition-all border hover:border-[#e5173f]"
                            style={{ background: DS.surface, borderColor: DS.border }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold" style={{ color: DS.txt }}>
                                    {layout.name}
                                </span>
                                <span className="text-[9px] flex items-center gap-1" style={{ color: DS.sub }}>
                                    <Clock size={10} />
                                    {layout.duration}s
                                </span>
                            </div>
                            <p className="text-[10px]" style={{ color: DS.sub }}>
                                {layout.preview}
                            </p>
                            <div className="flex items-center gap-1 mt-2">
                                {layout.elements.map((el, i) => (
                                    <span 
                                        key={i}
                                        className="px-1.5 py-0.5 rounded text-[8px]"
                                        style={{ background: DS.surfaceMid, color: DS.sub }}
                                    >
                                        {el}
                                    </span>
                                ))}
                                <ChevronRight size={12} className="ml-auto" style={{ color: DS.sub }} />
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Quick Actions */}
            <div className="p-3 rounded-xl space-y-2" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                <p className="text-[10px] font-semibold" style={{ color: DS.txt }}>Acciones Rápidas</p>
                
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => handleUpload('image')}
                        className="py-2 px-3 rounded-lg text-[10px] font-medium flex items-center gap-1.5 transition-all"
                        style={{ background: DS.surfaceMid, color: DS.txt }}
                    >
                        <Upload size={12} />
                        Subir Imagen
                    </button>
                    <button
                        onClick={addHook}
                        className="py-2 px-3 rounded-lg text-[10px] font-medium flex items-center gap-1.5 transition-all"
                        style={{ background: `${DS.accent}15`, color: DS.accent }}
                    >
                        <Sparkles size={12} />
                        Agregar Hook
                    </button>
                </div>
            </div>

            {/* Current Content Preview */}
            {(projectImages?.length || customTitle) && (
                <div className="p-3 rounded-xl" style={{ background: DS.surfaceMid, border: `1px solid ${DS.border}` }}>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold" style={{ color: DS.txt }}>
                            Contenido Actual
                        </p>
                        <span className="text-[9px]" style={{ color: DS.sub }}>
                            {projectImages?.length || 0} imágenes
                        </span>
                    </div>
                    
                    {customTitle && (
                        <p className="text-[10px] line-clamp-2 mb-2" style={{ color: DS.sub }}>
                            {customTitle}
                        </p>
                    )}
                    
                    <div className="flex gap-1 overflow-x-auto">
                        {projectImages?.map((img, i) => (
                            <div 
                                key={i}
                                className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden relative group"
                            >
                                <img src={img} alt="" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => setProjectImages(projectImages.filter((_, idx) => idx !== i))}
                                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={12} style={{ color: '#ef4444' }} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
