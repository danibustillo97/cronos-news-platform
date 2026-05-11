'use client';

import React, { useState } from 'react';
import {
    Download, Video, RefreshCw, Share2, Copy,
    Smartphone, Music, Type, Check, ImagePlus,
    LayoutTemplate, SplitSquareHorizontal, Newspaper, Minus,
    Wand2, Hash, Scissors, CaseSensitive, Sparkles,
    Play, Pause, Redo, Undo, Zap, AlignLeft, Palette
} from 'lucide-react';
import { useStudioContext } from './context';
import type { FormatType, LayoutMode } from '@/studio/shared/types';

/* ═══════════════ DESIGN TOKENS ═══════════════ */
export const DS = {
    bg:          '#09090b',
    surface:     '#111114',
    surfaceMid:  '#16161a',
    border:      '#1e1e24',
    borderSub:   '#141418',
    accent:      '#e5173f',
    accentDim:   'rgba(229,23,63,0.12)',
    txt:         '#e8e8f0',
    sub:         '#50505c',
    muted:       '#28282e',
} as const;

/* ═══════════════ TIKTOK ONLY CONFIG ═══════════════ */
export const TIKTOK_CONFIG = {
    icon: <span className="font-black text-[10px] leading-none">TK</span>,
    color: '#ff0050',
    bg: '#000000',
    label: 'TikTok Dev',
    format: '9:16',
    maxChars: 2200,
    maxDuration: 180, // seconds
} as const;

/* ═══════════════ ATOMS ═══════════════ */
const Sep = () => (
    <div className="w-px self-stretch my-1.5 flex-shrink-0" style={{ background: DS.borderSub }} />
);

interface BtnProps {
    active?: boolean;
    onClick?: () => void;
    title?: string;
    children: React.ReactNode;
    variant?: 'default' | 'primary' | 'danger' | 'ghost';
    disabled?: boolean;
}
const Btn = ({ active, onClick, title, children, variant = 'default', disabled }: BtnProps) => {
    const base = 'flex items-center gap-1.5 rounded-lg text-[11px] font-semibold transition-all duration-100 select-none flex-shrink-0 px-2.5 py-1.5';
    
    const styles = {
        primary: 'bg-white text-black hover:bg-gray-100 disabled:opacity-40',
        danger: active 
            ? 'bg-[#ff0050] text-white' 
            : 'bg-[#ff0050]/10 text-[#ff0050] border border-[#ff0050]/30 hover:bg-[#ff0050]/20',
        ghost: 'text-[#50505c] hover:text-[#e8e8f0]',
        default: active 
            ? 'text-white border' 
            : `text-[${DS.sub}] border border-[${DS.border}] hover:text-[#a0a0ac] hover:border-[#2a2a32]`,
    };

    const activeStyle = active && variant === 'default' ? {
        background: 'rgba(255,0,80,0.15)',
        borderColor: 'rgba(255,0,80,0.4)',
        color: '#ff0050',
    } : {};

    return (
        <button 
            type="button" 
            title={title} 
            onClick={onClick} 
            disabled={disabled}
            className={`${base} ${styles[variant]}`}
            style={activeStyle}
        >
            {children}
        </button>
    );
};

