'use client';

import React, { useRef, useCallback, useState } from 'react';
import {
    Download, Share2, Video, RefreshCw, Copy,
    UploadCloud, Volume2, Trash2, Sparkles, Mic,
    X, AlignLeft, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useStudioContext } from './context';
import type { ScriptSegment } from '@/studio/shared/types';

/* ── canvas sizing ── */
const aspectClass = (format: string, ar: string) => {
    if (format === 'story' || (format === 'video' && ar === '9:16')) return 'aspect-[9/16]';
    if (format === 'video' && ar === '16:9') return 'aspect-video';
    return 'aspect-square';
};

/* ─── CANVAS VIEWER ─── */
function CanvasViewer() {
    const {
        canvasRef, format, aspectRatio, isRecording, recordingProgress,
        isTainted, downloadImage, handleSmartShare, handleRecordVideo,
        copyCaption, smartCaption,
    } = useStudioContext();

    const ac = aspectClass(format, aspectRatio);

    return (
        <div className="flex-1 min-h-0 flex items-center justify-center bg-[#060607] relative overflow-hidden">
            {/* dot-grid */}
            <div className="absolute inset-0 opacity-[0.025]"
                style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
            />

            {/* canvas wrapper — respects aspect ratio, never overflows */}
            <div className={`relative ${ac} max-h-full rounded-2xl overflow-hidden ring-1 ring-white/[0.07] shadow-[0_0_60px_rgba(0,0,0,0.9)]`}
                style={{ maxWidth: 'calc(100% - 64px)', maxHeight: 'calc(100% - 64px)' }}
            >
                <canvas ref={canvasRef} className="block w-full h-full object-contain" />

                {isRecording && (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white z-10 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        REC {Math.round(recordingProgress)}%
                    </div>
                )}

                {/* subtle tainted indicator — no overlay, just a small badge */}
                {isTainted && (
                    <div className="absolute top-2.5 left-2.5 rounded-md bg-amber-500/15 border border-amber-500/20 px-2 py-0.5">
                        <span className="text-[9px] font-semibold text-amber-400">CORS</span>
                    </div>
                )}
            </div>

            {/* floating bottom bar */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#0c0c0e]/95 border border-[#1c1c22] rounded-2xl px-3 py-1.5 backdrop-blur-sm shadow-xl">
                {smartCaption && (
                    <button type="button" onClick={copyCaption}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141416] border border-[#1e1e22] text-[#5a5a62] text-[11px] font-semibold hover:text-[#e0e0e6] transition-all"
                    >
                        <Copy size={11} />Caption
                    </button>
                )}
                <button type="button" onClick={handleSmartShare}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141416] border border-[#1e1e22] text-[#7a7a82] text-[11px] font-semibold hover:text-[#e0e0e6] hover:border-[#2e2e34] transition-all"
                >
                    <Share2 size={11} />Compartir
                </button>
                {format === 'video' ? (
                    <button type="button" onClick={handleRecordVideo} disabled={isRecording}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all
                        ${isRecording ? 'bg-red-950 text-red-400 border border-red-900/30 cursor-not-allowed' : 'bg-[#e5173f] text-white hover:bg-red-500'}`}
                    >
                        {isRecording ? <><RefreshCw size={11} className="animate-spin" />{Math.round(recordingProgress)}%</> : <><Video size={11} />Grabar MP4</>}
                    </button>
                ) : (
                    <button type="button" onClick={downloadImage} disabled={isTainted}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold bg-white text-black hover:bg-gray-100 disabled:opacity-40 transition-all"
                    >
                        <Download size={11} />Exportar
                    </button>
                )}
            </div>
        </div>
    );
}

/* ─── SEGMENT CLIP ─── */
function Clip({
    seg, idx, isActive, pxPerSec, img,
    onSelect, onRemove, onDelta,
}: {
    seg: ScriptSegment; idx: number; isActive: boolean; pxPerSec: number;
    img?: string; onSelect: () => void;
    onRemove: (e: React.MouseEvent) => void; onDelta: (d: number) => void;
}) {
    const isSpecial = seg.text === 'INTRO_SEQUENCE' || seg.text === 'OUTRO_SEQUENCE';
    const w = Math.max(seg.duration / 1000 * pxPerSec, 72);
    const hasAudio = Boolean(seg.audioBuffer);

    if (isSpecial) return (
        <div className="relative flex-shrink-0 flex flex-col items-center justify-center rounded-lg border border-[#1a1a1e] bg-[#0d0d0f] mx-0.5 opacity-30 gap-0.5"
            style={{ width: w, height: '100%' }}>
            <span className="text-[7px] font-bold tracking-widest text-[#2e2e36]">{seg.text === 'INTRO_SEQUENCE' ? 'INTRO' : 'OUTRO'}</span>
            <span className="text-[7px] font-mono text-[#222226]">{(seg.duration / 1000).toFixed(1)}s</span>
        </div>
    );

    return (
        <div
            onClick={onSelect}
            className={`relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer mx-0.5 border-[1.5px] transition-all duration-100 group
            ${isActive ? 'border-[#e5173f] shadow-[0_0_10px_rgba(229,23,63,0.2)]' : 'border-[#1c1c20] hover:border-[#2e2e34]'}`}
            style={{ width: w, height: '100%' }}
        >
            {img && <img src={img} className="absolute inset-0 w-full h-full object-cover opacity-[0.18]" alt="" />}
            <div className={`absolute inset-0 ${isActive ? 'bg-[#e5173f]/8' : 'bg-[#0d0d0f]/80'}`} />

            {/* waveform if audio */}
            {hasAudio && (
                <div className="absolute bottom-0 inset-x-0 h-3 flex items-end gap-px px-0.5 opacity-60">
                    {Array.from({ length: Math.max(3, Math.floor(w / 5)) }).map((_, i) => (
                        <div key={i} className="flex-1 bg-emerald-500 rounded-t"
                            style={{ height: `${25 + Math.abs(Math.sin(i * 0.9)) * 70}%` }} />
                    ))}
                </div>
            )}

            <div className="relative z-10 p-1 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <span className={`text-[8px] font-mono ${isActive ? 'text-[#e5173f]' : 'text-[#2a2a30]'}`}>
                        {idx + 1}·{(seg.duration / 1000).toFixed(1)}s
                    </span>
                    <div className="flex items-center gap-px opacity-0 group-hover:opacity-100 transition-opacity">
                        {hasAudio && <Volume2 size={7} className="text-emerald-400" />}
                        <button type="button" onClick={onRemove} className="w-3 h-3 flex items-center justify-center text-[#2a2a30] hover:text-[#e5173f]">
                            <Trash2 size={7} />
                        </button>
                    </div>
                </div>
                <p className="text-[8px] text-[#8a8a92] leading-tight line-clamp-2">{seg.text}</p>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={e => { e.stopPropagation(); onDelta(-500); }}
                        className="w-3.5 h-3.5 flex items-center justify-center text-[#3a3a40] hover:text-white"><ChevronDown size={7} /></button>
                    <button type="button" onClick={e => { e.stopPropagation(); onDelta(500); }}
                        className="w-3.5 h-3.5 flex items-center justify-center text-[#3a3a40] hover:text-white"><ChevronUp size={7} /></button>
                </div>
            </div>
        </div>
    );
}

/* ─── INSPECTOR ─── */
function Inspector() {
    const { videoScript, setVideoScript, editingSegmentIndex, setEditingSegmentIndex, selectedNews, projectImages, assignImageToSegment } = useStudioContext();
    const idx = editingSegmentIndex;
    if (idx === null || !videoScript[idx]) return null;
    const seg = videoScript[idx];
    if (seg.text === 'INTRO_SEQUENCE' || seg.text === 'OUTRO_SEQUENCE') return null;

    const img = seg.image ?? selectedNews?.image_url;
    const allImgs = [selectedNews?.image_url, ...projectImages].filter(Boolean) as string[];

    return (
        <div className="flex-shrink-0 bg-[#0c0c0e] border-t border-[#111114] px-3 py-2">
            <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 space-y-1">
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#1a1a1e]">
                        {img && <img src={img} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <div className="flex gap-0.5 flex-wrap w-12">
                        {allImgs.slice(0, 6).map((url, i) => (
                            <div key={i} onClick={() => assignImageToSegment(idx, url)}
                                className={`w-5 h-5 rounded overflow-hidden border cursor-pointer ${seg.image === url ? 'border-[#e5173f]' : 'border-[#1a1a1e] hover:border-[#3a3a40]'}`}>
                                <img src={url} className="w-full h-full object-cover" alt="" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                    <textarea rows={2} value={seg.text}
                        onChange={e => setVideoScript(prev => prev.map((s, i) => i === idx ? { ...s, text: e.target.value, audioBuffer: null } : s))}
                        className="w-full bg-[#111113] border border-[#1a1a1e] rounded-lg px-2.5 py-1.5 text-[11px] text-[#e0e0e6] outline-none focus:border-[#e5173f]/40 resize-none leading-relaxed"
                    />
                    <div className="flex items-center gap-1.5">
                        <Clock size={8} className="text-[#3a3a40] flex-shrink-0" />
                        <input type="range" min={500} max={15000} step={250} value={seg.duration}
                            onChange={e => setVideoScript(prev => prev.map((s, i) => i === idx ? { ...s, duration: Number(e.target.value) } : s))}
                            className="flex-1 h-0.5 appearance-none rounded cursor-pointer"
                            style={{ accentColor: '#e5173f' }}
                        />
                        <span className="text-[9px] font-mono text-[#3a3a40] w-7 text-right">{(seg.duration / 1000).toFixed(1)}s</span>
                    </div>
                </div>
                <button type="button" onClick={() => setEditingSegmentIndex(null)} className="flex-shrink-0 text-[#2a2a30] hover:text-[#7a7a80]"><X size={11} /></button>
            </div>
        </div>
    );
}

/* ─── TIMELINE ─── */
const PX_PER_SEC = 100;

function Timeline() {
    const {
        videoScript, setVideoScript, selectedNews,
        editingSegmentIndex, setEditingSegmentIndex,
        isUploading, handleSupabaseUpload,
        generateVideoScript, generateNeuralAudio, isGeneratingAudio,
        format,
        speak, stop, isSpeaking,
    } = useStudioContext();

    const [zoom, setZoom] = useState(PX_PER_SEC);
    const totalMs = videoScript.reduce((s, seg) => s + seg.duration, 0) || 1000;
    const totalSec = Math.ceil(totalMs / 1000);

    /* balance durations by word count */
    const balance = useCallback(() => {
        setVideoScript(prev => {
            const ws = prev.reduce((s, seg) => s + seg.text.split(/\s+/).length, 0) || 1;
            const tot = prev.reduce((s, seg) => s + seg.duration, 0);
            return prev.map(seg => ({ ...seg, duration: Math.max(1000, Math.round(seg.text.split(/\s+/).length / ws * tot)) }));
        });
    }, [setVideoScript]);

    /* tts preview */
    const previewTTS = useCallback(() => {
        if (isSpeaking) { stop(); return; }
        const t = videoScript.filter(s => s.text !== 'INTRO_SEQUENCE' && s.text !== 'OUTRO_SEQUENCE').map(s => s.text).join('. ');
        if (t) speak(t);
    }, [videoScript, speak, stop, isSpeaking]);

    const addSeg = () => setVideoScript(prev => [...prev, { text: 'Nuevo segmento', duration: 3000, image: undefined, audioBuffer: null }]);
    const removeSeg = (idx: number) => { setVideoScript(prev => prev.filter((_, i) => i !== idx)); setEditingSegmentIndex(null); };
    const delta = (idx: number, d: number) => setVideoScript(prev => prev.map((s, i) => i === idx ? { ...s, duration: Math.max(500, s.duration + d) } : s));

    /* ruler ticks */
    const tickStep = zoom < 60 ? 10 : zoom < 120 ? 5 : zoom < 200 ? 2 : 1;
    const ticks = Array.from({ length: Math.ceil(totalSec / tickStep) + 1 }, (_, i) => i * tickStep).filter(s => s <= totalSec + tickStep);

    return (
        <div className="flex-shrink-0 flex flex-col bg-[#09090b] border-t border-[#111114]" style={{ height: 196 }}>

            {/* toolbar */}
            <div className="flex items-center gap-1.5 px-3 h-8 border-b border-[#0e0e11] flex-shrink-0">
                <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#242428] mr-1">Timeline</span>
                <span className="text-[9px] font-mono text-[#242428]">{(totalMs / 1000).toFixed(1)}s · {videoScript.length} seg</span>
                <div className="flex-1" />

                {/* zoom */}
                <div className="flex items-center">
                    <button onClick={() => setZoom(z => Math.max(40, z - 20))} className="w-5 h-5 flex items-center justify-center text-[#3a3a40] hover:text-[#8a8a90] text-xs font-bold">−</button>
                    <span className="text-[9px] font-mono text-[#2a2a30] w-5 text-center">{zoom}</span>
                    <button onClick={() => setZoom(z => Math.min(300, z + 20))} className="w-5 h-5 flex items-center justify-center text-[#3a3a40] hover:text-[#8a8a90] text-xs font-bold">+</button>
                </div>

                {/* tools */}
                {[
                    { icon: <Mic size={9} />, label: isSpeaking ? 'Detener' : 'Preview', fn: previewTTS },
                    { icon: <AlignLeft size={9} />, label: 'Balance', fn: balance },
                    { icon: isGeneratingAudio ? <RefreshCw size={9} className="animate-spin" /> : <Volume2 size={9} />, label: 'Voces', fn: generateNeuralAudio, dis: isGeneratingAudio },
                    { icon: <Sparkles size={9} />, label: 'IA', fn: generateVideoScript, accent: true },
                ].map((tool, i) => (
                    <button key={i} type="button" onClick={tool.fn} disabled={tool.dis}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all disabled:opacity-30
                        ${tool.accent ? 'text-[#e5173f] border border-[#e5173f]/20 bg-[#e5173f]/5 hover:bg-[#e5173f]/12' : 'text-[#3a3a42] border border-[#1a1a1e] bg-[#0f0f11] hover:text-[#b0b0b8] hover:border-[#2a2a2e]'}`}
                    >
                        {tool.icon}{tool.label}
                    </button>
                ))}

                <div className="w-px h-4 bg-[#1a1a1e] mx-0.5" />

                <label className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold text-[#3a3a42] border border-[#1a1a1e] bg-[#0f0f11] hover:text-[#b0b0b8] hover:border-[#2a2a2e] transition-all cursor-pointer">
                    {isUploading ? <RefreshCw size={9} className="animate-spin" /> : <UploadCloud size={9} />}Media
                    <input type="file" accept="image/*" onChange={handleSupabaseUpload} className="hidden" disabled={isUploading} />
                </label>
                <button onClick={addSeg} className="w-5 h-5 flex items-center justify-center rounded text-[#3a3a40] hover:text-[#b0b0b8] border border-[#1a1a1e] bg-[#0f0f11] text-sm font-bold hover:border-[#2a2a2e] transition-all">+</button>
            </div>

            {/* scrollable track */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden bg-[#070709]" style={{ minHeight: 0 }}>
                <div style={{ width: Math.max(totalSec * zoom + 120, 600), height: '100%' }}>

                    {/* ruler */}
                    <div className="relative bg-[#060608] border-b border-[#111115]" style={{ height: 20 }}>
                        {ticks.map(s => (
                            <div key={s} className="absolute top-0 flex flex-col items-center pointer-events-none"
                                style={{ left: 48 + s * zoom }}>
                                <div className="w-px mt-1 bg-[#1c1c22]" style={{ height: s % (tickStep * 2) === 0 ? 6 : 4 }} />
                                {s % (tickStep * 2) === 0 && (
                                    <span className="text-[7px] font-mono text-[#222228] mt-0.5">{s}s</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* track row */}
                    <div className="flex items-stretch px-0" style={{ height: 'calc(100% - 20px)' }}>
                        {/* track label */}
                        <div className="flex-shrink-0 w-12 flex items-center justify-end pr-2 border-r border-[#0e0e11]">
                            <span className="text-[7px] font-bold text-[#1c1c22] uppercase tracking-widest">V1</span>
                        </div>

                        {/* clips */}
                        <div className="flex items-stretch px-2 py-2 gap-0.5">
                            {videoScript.length === 0 ? (
                                <button type="button" onClick={generateVideoScript}
                                    className="self-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5173f]/20 bg-[#e5173f]/5 text-[#e5173f] text-[10px] font-semibold hover:bg-[#e5173f]/10 transition-all"
                                >
                                    <Sparkles size={10} />Generar guion con IA
                                </button>
                            ) : videoScript.map((seg, idx) => (
                                <Clip
                                    key={idx}
                                    seg={seg} idx={idx}
                                    isActive={editingSegmentIndex === idx}
                                    pxPerSec={zoom}
                                    img={seg.image ?? selectedNews?.image_url}
                                    onSelect={() => setEditingSegmentIndex(editingSegmentIndex === idx ? null : idx)}
                                    onRemove={e => { e.stopPropagation(); removeSeg(idx); }}
                                    onDelta={d => delta(idx, d)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* inspector — segment editor */}
            <Inspector />
        </div>
    );
}

/* ─── WORK AREA ─── */
export function WorkArea() {
    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <CanvasViewer />
            <Timeline />
        </div>
    );
}
