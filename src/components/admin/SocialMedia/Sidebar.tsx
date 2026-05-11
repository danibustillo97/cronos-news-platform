'use client';

import React, { useState } from 'react';
import {
    Search, Music, DollarSign, Newspaper,
    RefreshCw, Volume2, Mic, Zap, X,
    Image as ImageIcon, ChevronRight, Clock,
    ExternalLink,
} from 'lucide-react';
import { useStudioContext } from './context';
import { DS } from './TopBar';

/* ═══ atoms ═══ */
const Label = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[9px] font-bold tracking-[0.2em] uppercase mb-1.5" style={{ color: DS.sub }}>{children}</p>
);

const Field = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-1.5">{children}</div>
);

const Input = ({ icon, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }) => (
    <div className="relative">
        {icon && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: DS.sub }}>{icon}</span>}
        <input {...p}
            className="w-full rounded-xl py-2 text-[12px] outline-none transition-all"
            style={{
                background: DS.surface,
                border: `1px solid ${DS.border}`,
                color: DS.txt,
                paddingLeft: icon ? 32 : 10,
                paddingRight: 10,
            }}
            onFocus={e => (e.target.style.borderColor = `${DS.accent}50`)}
            onBlur={e => (e.target.style.borderColor = DS.border)}
        />
    </div>
);

const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...p}
        className="w-full rounded-xl py-2 px-2.5 text-[12px] outline-none transition-all resize-none"
        style={{ background: DS.surface, border: `1px solid ${DS.border}`, color: DS.txt }}
        onFocus={e => (e.target.style.borderColor = `${DS.accent}50`)}
        onBlur={e => (e.target.style.borderColor = DS.border)}
    />
);

const Toggle = ({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) => (
    <button type="button" onClick={() => onChange(!on)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all"
        style={{
            background: on ? `${DS.accent}10` : DS.surface,
            border: `1px solid ${on ? `${DS.accent}25` : DS.border}`,
        }}
    >
        <span className="text-[11px] font-medium" style={{ color: on ? DS.txt : DS.sub }}>{label}</span>
        <div className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
            style={{ background: on ? DS.accent : DS.muted }}
        >
            <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all"
                style={{ left: on ? 17 : 2 }} />
        </div>
    </button>
);

/* ═══ NEWS CARD ═══ */
function NewsCard({ n, sel, onSelect }: { n: any; sel: boolean; onSelect: () => void }) {
    const date = new Date(n.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' });
    return (
        <button type="button" onClick={onSelect}
            className="w-full text-left rounded-xl overflow-hidden transition-all group"
            style={{
                border: `1px solid ${sel ? `${DS.accent}25` : 'transparent'}`,
                background: sel ? `${DS.accent}08` : 'transparent',
            }}
            onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = DS.surface; }}
            onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
            <div className="flex gap-2 p-2">
                {/* thumbnail */}
                {n.image_url ? (
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden">
                        <img src={n.image_url} className="w-full h-full object-cover" alt="" />
                    </div>
                ) : (
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ background: DS.surfaceMid }}>
                        <Newspaper size={14} style={{ color: DS.muted }} />
                    </div>
                )}
                <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-[11px] font-medium leading-snug line-clamp-2"
                        style={{ color: sel ? DS.txt : DS.sub }}>
                        {n.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: sel ? `${DS.accent}15` : DS.surfaceMid, color: sel ? DS.accent : DS.muted }}>
                            {n.category}
                        </span>
                        <span className="text-[9px]" style={{ color: DS.muted }}>{date}</span>
                    </div>
                </div>
                {sel && <ExternalLink size={10} className="flex-shrink-0 mt-1" style={{ color: DS.accent }} />}
            </div>
        </button>
    );
}

