'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
    Plus, Image as ImageIcon, Type, Music, Video,
    Trash2, Copy, ChevronRight, Clock, Layers,
    Sparkles, Hash, Upload, X, Check, Play, Pause,
    Wand2, BrainCircuit
} from 'lucide-react';
import { useStudioContext } from './context';
import { PowerTemplatesPanel, type TimelineItem as PowerTimelineItem } from './PowerTemplates';

const DS = {
    bg: '#0a0a0b',
    surface: '#141416',
    surfaceHover: '#1a1a1c',
    border: '#27272a',
    borderLight: '#3f3f46',
    accent: '#dc2626',
    accentHover: '#b91c1c',
    txt: '#fafafa',
    txtMuted: '#a1a1aa',
    txtSub: '#71717a',
} as const;

// Use TimelineItem from PowerTemplates
import type { TimelineItem } from './PowerTemplates';

export function EditorLayout() {
    const { 
        customTitle, setCustomTitle,
        projectImages, setProjectImages,
        isRecording, handleRecordVideo,
        videoScript, setVideoScript,
        selectedNews, news
    } = useStudioContext();
    
    const [timeline, setTimeline] = useState<TimelineItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'news' | 'templates' | 'sponsor' | 'timeline' | 'publish'>('templates');
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewScene, setPreviewScene] = useState(0);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

    // Cargar noticia seleccionada automáticamente
    useEffect(() => {
        if (selectedNews && timeline.length === 0) {
            // Auto-generar escenas básicas de la noticia
            const scenes: TimelineItem[] = [
                {
                    id: `hook-${Date.now()}`,
                    type: 'hook',
                    content: '🔥 ' + (selectedNews.title?.substring(0, 30) || 'NOTICIA') + '...',
                    duration: 3,
                    style: 'breaking'
                },
                {
                    id: `image-${Date.now() + 1}`,
                    type: 'image',
                    content: selectedNews.image_url || '',
                    duration: 5,
                    style: 'normal'
                },
                {
                    id: `text-${Date.now() + 2}`,
                    type: 'text',
                    content: selectedNews.title || 'Título de la noticia',
                    duration: 4,
                    style: 'normal'
                },
                {
                    id: `summary-${Date.now() + 3}`,
                    type: 'text',
                    content: (selectedNews.content || 'Resumen de la noticia...').substring(0, 120),
                    duration: 5,
                    style: 'normal'
                }
            ];
            setTimeline(scenes);
        }
    }, [selectedNews]);

    // Preview auto-play
    useEffect(() => {
        if (isPreviewPlaying && timeline.length > 0) {
            const current = timeline[previewScene];
            if (current) {
                const timer = setTimeout(() => {
                    if (previewScene < timeline.length - 1) {
                        setPreviewScene(p => p + 1);
                    } else {
                        setIsPreviewPlaying(false);
                        setPreviewScene(0);
                    }
                }, current.duration * 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [isPreviewPlaying, previewScene, timeline]);

    // Add item to timeline
    const addToTimeline = useCallback((type: TimelineItem['type']) => {
        const newItem: TimelineItem = {
            id: `item-${Date.now()}`,
            type,
            content: type === 'text' ? 'Nuevo texto' : type === 'hook' ? '🔥 HOOK VIRAL' : '',
            duration: type === 'hook' ? 3 : type === 'image' ? 5 : 4,
        };
        setTimeline([...timeline, newItem]);
    }, [timeline]);

    // Remove from timeline
    const removeFromTimeline = useCallback((id: string) => {
        setTimeline(timeline.filter(item => item.id !== id));
    }, [timeline]);

    // Move item with buttons
    const moveItem = useCallback((id: string, direction: 'up' | 'down') => {
        const idx = timeline.findIndex(i => i.id === id);
        if (idx === -1) return;
        
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= timeline.length) return;
        
        const newTimeline = [...timeline];
        [newTimeline[idx], newTimeline[newIdx]] = [newTimeline[newIdx], newTimeline[idx]];
        setTimeline(newTimeline);
    }, [timeline]);

    // Drag and drop handlers
    const [draggedItem, setDraggedItem] = useState<string | null>(null);
    
    const handleDragStart = (id: string) => {
        setDraggedItem(id);
    };
    
    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedItem || draggedItem === targetId) return;
        
        const draggedIdx = timeline.findIndex(i => i.id === draggedItem);
        const targetIdx = timeline.findIndex(i => i.id === targetId);
        
        if (draggedIdx === -1 || targetIdx === -1) return;
        
        const newTimeline = [...timeline];
        const [removed] = newTimeline.splice(draggedIdx, 1);
        newTimeline.splice(targetIdx, 0, removed);
        setTimeline(newTimeline);
    };
    
    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    // Total duration
    const totalDuration = timeline.reduce((acc, item) => acc + item.duration, 0);

    return (
        <div className="h-full flex flex-col" style={{ background: DS.bg }}>
            {/* Header - Clean & Professional */}
            <div 
                className="h-14 flex items-center justify-between px-4 border-b"
                style={{ background: DS.surface, borderColor: DS.border }}
            >
                <div className="flex items-center gap-4">
                    {/* Brand */}
                    <div className="flex items-center gap-2">
                        <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: DS.accent }}
                        >
                            <Video size={16} style={{ color: '#fff' }} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold" style={{ color: DS.txt }}>TikTok Studio</p>
                            <p className="text-[10px]" style={{ color: DS.txtMuted }}>9:16 • {Math.round(totalDuration)}s</p>
                        </div>
                    </div>

                    <div className="w-px h-6" style={{ background: DS.border }} />

                    {/* Quick Add */}
                    <div className="flex items-center gap-1">
                        <ToolButton icon={<ImageIcon size={14} />} label="Imagen" onClick={() => addToTimeline('image')} />
                        <ToolButton icon={<Type size={14} />} label="Texto" onClick={() => addToTimeline('text')} />
                        <ToolButton icon={<Sparkles size={14} />} label="Hook" onClick={() => addToTimeline('hook')} />
                        <ToolButton icon={<Video size={14} />} label="Video" onClick={() => addToTimeline('video')} />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {[
                        { id: 'news', label: 'Noticias' },
                        { id: 'templates', label: 'Plantillas' },
                        { id: 'sponsor', label: 'Sponsor' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                            style={{
                                background: activeTab === tab.id ? DS.border : 'transparent',
                                color: activeTab === tab.id ? DS.txt : DS.txtMuted,
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                    
                    <div className="w-px h-6 mx-2" style={{ background: DS.border }} />
                    
                    {/* Botón IA */}
                    <button
                        onClick={() => {
                            setIsGenerating(true);
                            setTimeout(() => {
                                // Simular generación IA
                                if (selectedNews) {
                                    const aiScenes: TimelineItem[] = [
                                        {
                                            id: `ai-hook-${Date.now()}`,
                                            type: 'hook',
                                            content: '😱 NO VAS A CREER LO QUE PASÓ...',
                                            duration: 3,
                                            style: 'breaking'
                                        },
                                        {
                                            id: `ai-title-${Date.now() + 1}`,
                                            type: 'text',
                                            content: selectedNews.title,
                                            duration: 4,
                                            style: 'normal'
                                        },
                                        {
                                            id: `ai-cta-${Date.now() + 2}`,
                                            type: 'hook',
                                            content: '👇 MÁS DETALLES EN LOS COMENTARIOS',
                                            duration: 3,
                                            style: 'normal'
                                        }
                                    ];
                                    setTimeline(aiScenes);
                                }
                                setIsGenerating(false);
                            }, 1500);
                        }}
                        disabled={isGenerating || !selectedNews}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                        style={{ background: '#7c3aed', color: '#fff' }}
                    >
                        {isGenerating ? <Sparkles size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        {isGenerating ? 'IA...' : 'IA'}
                    </button>

                    {/* Botón Preview */}
                    <button
                        onClick={() => {
                            if (isPreviewPlaying) {
                                setIsPreviewPlaying(false);
                            } else {
                                setPreviewScene(0);
                                setIsPreviewPlaying(true);
                            }
                        }}
                        disabled={timeline.length === 0}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                        style={{ background: '#2563eb', color: '#fff' }}
                    >
                        {isPreviewPlaying ? <Pause size={14} /> : <Play size={14} />}
                        {isPreviewPlaying ? 'Pausa' : 'Preview'}
                    </button>
                    
                    <button
                        onClick={handleRecordVideo}
                        disabled={isRecording}
                        className="px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                        style={{ background: isRecording ? '#16a34a' : DS.accent, color: '#fff' }}
                    >
                        {isRecording ? <Pause size={14} /> : <Play size={14} />}
                        {isRecording ? 'Grabando...' : 'Grabar'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex min-h-0">
                {/* Left - Canvas Preview */}
                <div className="flex-1 flex flex-col min-h-0" style={{ background: '#000' }}>
                    {/* Canvas */}
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div 
                            className="aspect-[9/16] max-h-full max-w-full rounded-lg overflow-hidden relative"
                            style={{ 
                                background: DS.surface,
                                boxShadow: '0 0 40px rgba(0,0,0,0.5)',
                                width: 'min(360px, 100%)',
                            }}
                        >
                            {/* Preview content - solo muestra la escena actual */}
                            {timeline.length === 0 ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                                    <Plus size={32} style={{ color: DS.borderLight }} />
                                    <p className="text-sm mt-4" style={{ color: DS.txtMuted }}>
                                        {selectedNews ? 'Agrega elementos al timeline' : 'Selecciona una noticia'}
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: DS.txtSub }}>
                                        Click en Noticias → selecciona una
                                    </p>
                                </div>
                            ) : (
                                <div className="w-full h-full relative">
                                    {/* Escena actual del preview */}
                                    {(() => {
                                        const item = timeline[previewScene];
                                        if (!item) return null;
                                        return (
                                            <div className="absolute inset-0 flex items-center justify-center p-6" style={{ background: DS.surface }}>
                                                {item.type === 'text' && (
                                                    <p className="text-2xl font-bold text-center" style={{ color: DS.txt }}>
                                                        {item.content}
                                                    </p>
                                                )}
                                                {item.type === 'hook' && (
                                                    <p className="text-3xl font-black text-center" style={{ color: DS.accent }}>
                                                        {item.content}
                                                    </p>
                                                )}
                                                {item.type === 'image' && item.content && (
                                                    <img src={item.content} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                                )}
                                                {item.type === 'image' && !item.content && (
                                                    <ImageIcon size={64} style={{ color: DS.borderLight }} />
                                                )}
                                                {item.type === 'video' && (
                                                    <Video size={64} style={{ color: DS.borderLight }} />
                                                )}
                                            </div>
                                        );
                                    })()}
                                    
                                    {/* Progress bar */}
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#27272a]">
                                        <div 
                                            className="h-full bg-[#dc2626] transition-all"
                                            style={{ 
                                                width: `${((previewScene + 1) / timeline.length) * 100}%` 
                                            }}
                                        />
                                    </div>
                                    
                                    {/* Scene counter */}
                                    <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 rounded text-[10px] text-white">
                                        {previewScene + 1} / {timeline.length}
                                    </div>
                                    
                                    {/* Playing indicator */}
                                    {isPreviewPlaying && (
                                        <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 bg-red-500/80 rounded text-[10px] text-white">
                                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                            PLAYING
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Duration badge */}
                            <div 
                                className="absolute bottom-2 right-2 px-2 py-1 rounded text-[10px] font-medium"
                                style={{ background: 'rgba(0,0,0,0.7)', color: DS.txt }}
                            >
                                {Math.round(totalDuration)}s
                            </div>
                        </div>
                    </div>

                    {/* Bottom Timeline */}
                    <div 
                        className="h-48 border-t flex flex-col"
                        style={{ background: DS.surface, borderColor: DS.border }}
                    >
                        {/* Timeline Header */}
                        <div 
                            className="h-8 flex items-center px-3 border-b"
                            style={{ borderColor: DS.border }}
                        >
                            <Layers size={12} style={{ color: DS.txtMuted }} />
                            <span className="text-[11px] ml-1.5 font-medium" style={{ color: DS.txtMuted }}>
                                Timeline
                            </span>
                            <span className="text-[11px] ml-auto" style={{ color: DS.txtSub }}>
                                {timeline.length} elementos • {Math.round(totalDuration)}s
                            </span>
                        </div>

                        {/* Timeline Items */}
                        <div className="flex-1 overflow-x-auto overflow-y-hidden">
                            <div className="flex items-stretch h-full p-2 gap-1 min-w-max">
                                {timeline.length === 0 ? (
                                    <div 
                                        className="w-full h-full flex items-center justify-center"
                                        style={{ color: DS.txtSub }}
                                    >
                                        <p className="text-xs">Arrastra elementos aquí o usa los botones de arriba</p>
                                    </div>
                                ) : (
                                    timeline.map((item, idx) => (
                                        <div
                                            key={item.id}
                                            onClick={() => setSelectedItem(item.id)}
                                            className="flex-shrink-0 w-24 rounded-md p-2 cursor-pointer transition-all border-2 flex flex-col gap-1"
                                            style={{
                                                background: selectedItem === item.id ? DS.surfaceHover : DS.bg,
                                                borderColor: selectedItem === item.id ? DS.accent : DS.border,
                                            }}
                                        >
                                            {/* Type icon */}
                                            <div className="flex items-center gap-1">
                                                {item.type === 'image' && <ImageIcon size={10} style={{ color: DS.txtMuted }} />}
                                                {item.type === 'video' && <Video size={10} style={{ color: DS.txtMuted }} />}
                                                {item.type === 'text' && <Type size={10} style={{ color: DS.txtMuted }} />}
                                                {item.type === 'hook' && <Sparkles size={10} style={{ color: DS.accent }} />}
                                                <span className="text-[9px] uppercase" style={{ color: DS.txtSub }}>
                                                    {item.type}
                                                </span>
                                            </div>
                                            
                                            {/* Content preview */}
                                            <div className="flex-1 min-h-0 overflow-hidden">
                                                <p 
                                                    className="text-[10px] line-clamp-3"
                                                    style={{ color: item.type === 'hook' ? DS.accent : DS.txtMuted }}
                                                >
                                                    {item.content || '(sin contenido)'}
                                                </p>
                                            </div>
                                            
                                            {/* Duration & Controls */}
                                            <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: DS.border }}>
                                                <span className="text-[9px]" style={{ color: DS.txtSub }}>
                                                    {item.duration}s
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); moveItem(item.id, 'up'); }}
                                                        disabled={idx === 0}
                                                        className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                                                        style={{ color: DS.txtSub }}
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); moveItem(item.id, 'down'); }}
                                                        disabled={idx === timeline.length - 1}
                                                        className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                                                        style={{ color: DS.txtSub }}
                                                    >
                                                        ↓
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removeFromTimeline(item.id); }}
                                                        className="p-0.5 rounded hover:bg-red-500/20 ml-1"
                                                        style={{ color: DS.txtSub }}
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                {/* Right Panel with Tabs */}
                <div 
                    className="w-72 flex-shrink-0 border-l flex flex-col"
                    style={{ background: DS.surface, borderColor: DS.border }}
                >
                    {/* Right Panel Tabs */}
                    <div className="flex border-b" style={{ borderColor: DS.border }}>
                        {[
                            { id: 'news', label: 'Noticias' },
                            { id: 'templates', label: 'Plantillas' },
                            { id: 'sponsor', label: 'Sponsor' },
                            { id: 'publish', label: 'Publicar' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className="flex-1 py-2 text-[10px] font-medium transition-all border-b-2"
                                style={{
                                    background: activeTab === tab.id ? DS.bg : 'transparent',
                                    borderColor: activeTab === tab.id ? DS.accent : 'transparent',
                                    color: activeTab === tab.id ? DS.txt : DS.txtMuted,
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    
                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto">
                        {activeTab === 'news' ? (
                            <NewsPanel />
                        ) : activeTab === 'templates' ? (
                            <PowerTemplatesPanel onApply={setTimeline} />
                        ) : activeTab === 'sponsor' ? (
                            <SponsorPanel />
                        ) : activeTab === 'timeline' ? (
                            <TimelinePanel 
                                timeline={timeline}
                                selectedItem={selectedItem}
                                onSelect={setSelectedItem}
                                onUpdate={setTimeline}
                            />
                        ) : (
                            <PublishPanel />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Tool Button
function ToolButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all hover:bg-white/5"
            style={{ color: DS.txtMuted }}
        >
            {icon}
            {label}
        </button>
    );
}

// Content Panel
function ContentPanel({ onAdd }: { onAdd: (type: TimelineItem['type']) => void }) {
    const [uploading, setUploading] = useState(false);
    
    const handleUpload = (type: 'image' | 'video') => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = type === 'image' ? 'image/*' : 'video/*';
        input.onchange = () => {
            setUploading(true);
            setTimeout(() => {
                onAdd(type);
                setUploading(false);
            }, 500);
        };
        input.click();
    };

    const contentTypes = [
        { id: 'image', name: 'Imagen', icon: <ImageIcon size={16} />, desc: 'JPG, PNG, WEBP' },
        { id: 'video', name: 'Video', icon: <Video size={16} />, desc: 'MP4, MOV' },
        { id: 'text', name: 'Texto', icon: <Type size={16} />, desc: 'Títulos, captions' },
        { id: 'hook', name: 'Hook 3s', icon: <Sparkles size={16} />, desc: 'Atención inmediata' },
    ];

    return (
        <div className="p-4 space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: DS.txt }}>Agregar Contenido</h3>
            
            <div className="grid grid-cols-2 gap-2">
                {contentTypes.map((type) => (
                    <button
                        key={type.id}
                        onClick={() => type.id === 'image' || type.id === 'video' ? handleUpload(type.id as any) : onAdd(type.id as any)}
                        disabled={uploading}
                        className="p-3 rounded-lg text-left transition-all border hover:border-gray-500 disabled:opacity-50"
                        style={{ background: DS.bg, borderColor: DS.border }}
                    >
                        <div style={{ color: DS.txtMuted }}>{type.icon}</div>
                        <p className="text-xs font-medium mt-2" style={{ color: DS.txt }}>{type.name}</p>
                        <p className="text-[10px]" style={{ color: DS.txtSub }}>{type.desc}</p>
                    </button>
                ))}
            </div>

            <div className="pt-4 border-t" style={{ borderColor: DS.border }}>
                <h4 className="text-xs font-medium mb-2" style={{ color: DS.txtMuted }}>Plantillas</h4>
                <div className="space-y-2">
                    {['Noticia Rápida', 'Comparación VS', 'Stats Card', 'Reacción'].map((name) => (
                        <button
                            key={name}
                            className="w-full p-2 rounded-md text-left text-xs transition-all hover:bg-white/5 flex items-center gap-2"
                            style={{ color: DS.txtMuted }}
                        >
                            <Layers size={12} />
                            {name}
                            <ChevronRight size={12} className="ml-auto" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Timeline Panel
function TimelinePanel({ timeline, selectedItem, onSelect, onUpdate }: any) {
    const selected = timeline.find((i: any) => i.id === selectedItem);
    
    if (!selected) {
        return (
            <div className="p-4 text-center">
                <p className="text-sm" style={{ color: DS.txtMuted }}>Selecciona un elemento</p>
                <p className="text-xs mt-1" style={{ color: DS.txtSub }}>Haz click en el timeline</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: DS.txt }}>Editar Elemento</h3>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded" style={{ background: DS.bg, color: DS.txtSub }}>
                    {selected.type}
                </span>
            </div>

            {/* Content */}
            <div className="space-y-2">
                <label className="text-xs" style={{ color: DS.txtMuted }}>Contenido</label>
                <textarea
                    value={selected.content}
                    onChange={(e) => {
                        const updated = timeline.map((i: any) => 
                            i.id === selected.id ? { ...i, content: e.target.value } : i
                        );
                        onUpdate(updated);
                    }}
                    className="w-full p-2 rounded-md text-xs resize-none outline-none"
                    style={{ background: DS.bg, border: `1px solid ${DS.border}`, color: DS.txt }}
                    rows={4}
                />
            </div>

            {/* Duration */}
            <div className="space-y-2">
                <label className="text-xs" style={{ color: DS.txtMuted }}>Duración: {selected.duration}s</label>
                <input
                    type="range"
                    min={1}
                    max={30}
                    value={selected.duration}
                    onChange={(e) => {
                        const updated = timeline.map((i: any) => 
                            i.id === selected.id ? { ...i, duration: parseInt(e.target.value) } : i
                        );
                        onUpdate(updated);
                    }}
                    className="w-full h-1 rounded-full"
                    style={{ accentColor: DS.accent }}
                />
            </div>

            {/* Actions */}
            <div className="pt-4 border-t flex gap-2" style={{ borderColor: DS.border }}>
                <button
                    className="flex-1 py-2 rounded-md text-xs font-medium transition-all hover:opacity-80"
                    style={{ background: DS.accent, color: '#fff' }}
                >
                    Aplicar
                </button>
                <button
                    onClick={() => onSelect(null)}
                    className="px-3 py-2 rounded-md text-xs font-medium transition-all"
                    style={{ background: DS.bg, color: DS.txtMuted }}
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}

// Publish Panel
function PublishPanel() {
    const { tiktokAccount, connectTikTok } = useStudioContext();
    
    return (
        <div className="p-4 space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: DS.txt }}>Publicar</h3>
            
            {!tiktokAccount?.connected ? (
                <button
                    onClick={connectTikTok}
                    className="w-full py-2.5 rounded-md text-xs font-semibold transition-all"
                    style={{ background: DS.accent, color: '#fff' }}
                >
                    Conectar TikTok
                </button>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 p-2 rounded-md" style={{ background: DS.bg }}>
                        <div className="w-8 h-8 rounded-full overflow-hidden">
                            {tiktokAccount.avatar_url ? (
                                <img src={tiktokAccount.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center" style={{ background: DS.surface }}>
                                    <Video size={14} style={{ color: DS.txtMuted }} />
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-xs font-medium" style={{ color: DS.txt }}>@{tiktokAccount.display_name}</p>
                            <p className="text-[10px]" style={{ color: DS.txtSub }}>Conectado</p>
                        </div>
                    </div>
                    
                    <input
                        type="text"
                        placeholder="Título del video..."
                        className="w-full p-2 rounded-md text-xs outline-none"
                        style={{ background: DS.bg, border: `1px solid ${DS.border}`, color: DS.txt }}
                    />
                    
                    <button
                        className="w-full py-2.5 rounded-md text-xs font-semibold transition-all disabled:opacity-50"
                        style={{ background: '#16a34a', color: '#fff' }}
                    >
                        Publicar en TikTok
                    </button>
                </div>
            )}
        </div>
    );
}

// News Panel
function NewsPanel() {
    const { news, selectedNews, handleNewsSelect, searchTerm, setSearchTerm } = useStudioContext();
    
    const filteredNews = news.filter((n: any) => 
        n.title.toLowerCase().includes((searchTerm || '').toLowerCase())
    );
    
    return (
        <div className="p-4 space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: DS.txt }}>Noticias</h3>
            
            <input
                type="text"
                value={searchTerm || ''}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar noticia..."
                className="w-full p-2 rounded-md text-xs outline-none"
                style={{ background: DS.bg, border: `1px solid ${DS.border}`, color: DS.txt }}
            />
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredNews.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: DS.txtSub }}>
                        No hay noticias
                    </p>
                ) : (
                    filteredNews.map((item: any) => (
                        <button
                            key={item.id}
                            onClick={() => handleNewsSelect(item)}
                            className="w-full p-3 rounded-lg text-left transition-all border hover:border-gray-500"
                            style={{ 
                                background: selectedNews?.id === item.id ? DS.accent + '15' : DS.bg,
                                borderColor: selectedNews?.id === item.id ? DS.accent : DS.border,
                            }}
                        >
                            <p className="text-xs font-medium line-clamp-2" style={{ color: DS.txt }}>
                                {item.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: DS.surface, color: DS.txtMuted }}>
                                    {item.category}
                                </span>
                                <span className="text-[9px]" style={{ color: DS.txtSub }}>
                                    {new Date(item.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </button>
                    ))
                )}
            </div>
            
            {selectedNews && (
                <div className="p-3 rounded-lg border-l-2" style={{ background: DS.bg, borderLeftColor: DS.accent, borderTop: `1px solid ${DS.border}`, borderRight: `1px solid ${DS.border}`, borderBottom: `1px solid ${DS.border}` }}>
                    <p className="text-[10px] font-medium mb-1" style={{ color: DS.accent }}>Seleccionada</p>
                    <p className="text-xs line-clamp-2" style={{ color: DS.txt }}>{selectedNews.title}</p>
                </div>
            )}
        </div>
    );
}

// Sponsor Panel
function SponsorPanel() {
    const { sponsorName, setSponsorName, sponsorLogo, setSponsorLogo } = useStudioContext();
    
    const handleLogoUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const url = URL.createObjectURL(file);
                setSponsorLogo(url);
            }
        };
        input.click();
    };
    
    return (
        <div className="p-4 space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: DS.txt }}>Sponsor</h3>
            
            <div className="space-y-3">
                <div>
                    <label className="text-[10px] block mb-1" style={{ color: DS.txtMuted }}>Nombre</label>
                    <input
                        type="text"
                        value={sponsorName || ''}
                        onChange={(e) => setSponsorName(e.target.value)}
                        placeholder="Nombre del patrocinador..."
                        className="w-full p-2 rounded-md text-xs outline-none"
                        style={{ background: DS.bg, border: `1px solid ${DS.border}`, color: DS.txt }}
                    />
                </div>
                
                <div>
                    <label className="text-[10px] block mb-1" style={{ color: DS.txtMuted }}>Logo</label>
                    <button
                        onClick={handleLogoUpload}
                        className="w-full p-4 rounded-md border-2 border-dashed flex flex-col items-center gap-2 transition-all hover:border-gray-500"
                        style={{ borderColor: DS.border }}
                    >
                        {sponsorLogo ? (
                            <img src={sponsorLogo} alt="" className="h-12 object-contain" />
                        ) : (
                            <>
                                <Upload size={20} style={{ color: DS.txtMuted }} />
                                <span className="text-[10px]" style={{ color: DS.txtSub }}>Subir logo</span>
                            </>
                        )}
                    </button>
                </div>
                
                {(sponsorName || sponsorLogo) && (
                    <div className="p-3 rounded-lg" style={{ background: DS.bg, border: `1px solid ${DS.border}` }}>
                        <p className="text-[10px] font-medium mb-2" style={{ color: DS.txtMuted }}>Preview</p>
                        <div className="flex items-center gap-2">
                            {sponsorLogo && (
                                <img src={sponsorLogo} alt="" className="w-8 h-8 object-contain rounded" />
                            )}
                            <span className="text-xs" style={{ color: DS.txt }}>{sponsorName || 'Sponsor'}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
