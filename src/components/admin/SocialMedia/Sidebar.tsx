'use client';

import React, { useState } from 'react';
import {
    Search, Music, DollarSign, Newspaper,
    RefreshCw, Volume2, Mic, Zap, X,
    ImageIcon, ChevronRight, Share2,
} from 'lucide-react';
import { useStudioContext } from './context';

/* ── tokens ── */
const S = 'bg-[#0f0f11]';
const B = 'border-[#1c1c20]';
const T = 'text-[#e0e0e6]';
const SUB = 'text-[#505058]';
const HOV = 'hover:bg-[#151518]';

const EL = ({ c }: { c: string }) => (
    <p className={`text-[9px] font-bold tracking-[0.18em] uppercase ${SUB} mb-1`}>{c}</p>
);

const Inp = ({ pre, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { pre?: React.ReactNode }) => (
    <div className="relative">
        {pre && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{pre}</span>}
        <input {...p}
            className={`w-full ${S} border ${B} rounded-lg py-2 text-[12px] ${T} placeholder-[#2e2e34] outline-none focus:border-[#e5173f]/40 transition-all ${pre ? 'pl-8 pr-2.5' : 'px-2.5'}`}
        />
    </div>
);

const Tx = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...p}
        className={`w-full ${S} border ${B} rounded-lg p-2.5 text-[12px] ${T} placeholder-[#2e2e34] outline-none focus:border-[#e5173f]/40 resize-none transition-all`}
    />
);

const Row = ({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) => (
    <button type="button" onClick={() => onChange(!on)}
        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg border transition-all ${on ? 'border-[#e5173f]/20 bg-[#e5173f]/5' : `${B} ${S} ${HOV}`}`}
    >
        <span className={`text-[11px] font-medium ${on ? T : SUB}`}>{label}</span>
        <div className={`relative w-7 h-[16px] rounded-full transition-colors ${on ? 'bg-[#e5173f]' : 'bg-[#252528]'}`}>
            <div className={`absolute top-[2px] w-3 h-3 rounded-full bg-white shadow transition-all ${on ? 'left-[13px]' : 'left-[2px]'}`} />
        </div>
    </button>
);

/* ── tabs ── */
type Tab = 'content' | 'audio' | 'sponsor';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'content', label: 'Noticias', icon: <Newspaper size={12} /> },
    { id: 'audio',   label: 'Audio',    icon: <Music size={12} /> },
    { id: 'sponsor', label: 'Sponsor',  icon: <DollarSign size={12} /> },
];

/* ── content panel ── */
function ContentPanel() {
    const { searchTerm, setSearchTerm, news, selectedNews, handleNewsSelect, customTitle, setCustomTitle } = useStudioContext();
    const filtered = news.filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex flex-col h-full min-h-0 gap-2 p-3">
            <Inp type="text" placeholder="Buscar noticia…" value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                pre={<Search size={12} className={SUB} />}
            />

            {/* news list — takes remaining space */}
            <div className="flex-1 overflow-y-auto space-y-px min-h-0">
                {filtered.map(n => {
                    const sel = selectedNews?.id === n.id;
                    return (
                        <button key={n.id} type="button" onClick={() => handleNewsSelect(n)}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] transition-all ${sel ? 'bg-[#e5173f]/8 border border-[#e5173f]/15 text-[#e0e0e6]' : `text-[#505058] ${HOV} hover:text-[#a0a0a8] border border-transparent`}`}
                        >
                            <div className="flex items-start gap-1.5">
                                {sel && <div className="mt-1.5 w-1 h-1 rounded-full bg-[#e5173f] flex-shrink-0" />}
                                <div className="min-w-0">
                                    <p className="font-medium leading-snug line-clamp-2">{n.title}</p>
                                    <p className={`text-[9px] mt-0.5 ${sel ? 'text-[#e5173f]/60' : 'text-[#2e2e34]'}`}>
                                        {n.category} · {new Date(n.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                                    </p>
                                </div>
                            </div>
                        </button>
                    );
                })}
                {filtered.length === 0 && <p className={`text-center py-6 text-[11px] text-[#2e2e34]`}>Sin resultados</p>}
            </div>

            {/* title editor — fixed at bottom */}
            <div className="flex-shrink-0 space-y-1">
                <EL c="Titular" />
                <Tx rows={3} value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Texto del canvas…" />
            </div>
        </div>
    );
}