/* ═══ CONTENT PANEL ═══ */
function ContentPanel() {
    const { searchTerm, setSearchTerm, news, selectedNews, handleNewsSelect, customTitle, setCustomTitle } = useStudioContext();
    const filtered = news.filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex flex-col h-full min-h-0 p-3 gap-3">
            <Input
                type="text"
                placeholder="Buscar noticia…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                icon={<Search size={12} />}
            />

            <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5 -mr-1 pr-1">
                {filtered.map(n => (
                    <NewsCard
                        key={n.id} n={n}
                        sel={selectedNews?.id === n.id}
                        onSelect={() => handleNewsSelect(n)}
                    />
                ))}
                {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <Newspaper size={20} style={{ color: DS.muted }} />
                        <p className="text-[11px]" style={{ color: DS.muted }}>Sin resultados</p>
                    </div>
                )}
            </div>

            <Field>
                <Label>Titular del canvas</Label>
                <Textarea rows={3} value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                    placeholder="Texto que aparecerá en el canvas…" />
            </Field>
        </div>
    );
}

/* ═══ AUDIO PANEL ═══ */
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
            <div>
                <Label>Música de fondo</Label>
                <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group"
                    style={{ background: DS.surface, border: `1px solid ${DS.border}` }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = `${DS.accent}30`)}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = DS.border)}
                >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: DS.surfaceMid }}>
                        <Music size={14} style={{ color: DS.sub }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate" style={{ color: bgAudioName ? DS.txt : DS.sub }}>
                            {bgAudioName || 'Subir archivo MP3'}
                        </p>
                        <p className="text-[9px] mt-0.5" style={{ color: DS.muted }}>Audio de fondo</p>
                    </div>
                    <ChevronRight size={12} style={{ color: DS.muted }} />
                    <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                </label>

                <div className="flex items-center gap-2 mt-2 px-1">
                    <Volume2 size={10} style={{ color: DS.muted }} />
                    <input type="range" min={0} max={100} value={Math.round(bgAudioVolume * 100)}
                        onChange={e => setBgAudioVolume(Number(e.target.value) / 100)}
                        className="flex-1 h-0.5 appearance-none rounded cursor-pointer"
                        style={{ accentColor: DS.accent }}
                    />
                    <span className="text-[10px] font-mono w-7 text-right" style={{ color: DS.sub }}>
                        {Math.round(bgAudioVolume * 100)}%
                    </span>
                </div>
            </div>

            {/* voice */}
            <div>
                <Label>Narración IA</Label>
                <div className="space-y-2">
                    <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
                        className="w-full rounded-xl px-2.5 py-2 text-[12px] outline-none appearance-none cursor-pointer"
                        style={{ background: DS.surface, border: `1px solid ${DS.border}`, color: DS.txt }}
                    >
                        <option value="">— Seleccionar voz —</option>
                        {voices.map(v => <option key={v.id} value={v.id}>{v.label} · {v.locale}</option>)}
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                        {([
                            { label: 'Velocidad', value: voiceRate, onChange: setVoiceRate, prefix: '', suffix: '%' },
                            { label: 'Tono', value: voicePitch, onChange: setVoicePitch, prefix: '+', suffix: 'Hz' },
                        ]).map(ctrl => {
                            const num = parseInt(ctrl.value.replace('%','').replace('Hz','').replace('+',''), 10) || 0;
                            return (
                                <div key={ctrl.label} className="p-2 rounded-xl" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                                    <div className="flex justify-between mb-1.5">
                                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.sub }}>{ctrl.label}</span>
                                        <span className="text-[9px] font-mono" style={{ color: DS.txt }}>{ctrl.value}</span>
                                    </div>
                                    <input type="range" min={-50} max={50} step={5} value={num}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            ctrl.onChange(ctrl.suffix === '%' ? `${v}%` : `${v >= 0 ? '+' : ''}${v}Hz`);
                                        }}
                                        className="w-full h-0.5 appearance-none rounded cursor-pointer"
                                        style={{ accentColor: DS.accent }}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex gap-2">
                        <button type="button" onClick={generateNeuralAudio} disabled={isGeneratingAudio}
                            className="flex-1 py-2 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all"
                            style={{ background: isGeneratingAudio ? DS.surface : '#fff', color: isGeneratingAudio ? DS.muted : '#000' }}
                        >
                            {isGeneratingAudio
                                ? <><RefreshCw size={11} className="animate-spin" />{generationProgress || 'Generando…'}</>
                                : <><Zap size={11} />Generar voces</>}
                        </button>
                        {isSpeaking && (
                            <button type="button" onClick={stop}
                                className="w-10 rounded-xl flex items-center justify-center transition-all"
                                style={{ background: `${DS.accent}15`, color: DS.accent, border: `1px solid ${DS.accent}25` }}
                            ><X size={13} /></button>
                        )}
                    </div>

                    <Toggle label="Micrófono" on={micEnabled} onChange={handleMicToggle} />
                </div>
            </div>
        </div>
    );
}