/* ═══════════════ QUICK TOOLBAR ═══════════════ */
function QuickToolbar() {
    const { isRecording, handleRecordVideo, customTitle, setCustomTitle } = useStudioContext();
    const [showEmoji, setShowEmoji] = useState(false);
    
    const addEmoji = (emoji: string) => {
        setCustomTitle((customTitle || '') + emoji);
        setShowEmoji(false);
    };
    
    const viralEmojis = ['🔥', '⚡', '😱', '👀', '🤯', '💥', '🎯', '🚀', '💯', '✨'];
    
    return (
        <div className="flex items-center gap-1">
            <Btn title="Agregar Imagen" onClick={() => {}}>
                <ImagePlus size={14} /> Imagen
            </Btn>
            <Btn title="Agregar Texto" onClick={() => {}}>
                <Type size={14} /> Texto
            </Btn>
            
            {/* Emoji Picker */}
            <div className="relative">
                <Btn title="Emojis Virales" onClick={() => setShowEmoji(!showEmoji)} variant="danger">
                    <Sparkles size={14} />
                </Btn>
                {showEmoji && (
                    <div 
                        className="absolute top-full mt-2 left-0 p-2 rounded-xl z-50 grid grid-cols-5 gap-1"
                        style={{ background: DS.surface, border: `1px solid ${DS.border}` }}
                    >
                        {viralEmojis.map(e => (
                            <button
                                key={e}
                                onClick={() => addEmoji(e)}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-lg"
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
            <Sep />
            
            <Btn title="Deshacer">
                <Undo size={14} />
            </Btn>
            <Btn title="Rehacer">
                <Redo size={14} />
            </Btn>
            
            <Sep />
            
            <Btn 
                title={isRecording ? 'Grabando...' : 'Grabar Video'} 
                variant="danger"
                onClick={handleRecordVideo}
                disabled={isRecording}
            >
                {isRecording ? <Pause size={14} /> : <Video size={14} />}
                {isRecording ? 'REC...' : 'Grabar'}
            </Btn>
        </div>
    );
}

/* ═══════════════ TIKTOK BADGE ═══════════════ */
function TikTokBadge() {
    return (
        <div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0"
            style={{ 
                background: 'linear-gradient(135deg, #ff0050 0%, #00f2ea 100%)',
            }}
        >
            <Smartphone size={14} style={{ color: '#fff' }} />
            <span className="font-black text-white text-xs">TIKTOK</span>
            <span className="text-[10px] text-white/80 font-medium">9:16</span>
        </div>
    );
}

/* ═══════════════ LAYOUT PRESETS ═══════════════ */
const LAYOUTS: { id: Exclude<LayoutMode, 'auto'>; icon: React.ReactNode; label: string; desc: string }[] = [
    { id: 'overlay',  icon: <LayoutTemplate size={10} />, label: 'Overlay', desc: 'Texto sobre imagen' },
    { id: 'split',    icon: <SplitSquareHorizontal size={10} />, label: 'Split', desc: 'Imagen + texto lado a lado' },
    { id: 'breaking', icon: <Newspaper size={10} />, label: 'Urgente', desc: 'Banner breaking news' },
    { id: 'minimal',  icon: <Minus size={10} />, label: 'Clean', desc: 'Diseño limpio minimalista' },
];

/* ═══════════════ TOPBAR ═══════════════ */
export function TopBar() {
    const {
        layoutMode, setLayoutMode,
        fontSize, setFontSize,
        showWatermark, setShowWatermark,
        isRecording, recordingProgress, isTainted,
        downloadImage, handleSmartShare, handleRecordVideo,
        copyCaption, smartCaption, generateSmartCaption,
        customTitle, setCustomTitle, selectedNews,
    } = useStudioContext();

    const doHashtags = () => {
        if (!selectedNews) return;
        const src = selectedNews.category + ' ' + selectedNews.title;
        const tags = [...new Set((src.match(/\b[A-Za-záéíóúñÁÉÍÓÚÑ]{4,}\b/g) ?? []))]
            .slice(0, 5).map((w: string) => '#' + w.toLowerCase().replace(/[áéíóúñ]/g, c => 
                ({á:'a',é:'e',í:'i',ó:'o',ú:'u',ñ:'n'})[c] || c)).join(' ');
        setCustomTitle(customTitle.trimEnd() + '\n\n' + tags);
    };

    const doShorten = () => {
        const ws = customTitle.trim().split(/\s+/);
        setCustomTitle(ws.slice(0, 12).join(' ') + (ws.length > 12 ? '…' : ''));
    };

    const doTitleCase = () =>
        setCustomTitle(customTitle.replace(/\b\w/g, (c: string) => c.toUpperCase()));

    return (
        <header
            className="flex items-center gap-2 px-3 flex-shrink-0 border-b"
            style={{
                height: 48,
                background: DS.bg,
                borderColor: DS.borderSub,
            }}
        >
            {/* ── TikTok Badge ── */}
            <TikTokBadge />

            <Sep />

            {/* ── Quick Toolbar ── */}
            <QuickToolbar />

            <Sep />

            {/* ── Layout Selector ── */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl flex-shrink-0"
                style={{ background: DS.surface, border: `1px solid ${DS.border}` }}
            >
                {LAYOUTS.map(l => (
                    <button 
                        key={l.id} 
                        type="button" 
                        title={`${l.label}: ${l.desc}`}
                        onClick={() => setLayoutMode(l.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all duration-100 flex-shrink-0"
                        style={layoutMode === l.id
                            ? { background: '#ff0050', color: '#fff' }
                            : { color: DS.sub }}
                    >
                        {l.icon}{l.label}
                    </button>
                ))}
            </div>

            <Sep />

            {/* ── Font Size ── */}
            <div className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-xl"
                style={{ background: DS.surface, border: `1px solid ${DS.border}` }}
            >
                <Type size={12} style={{ color: DS.sub }} />
                <input 
                    type="range" 
                    min={28} 
                    max={80} 
                    step={2} 
                    value={fontSize}
                    onChange={e => setFontSize(Number(e.target.value))}
                    title={`Fuente: ${fontSize}px`}
                    className="w-14 h-0.5 appearance-none rounded cursor-pointer flex-shrink-0"
                    style={{ accentColor: '#ff0050' }}
                />
                <span className="text-[10px] font-mono w-5 flex-shrink-0" style={{ color: DS.sub }}>
                    {fontSize}
                </span>
            </div>

            {/* ── Watermark ── */}
            <button 
                type="button" 
                onClick={() => setShowWatermark(!showWatermark)} 
                title="Marca de agua @cronos"
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold flex-shrink-0 transition-all"
                style={showWatermark
                    ? { background: 'rgba(255,0,80,0.15)', color: '#ff0050', border: `1px solid rgba(255,0,80,0.3)` }
                    : { color: DS.muted, border: `1px solid ${DS.border}`, background: DS.surface }}
            >
                <Check size={9} />@cronos
            </button>

            <Sep />

            {/* ── AI Tools ── */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
                <Btn onClick={generateSmartCaption} title="Generar caption viral con IA">
                    <Wand2 size={10} />AI Caption
                </Btn>
                <Btn onClick={doHashtags} title="Auto-hashtags virales">
                    <Hash size={10} />Tags
                </Btn>
                <Btn onClick={doShorten} title="Acortar para TikTok">
                    <Scissors size={10} />Cortar
                </Btn>
                <Btn onClick={doTitleCase} title="Formato título">
                    <CaseSensitive size={10} />Title
                </Btn>
            </div>

            {/* ── Spacer ── */}
            <div className="flex-1 min-w-0" />

            {/* ── Right Actions ── */}
            {smartCaption && (
                <Btn onClick={copyCaption} variant="ghost" title="Copiar caption">
                    <Copy size={10} />
                </Btn>
            )}
            
            <Btn onClick={handleSmartShare} variant="ghost" title="Compartir">
                <Share2 size={10} />
            </Btn>

            <button 
                type="button" 
                onClick={handleRecordVideo} 
                disabled={isRecording}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold flex-shrink-0 transition-all disabled:opacity-60"
                style={isRecording
                    ? { background: 'rgba(255,0,80,0.15)', color: '#ff5c8a', border: '1px solid rgba(255,0,80,0.2)', cursor: 'not-allowed' }
                    : { background: 'linear-gradient(135deg, #ff0050 0%, #ff3377 100%)', color: '#fff' }}
            >
                {isRecording ? (
                    <><RefreshCw size={11} className="animate-spin" />{Math.round(recordingProgress)}%</>
                ) : (
                    <><Video size={11} />Exportar MP4</>
                )}
            </button>
        </header>
    );
}
