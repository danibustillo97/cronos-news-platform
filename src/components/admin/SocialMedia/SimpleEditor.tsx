'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, Image as ImageIcon, Type, Sparkles, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useStudioContext } from './context';

const DS = {
    bg: '#0a0a0b',
    surface: '#141416',
    border: '#27272a',
    accent: '#dc2626',
    txt: '#fafafa',
    txtMuted: '#a1a1aa',
    txtSub: '#71717a',
};

interface TimelineItem {
    id: string;
    type: 'image' | 'text' | 'hook';
    content: string;
    duration: number;
}

export function SimpleEditor() {
    const { 
        news, selectedNews, handleNewsSelect,
        sponsorName, setSponsorName, sponsorLogo, setSponsorLogo,
        isRecording, handleRecordVideo,
        tiktokAccount, connectTikTok
    } = useStudioContext();

    const [timeline, setTimeline] = useState<TimelineItem[]>([]);
    const [activeTab, setActiveTab] = useState('news');

    // Cargar noticias al montar
    useEffect(() => {
        if (news.length > 0 && !selectedNews) {
            handleNewsSelect(news[0]);
        }
    }, [news, selectedNews, handleNewsSelect]);

    const addItem = (type: TimelineItem['type']) => {
        const content = type === 'text' ? 'Nuevo texto' : 
                       type === 'hook' ? '🔥 HOOK VIRAL' : '';
        const newItem: TimelineItem = {
            id: Date.now().toString(),
            type,
            content,
            duration: type === 'hook' ? 3 : 5,
        };
        setTimeline([...timeline, newItem]);
    };

    const moveItem = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === timeline.length - 1) return;
        
        const newTimeline = [...timeline];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        [newTimeline[index], newTimeline[newIndex]] = [newTimeline[newIndex], newTimeline[index]];
        setTimeline(newTimeline);
    };

    const removeItem = (index: number) => {
        setTimeline(timeline.filter((_, i) => i !== index));
    };

    const totalDuration = timeline.reduce((acc, item) => acc + item.duration, 0);

    return (
        <div className="h-full flex flex-col" style={{ background: DS.bg }}>
            {/* Header */}
            <div className="h-12 flex items-center justify-between px-3 border-b" style={{ background: DS.surface, borderColor: DS.border }}>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: DS.txt }}>TikTok Studio</span>
                    <span className="text-xs" style={{ color: DS.txtMuted }}>{totalDuration}s</span>
                </div>
                <button
                    onClick={handleRecordVideo}
                    disabled={isRecording}
                    className="px-3 py-1 rounded text-xs font-semibold flex items-center gap-1"
                    style={{ background: isRecording ? '#16a34a' : DS.accent, color: '#fff' }}
                >
                    {isRecording ? <Pause size={12} /> : <Play size={12} />}
                    {isRecording ? 'REC' : 'Grabar'}
                </button>
            </div>

            {/* Main */}
            <div className="flex-1 flex min-h-0">
                {/* Left Panel */}
                <div className="w-64 flex-shrink-0 border-r flex flex-col" style={{ background: DS.surface, borderColor: DS.border }}>
                    {/* Tabs */}
                    <div className="flex border-b" style={{ borderColor: DS.border }}>
                        {['news', 'templates', 'sponsor', 'publish'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className="flex-1 py-2 text-[10px] font-medium capitalize"
                                style={{
                                    background: activeTab === tab ? DS.bg : 'transparent',
                                    color: activeTab === tab ? DS.txt : DS.txtMuted,
                                    borderBottom: activeTab === tab ? `2px solid ${DS.accent}` : 'none',
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {activeTab === 'news' && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-medium mb-2" style={{ color: DS.txtMuted }}>Noticias</h4>
                                {news.map((item: any) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleNewsSelect(item)}
                                        className="w-full p-2 rounded text-left text-xs"
                                        style={{
                                            background: selectedNews?.id === item.id ? DS.accent + '20' : DS.bg,
                                            border: `1px solid ${selectedNews?.id === item.id ? DS.accent : DS.border}`,
                                            color: DS.txt,
                                        }}
                                    >
                                        <p className="line-clamp-2">{item.title}</p>
                                        <span className="text-[9px]" style={{ color: DS.txtSub }}>{item.category}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeTab === 'templates' && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => addItem('image')} className="p-2 rounded text-xs" style={{ background: DS.bg, color: DS.txt }}>
                                        <ImageIcon size={14} className="mx-auto mb-1" />
                                        Imagen
                                    </button>
                                    <button onClick={() => addItem('text')} className="p-2 rounded text-xs" style={{ background: DS.bg, color: DS.txt }}>
                                        <Type size={14} className="mx-auto mb-1" />
                                        Texto
                                    </button>
                                    <button onClick={() => addItem('hook')} className="p-2 rounded text-xs col-span-2" style={{ background: DS.accent + '20', color: DS.accent }}>
                                        <Sparkles size={14} className="mx-auto mb-1" />
                                        Hook Viral
                                    </button>
                                </div>
                                
                                <div className="pt-2 border-t" style={{ borderColor: DS.border }}>
                                    <p className="text-[10px] mb-2" style={{ color: DS.txtMuted }}>Plantillas</p>
                                    {['Breaking News', 'VS Battle', 'Stats'].map((name) => (
                                        <button key={name} className="w-full p-2 rounded text-xs text-left mb-1" style={{ background: DS.bg, color: DS.txtMuted }}>
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'sponsor' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] block mb-1" style={{ color: DS.txtMuted }}>Nombre</label>
                                    <input
                                        type="text"
                                        value={sponsorName || ''}
                                        onChange={(e) => setSponsorName(e.target.value)}
                                        className="w-full p-2 rounded text-xs"
                                        style={{ background: DS.bg, border: `1px solid ${DS.border}`, color: DS.txt }}
                                        placeholder="Patrocinador..."
                                    />
                                </div>
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
                                    className="w-full p-3 rounded border-2 border-dashed text-xs"
                                    style={{ borderColor: DS.border, color: DS.txtMuted }}
                                >
                                    {sponsorLogo ? 'Logo cargado ✓' : 'Subir logo'}
                                </button>
                            </div>
                        )}

                        {activeTab === 'publish' && (
                            <div className="space-y-3">
                                {!tiktokAccount?.connected ? (
                                    <button
                                        onClick={connectTikTok}
                                        className="w-full py-2 rounded text-xs font-semibold"
                                        style={{ background: DS.accent, color: '#fff' }}
                                    >
                                        Conectar TikTok
                                    </button>
                                ) : (
                                    <>
                                        <p className="text-xs" style={{ color: DS.txtMuted }}>
                                            @{tiktokAccount.display_name}
                                        </p>
                                        <button
                                            className="w-full py-2 rounded text-xs font-semibold"
                                            style={{ background: '#16a34a', color: '#fff' }}
                                        >
                                            Publicar
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center - Preview */}
                <div className="flex-1 flex flex-col min-h-0" style={{ background: '#000' }}>
                    <div className="flex-1 flex items-center justify-center p-4">
                        <div 
                            className="aspect-[9/16] max-h-full rounded overflow-hidden"
                            style={{ background: DS.surface, width: 'min(320px, 100%)' }}
                        >
                            {timeline.length === 0 ? (
                                <div className="h-full flex items-center justify-center">
                                    <p className="text-xs text-center" style={{ color: DS.txtMuted }}>
                                        Selecciona una noticia<br/>y agrega elementos
                                    </p>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col divide-y" style={{ borderColor: DS.border }}>
                                    {timeline.map((item, idx) => (
                                        <div key={item.id} className="flex-1 flex items-center justify-center p-2" style={{ background: idx % 2 === 0 ? DS.surface : DS.bg }}>
                                            {item.type === 'text' && (
                                                <p className="text-sm font-bold text-center" style={{ color: DS.txt }}>{item.content}</p>
                                            )}
                                            {item.type === 'hook' && (
                                                <p className="text-lg font-black text-center" style={{ color: DS.accent }}>{item.content}</p>
                                            )}
                                            {item.type === 'image' && (
                                                <ImageIcon size={32} style={{ color: DS.txtMuted }} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="h-40 border-t flex flex-col" style={{ background: DS.surface, borderColor: DS.border }}>
                        <div className="h-6 flex items-center px-2 border-b" style={{ borderColor: DS.border }}>
                            <span className="text-[10px]" style={{ color: DS.txtMuted }}>Timeline ({timeline.length})</span>
                        </div>
                        <div className="flex-1 overflow-x-auto">
                            <div className="flex gap-1 p-2 min-w-max">
                                {timeline.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        className="w-20 flex-shrink-0 p-2 rounded border cursor-pointer"
                                        style={{ background: DS.bg, borderColor: DS.border }}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] uppercase" style={{ color: DS.txtSub }}>{item.type}</span>
                                            <span className="text-[9px]" style={{ color: DS.txtSub }}>{item.duration}s</span>
                                        </div>
                                        <p className="text-[10px] line-clamp-2 mb-2" style={{ color: DS.txtMuted }}>{item.content}</p>
                                        <div className="flex gap-0.5">
                                            <button onClick={() => moveItem(idx, 'up')} disabled={idx === 0} className="p-0.5 rounded text-[10px] disabled:opacity-30">↑</button>
                                            <button onClick={() => moveItem(idx, 'down')} disabled={idx === timeline.length - 1} className="p-0.5 rounded text-[10px] disabled:opacity-30">↓</button>
                                            <button onClick={() => removeItem(idx)} className="p-0.5 rounded text-[10px] ml-auto" style={{ color: DS.accent }}>×</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