/* ═══ SPONSOR PANEL ═══ */
function SponsorPanel() {
    const { sponsorName, setSponsorName, sponsorLogo, setSponsorLogo, handleLogoUpload } = useStudioContext();

    return (
        <div className="p-3 space-y-3 overflow-y-auto h-full">
            <label className={`relative aspect-[3/1] rounded-2xl overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all`}
                style={{
                    background: DS.surface,
                    border: `2px dashed ${sponsorLogo ? DS.border : DS.muted}`,
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = `${DS.accent}40`)}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = sponsorLogo ? DS.border : DS.muted)}
            >
                {sponsorLogo ? (
                    <>
                        <img src={sponsorLogo} className="w-full h-full object-contain p-4" alt="Logo" />
                        <button type="button" onClick={e => { e.preventDefault(); setSponsorLogo(null); }}
                            className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center z-10 transition-all"
                            style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
                        ><X size={10} /></button>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 pointer-events-none">
                        <ImageIcon size={18} style={{ color: DS.muted }} />
                        <p className="text-[10px] font-medium" style={{ color: DS.muted }}>Subir logo del sponsor (PNG)</p>
                    </div>
                )}
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>

            <Field>
                <Label>Nombre del sponsor</Label>
                <Input type="text" placeholder="Ej: SAMSUNG" value={sponsorName} onChange={e => setSponsorName(e.target.value)} />
            </Field>

            {(sponsorName || sponsorLogo) && (
                <div className="p-3 rounded-2xl" style={{ background: DS.surfaceMid, border: `1px solid ${DS.border}` }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: DS.muted }}>Preview</p>
                    <div className="flex items-center gap-3">
                        {sponsorLogo && <img src={sponsorLogo} className="h-6 object-contain" alt="" />}
                        {sponsorName && <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: DS.txt }}>{sponsorName}</span>}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══ SIDEBAR ROOT ═══ */
type Tab = 'content' | 'audio' | 'sponsor';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'content', label: 'Noticias', icon: <Newspaper size={11} /> },
    { id: 'audio',   label: 'Audio',    icon: <Music size={11} /> },
    { id: 'sponsor', label: 'Sponsor',  icon: <DollarSign size={11} /> },
];
const PANELS: Record<Tab, React.FC> = { content: ContentPanel, audio: AudioPanel, sponsor: SponsorPanel };

export function Sidebar() {
    const [tab, setTab] = useState<Tab>('content');
    const Panel = PANELS[tab];

    return (
        <aside className="flex flex-col flex-shrink-0 h-full overflow-hidden"
            style={{ width: 260, background: DS.bg, borderRight: `1px solid ${DS.borderSub}` }}
        >
            {/* tab bar */}
            <div className="flex flex-shrink-0" style={{ borderBottom: `1px solid ${DS.borderSub}` }}>
                {TABS.map(t => (
                    <button key={t.id} type="button" onClick={() => setTab(t.id)}
                        className="relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-all"
                        style={{ color: tab === t.id ? DS.txt : DS.sub }}
                    >
                        {t.icon}{t.label}
                        {tab === t.id && (
                            <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                                style={{ background: DS.accent }} />
                        )}
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
                <Panel />
            </div>
        </aside>
    );
}
