'use client';

import React from 'react';
import {
    Download, Video, RefreshCw, Share2, Copy,
    MonitorPlay, Square, Smartphone,
    LayoutTemplate, SplitSquareHorizontal, Newspaper, Minus,
    Facebook, Twitter, Instagram, Youtube, Linkedin,
    Wand2, Hash, Scissors, Type,
    Check, Volume2,
} from 'lucide-react';
import { useStudioContext } from './context';
import type { FormatType, LayoutMode } from '@/studio/shared/types';

/* ── tiny atoms ── */
const Sep = () => <div className="w-px h-4 bg-[#1c1c20] flex-shrink-0 mx-1" />;

const Chip = ({
    active, onClick, title, children, danger,
}: {
    active?: boolean; onClick?: () => void; title?: string;
    children: React.ReactNode; danger?: boolean;
}) => (
    <button
        type="button"
        title={title}
        onClick={onClick}
        className={[
            'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold',
            'transition-all duration-100 select-none whitespace-nowrap flex-shrink-0',
            active && danger  ? 'bg-red-600 text-white' :
            active            ? 'bg-[#e5173f] text-white' :
            danger            ? 'text-red-500 hover:bg-red-950 border border-red-900/30' :
                                'text-[#4a4a54] hover:text-[#b0b0b8] border border-[#1a1a1e] hover:border-[#2e2e34]',
        ].filter(Boolean).join(' ')}
    >
        {children}
    </button>
);

/* ── network map ── */
const NET: Record<string, { icon: React.ReactNode; activeClass: string }> = {
    facebook:  { icon: <Facebook size={11} />,  activeClass: 'bg-[#1877f2] text-white' },
    twitter:   { icon: <Twitter size={11} />,   activeClass: 'bg-[#1d9bf0] text-white' },
    instagram: { icon: <Instagram size={11} />, activeClass: 'bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white' },
    youtube:   { icon: <Youtube size={11} />,   activeClass: 'bg-[#ff0000] text-white' },
    linkedin:  { icon: <Linkedin size={11} />,  activeClass: 'bg-[#0a66c2] text-white' },
    tiktok:    { icon: <span className="font-black text-[9px]">TK</span>, activeClass: 'bg-black border border-[#333] text-white' },
};

const FORMATS: { id: FormatType; icon: React.ReactNode; label: string }[] = [
    { id: 'square', icon: <Square size={10} />,      label: '1:1' },
    { id: 'story',  icon: <Smartphone size={10} />,  label: '9:16' },
    { id: 'video',  icon: <MonitorPlay size={10} />, label: 'Video' },
];

const LAYOUTS: { id: Exclude<LayoutMode, 'auto'>; icon: React.ReactNode; label: string }[] = [
    { id: 'overlay',  icon: <LayoutTemplate size={10} />,        label: 'Overlay' },
    { id: 'split',    icon: <SplitSquareHorizontal size={10} />, label: 'Split' },
    { id: 'breaking', icon: <Newspaper size={10} />,             label: 'Break' },
    { id: 'minimal',  icon: <Minus size={10} />,                 label: 'Clean' },
];

