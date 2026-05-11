'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Trash2, Volume2, Clock, ChevronUp, ChevronDown, Image as ImageIcon, Type, Music } from 'lucide-react';
import { useStudioContext } from './context';

export function WorkingEditor() {
    const { 
        news, selectedNews, handleNewsSelect,
        isRecording, handleRecordVideo,
        tiktokAccount, connectTikTok
    } = useStudioContext();

    // Estado simple
    const [scenes, setScenes] = useState<any[]>([]);
    const [currentScene, setCurrentScene] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeTab, setActiveTab] = useState('news');
    const playInterval = useRef<NodeJS.Timeout | null>(null);

    // Cargar noticia seleccionada
    useEffect(() => {
        if (selectedNews) {
            setScenes([
                { id: 1, type: 'hook', text: '🔥 NOTICIA DE ÚLTIMA HORA', duration: 3, audio: null },
                { id: 2, type: 'image', text: selectedNews.title, image: selectedNews.image_url, duration: 5, audio: null },
                { id: 3, type: 'text', text: selectedNews.content?.substring(0, 100) || 'Detalles...', duration: 4, audio: null },
            ]);
            setCurrentScene(0);
        }
    }, [selectedNews]);

    // Auto-play al cambiar escena
    useEffect(() => {
        if (isPlaying) {
            const scene = scenes[currentScene];
            if (scene && playInterval.current) {
                clearTimeout(playInterval.current);
            }
            if (scene) {
                playInterval.current = setTimeout(() => {
                    if (currentScene < scenes.length - 1) {
                        setCurrentScene(c => c + 1);
                    } else {
                        setIsPlaying(false);
                    }
                }, scene.duration * 1000);
            }
        }
        return () => {
            if (playInterval.current) clearTimeout(playInterval.current);
        };
    }, [isPlaying, currentScene, scenes]);

    const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0);

    const moveScene = (idx: number, dir: 'up' | 'down') => {
        if (dir === 'up' && idx === 0) return;
        if (dir === 'down' && idx === scenes.length - 1) return;
        const newScenes = [...scenes];
        const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
        [newScenes[idx], newScenes[swapIdx]] = [newScenes[swapIdx], newScenes[idx]];
        setScenes(newScenes);
    };

    const updateScene = (idx: number, updates: any) => {
        const newScenes = [...scenes];
        newScenes[idx] = { ...newScenes[idx], ...updates };
        setScenes(newScenes);
    };

    const addScene = (type: string) => {
        const newScene = {
            id: Date.now(),
            type,
            text: type === 'hook' ? '⚡ NUEVO HOOK' : 'Nuevo texto',
            duration: type === 'hook' ? 3 : 5,
            audio: null,
        };
        setScenes([...scenes, newScene]);
    };

    const deleteScene = (idx: number) => {
        setScenes(scenes.filter((_, i) => i !== idx));
        if (currentScene >= idx && currentScene > 0) {
            setCurrentScene(currentScene - 1);
        }
    };

    return (
        <div className="h-full flex bg-[#0a0a0b] text-white">
            {/* LEFT PANEL */}
            <div className="w-72 border-r border-[#27272a] flex flex-col bg-[#141416]">
                {/* Tabs */}
                <div className="flex border-b border-[#27272a]">
                    {['news', 'scenes', 'audio', 'publish'].map(t => (
                        <button
                            key={t}
                            onClick={() => setActiveTab(t)}
                            className="flex-1 py-2 text-[11px] font-medium capitalize"
                            style={{
                                background: activeTab === t ? '#0a0a0b' : 'transparent',
                                color: activeTab === t ? '#fff' : '#71717a',
                                borderBottom: activeTab === t ? '2px solid #dc2626' : 'none'
                            }}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-3">
                    {activeTab === 'news' && (
                        <div className="space-y-2">
                            <p className="text-xs text-[#71717a] mb-2">Selecciona una noticia:</p>
                            {news.map((n: any) => (
                                <button
                                    key={n.id}
                                    onClick={() => handleNewsSelect(n)}
                                    className="w-full p-3 rounded text-left text-sm border transition-all"
                                    style={{
                                        background: selectedNews?.id === n.id ? '#dc262620' : '#0a0a0b',
                                        borderColor: selectedNews?.id === n.id ? '#dc2626' : '#27272a',
                                        color: selectedNews?.id === n.id ? '#fff' : '#a1a1aa'
                                    }}
                                >
                                    <p className="line-clamp-2">{n.title}</p>
                                    <span className="text-[10px] text-[#71717a]">{n.category}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab === 'scenes' && (
                        <div className="space-y-3">
                            <p className="text-xs text-[#71717a]">Agregar escena:</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => addScene('text')} className="p-2 bg-[#0a0a0b] rounded text-xs border border-[#27272a] hover:border-[#3f3f46]">
                                    <Type size={14} className="mx-auto mb-1" /> Texto
                                </button>
                                <button onClick={() => addScene('hook')} className="p-2 bg-[#dc262620] text-[#dc2626] rounded text-xs border border-[#dc2626]">
                                    <span className="block text-center text-lg">⚡</span> Hook
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'audio' && (
                        <div className="space-y-2">
                            <p className="text-xs text-[#71717a]">Audio por escena:</p>
                            {scenes.map((s, i) => (
                                <div key={s.id} className="p-2 bg-[#0a0a0b] rounded border border-[#27272a] text-xs">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Volume2 size={12} />
                                        <span className="text-[#a1a1aa]">Escena {i + 1}</span>
                                    </div>
                                    <button className="w-full py-1 bg-[#27272a] rounded text-[10px]">
                                        {s.audio ? 'Cambiar audio' : 'Agregar audio'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'publish' && (
                        <div className="space-y-3">
                            {!tiktokAccount?.connected ? (
                                <button onClick={connectTikTok} className="w-full py-2 bg-[#dc2626] rounded text-xs font-semibold">
                                    Conectar TikTok
                                </button>
                            ) : (
                                <>
                                    <p className="text-xs text-[#a1a1aa]">@{tiktokAccount.display_name}</p>
                                    <button onClick={handleRecordVideo} disabled={isRecording} className="w-full py-2 bg-green-600 rounded text-xs font-semibold disabled:opacity-50">
                                        {isRecording ? 'Grabando...' : 'Grabar Video'}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* CENTER - Preview */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Canvas */}
                <div className="flex-1 flex items-center justify-center bg-black p-4">
                    <div className="aspect-[9/16] h-full max-w-[360px] bg-[#141416] rounded overflow-hidden relative">
                        {scenes.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-[#71717a]">
                                <p className="text-center">Selecciona una noticia<br/>para empezar</p>
                            </div>
                        ) : (
                            <>
                                {scenes.map((scene, idx) => (
                                    <div
                                        key={scene.id}
                                        className="absolute inset-0 flex flex-col items-center justify-center p-6 transition-opacity duration-300"
                                        style={{ 
                                            opacity: currentScene === idx ? 1 : 0,
                                            background: idx % 2 === 0 ? '#141416' : '#1a1a1c'
                                        }}
                                    >
                                        {scene.type === 'image' && scene.image && (
                                            <img src={scene.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                                        )}
                                        <div className="relative z-10 text-center">
                                            {scene.type === 'hook' && (
                                                <p className="text-2xl font-black text-[#dc2626]">{scene.text}</p>
                                            )}
                                            {scene.type === 'text' && (
                                                <p className="text-xl font-bold">{scene.text}</p>
                                            )}
                                            {scene.type === 'image' && (
                                                <p className="text-lg font-bold">{scene.text}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Progress bar */}
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#27272a]">
                                    <div 
                                        className="h-full bg-[#dc2626] transition-all"
                                        style={{ 
                                            width: `${((currentScene + 1) / scenes.length) * 100}%` 
                                        }}
                                    />
                                </div>
                                
                                {/* Scene counter */}
                                <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded text-[10px]">
                                    {currentScene + 1}/{scenes.length}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="h-12 border-t border-[#27272a] flex items-center justify-center gap-4 bg-[#141416]">
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        disabled={scenes.length === 0}
                        className="flex items-center gap-1 px-4 py-1.5 bg-[#dc2626] rounded text-sm font-medium disabled:opacity-50"
                    >
                        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                        {isPlaying ? 'Pausar' : 'Preview'}
                    </button>
                    <span className="text-xs text-[#71717a]">
                        {Math.round(totalDuration)}s total
                    </span>
                </div>

                {/* Timeline */}
                <div className="h-48 border-t border-[#27272a] bg-[#141416] flex flex-col">
                    <div className="h-6 flex items-center px-3 border-b border-[#27272a]">
                        <Clock size={12} className="text-[#71717a] mr-2" />
                        <span className="text-[10px] text-[#71717a]">Timeline</span>
                        <span className="text-[10px] text-[#71717a] ml-auto">{scenes.length} escenas</span>
                    </div>
                    <div className="flex-1 overflow-x-auto overflow-y-hidden">
                        <div className="flex gap-2 p-3 min-w-max">
                            {scenes.map((scene, idx) => (
                                <div 
                                    key={scene.id}
                                    onClick={() => setCurrentScene(idx)}
                                    className="w-32 flex-shrink-0 p-2 rounded border cursor-pointer transition-all"
                                    style={{
                                        background: currentScene === idx ? '#dc262620' : '#0a0a0b',
                                        borderColor: currentScene === idx ? '#dc2626' : '#27272a'
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] uppercase text-[#71717a]">{scene.type}</span>
                                        {scene.audio && <Volume2 size={10} className="text-[#a1a1aa]" />}
                                    </div>
                                    <p className="text-[10px] line-clamp-2 mb-2 text-[#a1a1aa]">{scene.text}</p>
                                    <div className="flex items-center justify-between text-[10px] text-[#71717a]">
                                        <span>{scene.duration}s</span>
                                        <div className="flex gap-0.5">
                                            <button onClick={(e) => { e.stopPropagation(); moveScene(idx, 'up'); }} disabled={idx === 0} className="p-0.5 hover:bg-[#27272a] rounded disabled:opacity-30">↑</button>
                                            <button onClick={(e) => { e.stopPropagation(); moveScene(idx, 'down'); }} disabled={idx === scenes.length - 1} className="p-0.5 hover:bg-[#27272a] rounded disabled:opacity-30">↓</button>
                                            <button onClick={(e) => { e.stopPropagation(); deleteScene(idx); }} className="p-0.5 hover:bg-red-500/20 rounded text-red-400">×</button>
                                        </div>
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