/* ── audio panel ── */
function AudioPanel() {
    const {
        bgAudioName, bgAudioVolume, setBgAudioVolume, handleAudioUpload,
        voices, selectedVoice, setSelectedVoice,
        voiceRate, setVoiceRate, voicePitch, setVoicePitch,
        generateNeuralAudio, isGeneratingAudio, generationProgress,
        isSpeaking, stop, micEnabled, handleMicToggle,
    } = useStudioContext();

    return (
        <div className="p-3 space-y-4 overflow-y-auto h-full">
            {/* bg music */}
            <div className="space-y-2">
                <EL c="Música de fondo" />
                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${B} ${S} cursor-pointer ${HOV} transition-all`}>
                    <div className="w-7 h-7 rounded-lg bg-[#1a1a1e] flex items-center justify-center flex-shrink-0">
                        <Music size={13} className={SUB} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-[12px] font-medium truncate ${bgAudioName ? T : SUB}`}>{bgAudioName || 'Subir MP3'}</p>
                    </div>
                    <ChevronRight size={11} className={SUB} />
                    <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                </label>
                <div className="flex items-center gap-2">
                    <Volume2 size={11} className={SUB} />
                    <input type="range" min={0} max={100} value={Math.round(bgAudioVolume * 100)}
                        onChange={e => setBgAudioVolume(Number(e.target.value) / 100)}
                        className="flex-1 h-0.5 appearance-none rounded cursor-pointer"
                        style={{ accentColor: '#e5173f' }}
                    />
                    <span className={`text-[10px] font-mono w-7 text-right ${SUB}`}>{Math.round(bgAudioVolume * 100)}%</span>
                </div>
            </div>

            {/* voice */}
            <div className="space-y-2">
                <EL c="Narración IA" />
                <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
                    className={`w-full ${S} border ${B} rounded-lg px-2.5 py-2 text-[12px] ${T} outline-none appearance-none cursor-pointer`}
                >
                    <option value="">— Seleccionar voz —</option>
                    {voices.map(v => <option key={v.id} value={v.id}>{v.label} · {v.locale}</option>)}
                </select>

                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label: 'Velocidad', value: voiceRate, set: setVoiceRate, key: 'rate' },
                        { label: 'Tono',      value: voicePitch, set: setVoicePitch, key: 'pitch' },
                    ].map(({ label, value, set }) => (
                        <div key={label}>
                            <div className="flex justify-between mb-1">
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${SUB}`}>{label}</span>
                                <span className={`text-[9px] font-mono ${T}`}>{value}</span>
                            </div>
                            <input type="range" min={-50} max={50} step={5}
                                value={parseInt(value.replace('%', '').replace('Hz', '').replace('+', ''), 10) || 0}
                                onChange={e => {
                                    const v = Number(e.target.value);
                                    if (label === 'Velocidad') set(`${v}%`);
                                    else set(`${v >= 0 ? '+' : ''}${v}Hz`);
                                }}
                                className="w-full h-0.5 appearance-none rounded cursor-pointer"
                                style={{ accentColor: '#e5173f' }}
                            />
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <button type="button" onClick={generateNeuralAudio} disabled={isGeneratingAudio}
                        className={`flex-1 py-2 rounded-lg text-[12px] font-bold flex items-center justify-center gap-2 transition-all ${isGeneratingAudio ? 'bg-[#141416] text-[#2e2e34] cursor-not-allowed' : 'bg-white text-black hover:bg-gray-100'}`}
                    >
                        {isGeneratingAudio ? <><RefreshCw size={11} className="animate-spin" />{generationProgress || 'Generando…'}</> : <><Zap size={11} />Generar</>}
                    </button>
                    {isSpeaking && (
                        <button type="button" onClick={stop}
                            className={`w-9 rounded-lg bg-[#e5173f]/10 text-[#e5173f] border border-[#e5173f]/20 flex items-center justify-center`}
                        ><X size={12} /></button>
                    )}
                </div>
                <Row label="Micrófono" on={micEnabled} onChange={handleMicToggle} />
            </div>
        </div>
    );
}

/* ── sponsor panel ── */
function SponsorPanel() {
    const { sponsorName, setSponsorName, sponsorLogo, setSponsorLogo, handleLogoUpload } = useStudioContext();

    return (
        <div className="p-3 space-y-3 overflow-y-auto h-full">
            <div className={`relative aspect-[3/1] rounded-xl border-2 border-dashed overflow-hidden ${sponsorLogo ? 'border-[#2a2a2e]' : 'border-[#1a1a1e] hover:border-[#2e2e34]'} transition-all`}>
                {sponsorLogo ? (
                    <>
                        <img src={sponsorLogo} className="w-full h-full object-contain p-3 bg-[#0c0c0e]" alt="Logo" />
                        <button type="button" onClick={() => setSponsorLogo(null)}
                            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-[#e5173f]"
                        ><X size={9} /></button>
                    </>
                ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center gap-1.5 cursor-pointer">
                        <ImageIcon size={16} className={SUB} />
                        <p className={`text-[10px] ${SUB}`}>Subir logo PNG</p>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                )}
            </div>
            <div className="space-y-1">
                <EL c="Nombre" />
                <Inp type="text" placeholder="Ej: COCA-COLA" value={sponsorName} onChange={e => setSponsorName(e.target.value)} />
            </div>
            {(sponsorName || sponsorLogo) && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#0c0c0e] border border-[#1a1a1e]">
                    {sponsorLogo && <img src={sponsorLogo} className="h-5 object-contain" alt="" />}
                    {sponsorName && <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{sponsorName}</span>}
                </div>
            )}
        </div>
    );
}

const PANELS: Record<Tab, React.FC> = { content: ContentPanel, audio: AudioPanel, sponsor: SponsorPanel };

/* ── sidebar root ── */
export function Sidebar() {
    const [tab, setTab] = useState<Tab>('content');
    const Panel = PANELS[tab];

    return (
        <aside className="flex flex-col w-64 min-w-[256px] bg-[#0c0c0e] border-r border-[#141418] h-full overflow-hidden flex-shrink-0">
            {/* tab strip */}
            <div className="flex border-b border-[#141418] flex-shrink-0">
                {TABS.map(t => (
                    <button key={t.id} type="button" onClick={() => setTab(t.id)}
                        className={`relative flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-all ${tab === t.id ? 'text-[#e0e0e6]' : `${SUB} hover:text-[#7a7a80]`}`}
                    >
                        {t.icon}{t.label}
                        {tab === t.id && <span className="absolute bottom-0 inset-x-0 h-[1.5px] bg-[#e5173f]" />}
                    </button>
                ))}
            </div>

            {/* panel — fills remaining height exactly */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <Panel />
            </div>
        </aside>
    );
}