export function TopBar() {
    const {
        format, setFormat, layoutMode, setLayoutMode,
        aspectRatio, setAspectRatio, fontSize, setFontSize,
        showWatermark, setShowWatermark,
        socialNetworks, activeNetwork, setActiveNetwork, toggleNetworkConnection,
        isRecording, recordingProgress, isTainted,
        downloadImage, handleSmartShare, handleRecordVideo,
        copyCaption, smartCaption, generateSmartCaption,
        customTitle, setCustomTitle, selectedNews,
    } = useStudioContext();

    const isVideo = format === 'video';

    /* ── free AI quick-actions ── */
    const doHashtags = () => {
        if (!selectedNews) return;
        const src = selectedNews.category + ' ' + selectedNews.title;
        const tags = [...new Set((src.match(/\b[A-Za-záéíóúñÁÉÍÓÚÑ]{5,}\b/g) ?? []))]
            .slice(0, 5).map((w: string) => '#' + w).join(' ');
        setCustomTitle(customTitle.trimEnd() + '\n' + tags);
    };
    const doShorten = () => {
        const ws = customTitle.trim().split(/\s+/);
        setCustomTitle(ws.slice(0, 9).join(' ') + (ws.length > 9 ? '…' : ''));
    };
    const doTitleCase = () =>
        setCustomTitle(customTitle.replace(/\b\w/g, c => c.toUpperCase()));

    return (
        <header className="flex items-center gap-1.5 px-3 h-10 bg-[#0a0a0c] border-b border-[#141418] flex-shrink-0 overflow-hidden">

            {/* brand mark — just the dot, no text */}
            <div className="w-2 h-2 rounded-full bg-[#e5173f] flex-shrink-0 mr-1" />

            {/* networks */}
            {socialNetworks.map(net => {
                const cfg = NET[net.id];
                const isActive = activeNetwork === net.id;
                return (
                    <button
                        key={net.id}
                        type="button"
                        title={net.name}
                        onClick={() => { setActiveNetwork(net.id); if (!net.connected) toggleNetworkConnection(net.id); }}
                        className={[
                            'relative w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-100 flex-shrink-0',
                            isActive ? (cfg?.activeClass ?? 'bg-[#e5173f] text-white') : 'text-[#28282e] hover:text-[#6a6a72] hover:bg-[#131316]',
                        ].join(' ')}
                    >
                        {cfg?.icon}
                        {net.connected && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-[1.5px] ring-[#0a0a0c]" />
                        )}
                    </button>
                );
            })}

            <Sep />

            {/* format */}
            {FORMATS.map(f => (
                <Chip key={f.id} active={format === f.id} onClick={() => setFormat(f.id)} title={f.label}>
                    {f.icon}{f.label}
                </Chip>
            ))}

            <Sep />

            {/* layout */}
            {LAYOUTS.map(l => (
                <Chip key={l.id} active={layoutMode === l.id} onClick={() => setLayoutMode(l.id)} title={l.label}>
                    {l.icon}{l.label}
                </Chip>
            ))}

            {/* aspect ratio — video only */}
            {isVideo && (
                <>
                    <Sep />
                    {(['9:16', '16:9'] as const).map(ar => (
                        <Chip key={ar} active={aspectRatio === ar} onClick={() => setAspectRatio(ar)}>{ar}</Chip>
                    ))}
                </>
            )}

            <Sep />

            {/* font size */}
            <input
                type="range" min={24} max={96} step={2} value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                title={`Fuente: ${fontSize}px`}
                className="w-16 h-0.5 appearance-none rounded cursor-pointer flex-shrink-0"
                style={{ accentColor: '#e5173f' }}
            />
            <span className="text-[10px] font-mono text-[#3a3a42] w-5 flex-shrink-0">{fontSize}</span>

            {/* watermark */}
            <button
                type="button"
                onClick={() => setShowWatermark(!showWatermark)}
                title="Marca de agua"
                className={[
                    'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 transition-all',
                    showWatermark ? 'text-[#e5173f] border border-[#e5173f]/30 bg-[#e5173f]/8' : 'text-[#2a2a30] border border-[#1a1a1e]',
                ].join(' ')}
            >
                <Check size={8} />WM
            </button>

            <Sep />

            {/* IA quick tools */}
            <Chip onClick={generateSmartCaption} title="Generar caption inteligente"><Wand2 size={10} />Caption</Chip>
            <Chip onClick={doHashtags} title="Auto hashtags"><Hash size={10} />Tags</Chip>
            <Chip onClick={doShorten} title="Acortar a 9 palabras"><Scissors size={10} />Cortar</Chip>
            <Chip onClick={doTitleCase} title="Title Case"><Type size={10} />Case</Chip>

            {/* spacer */}
            <div className="flex-1 min-w-0" />

            {/* right actions */}
            {smartCaption && (
                <Chip onClick={copyCaption} title="Copiar caption"><Copy size={10} />Caption</Chip>
            )}
            <Chip onClick={handleSmartShare} title="Compartir"><Share2 size={10} />Compartir</Chip>

            {isVideo ? (
                <button
                    type="button"
                    onClick={handleRecordVideo}
                    disabled={isRecording}
                    className={[
                        'flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-bold flex-shrink-0 transition-all',
                        isRecording
                            ? 'bg-red-900/40 text-red-400 border border-red-900/30 cursor-not-allowed'
                            : 'bg-[#e5173f] text-white hover:bg-red-500',
                    ].join(' ')}
                >
                    {isRecording
                        ? <><RefreshCw size={10} className="animate-spin" />{Math.round(recordingProgress)}%</>
                        : <><Video size={10} />Grabar</>}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={downloadImage}
                    disabled={isTainted}
                    className="flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-bold bg-white text-black hover:bg-gray-100 disabled:opacity-40 flex-shrink-0 transition-all"
                >
                    <Download size={10} />Exportar
                </button>
            )}
        </header>
    );
}
