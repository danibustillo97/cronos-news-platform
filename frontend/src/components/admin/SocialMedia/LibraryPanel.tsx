'use client';

import React, { useState } from 'react';
import {
    Search, Newspaper, LayoutTemplate, Smartphone,
    ChevronRight, ExternalLink, Clock,
} from 'lucide-react';
import { useStudioContext } from './context';
import { DS } from './TopBar';
import { TikTokTemplates } from './TikTokTemplates';
import type { LayoutMode } from '@/studio/shared/types';

const LAYOUT_LABEL: Record<Exclude<LayoutMode, 'auto'>, string> = {
    overlay: 'Overlay',
    split: 'Split',
    breaking: 'Urgente',
    minimal: 'Clean',
};

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

/* ═══ NOTICIAS ═══ */
function NewsPanel() {
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

/* ═══ PLANTILLAS ═══ */
function TemplatesPanel() {
    return (
        <div className="h-full overflow-y-auto">
            <TikTokTemplates />
        </div>
    );
}

/* ═══ LAYOUTS VIRALES ═══ */
// Cada layout mapea 1 a 1 a un layoutMode real que el canvas ya sabe
// renderizar — aplicar uno cambia de verdad el diseño, no solo el título.
const VIRAL_LAYOUTS: { id: string; name: string; layoutMode: Exclude<LayoutMode, 'auto'>; titlePrefix: string; duration: number }[] = [
    { id: 'breaking', name: 'Breaking News', layoutMode: 'breaking', titlePrefix: '🔴 ÚLTIMA HORA: ', duration: 15 },
    { id: 'comparison', name: 'VS Battle', layoutMode: 'split', titlePrefix: '⚔️ ', duration: 20 },
    { id: 'stats', name: 'Stats Card', layoutMode: 'minimal', titlePrefix: '📊 ', duration: 12 },
    { id: 'reaction', name: 'Reaction', layoutMode: 'overlay', titlePrefix: '😱 ', duration: 18 },
];

function LayoutsPanel() {
    const { selectedNews, setLayoutMode, setCustomTitle } = useStudioContext();
    const [selected, setSelected] = useState<string | null>(null);

    const applyLayout = (layout: typeof VIRAL_LAYOUTS[0]) => {
        setSelected(layout.id);
        setLayoutMode(layout.layoutMode);
        setCustomTitle(`${layout.titlePrefix}${selectedNews?.title ?? 'Selecciona una noticia…'}`);
    };

    return (
        <div className="p-3 space-y-2 overflow-y-auto h-full">
            <div className="flex items-center gap-2 px-1 mb-1">
                <LayoutTemplate size={14} style={{ color: DS.accent }} />
                <span className="text-[11px] font-bold" style={{ color: DS.txt }}>Layouts Virales</span>
            </div>
            {VIRAL_LAYOUTS.map((layout) => (
                <button
                    key={layout.id}
                    onClick={() => applyLayout(layout)}
                    className="w-full p-3 rounded-xl text-left transition-all border"
                    style={{
                        background: selected === layout.id ? `${DS.accent}10` : DS.surface,
                        borderColor: selected === layout.id ? DS.accent : DS.border,
                    }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold" style={{ color: DS.txt }}>
                            {layout.name}
                        </span>
                        <span className="text-[9px] flex items-center gap-1" style={{ color: DS.sub }}>
                            <Clock size={10} />
                            ≈{layout.duration}s
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: DS.surfaceMid, color: DS.sub }}>
                            {LAYOUT_LABEL[layout.layoutMode]}
                        </span>
                        <ChevronRight size={12} className="ml-auto" style={{ color: DS.sub }} />
                    </div>
                </button>
            ))}
        </div>
    );
}

/* ═══ LIBRARY PANEL ROOT ═══ */
type Tab = 'content' | 'templates' | 'layouts';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'content',   label: 'Noticias',   icon: <Newspaper size={11} /> },
    { id: 'templates', label: 'Plantillas', icon: <Smartphone size={11} /> },
    { id: 'layouts',   label: 'Layouts',    icon: <LayoutTemplate size={11} /> },
];
const PANELS: Record<Tab, React.FC> = { content: NewsPanel, templates: TemplatesPanel, layouts: LayoutsPanel };

export function LibraryPanel() {
    const [tab, setTab] = useState<Tab>('content');
    const Panel = PANELS[tab];

    return (
        <aside className="flex flex-col flex-shrink-0 h-full overflow-hidden"
            style={{ width: 260, background: DS.bg, borderRight: `1px solid ${DS.borderSub}` }}
        >
            <div className="px-3 pt-3 pb-1">
                <p className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: DS.muted }}>Biblioteca</p>
            </div>

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
