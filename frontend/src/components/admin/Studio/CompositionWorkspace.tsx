'use client';

// The new Content Studio landing (rule #14/#15) — receives an ALREADY
// PRODUCED Composition, never a file. No permanent toolbar, no timeline, no
// "cargar LAB": just PREVIEW + CONTEXT + CONTENT + PLATFORMS + STATUS, and
// three actions. Advanced editing (canvas/timeline/audio/etc.) is a
// separate layer behind [Editar] — the pre-existing rich Studio, reused
// as-is, not rebuilt.

import React from 'react';
import { ArrowRight, Edit3, CheckCircle2, Radio, Sparkles, Film, Waves, Clapperboard } from 'lucide-react';
import { useProduction } from '@/studio/lab/ProductionContext';
import { DS } from '@/components/admin/SocialMedia/TopBar';

const STATUS_COLOR: Record<string, string> = {
    DRAFT: DS.muted, READY_FOR_REVIEW: '#f59e0b', APPROVED: '#22c55e', REJECTED: '#ef4444',
};
const STATUS_LABEL: Record<string, string> = {
    DRAFT: 'Borrador', READY_FOR_REVIEW: 'Esperando revisión', APPROVED: 'Aprobada', REJECTED: 'Rechazada',
};

export function CompositionWorkspace({ onEdit }: { onEdit: () => void }) {
    const { workspace, primaryComposition, setActiveView, reviewComposition } = useProduction();

    if (!workspace?.story) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <Film size={28} style={{ color: DS.muted }} className="mx-auto mb-3" />
                    <p className="text-[13px] font-semibold" style={{ color: DS.txt }}>Sin historia producida</p>
                    <p className="text-[11px] mt-1" style={{ color: DS.sub }}>Studio interviene sobre contenido que LAB ya produjo — producí una historia primero.</p>
                    <button onClick={() => setActiveView('production')}
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold"
                        style={{ background: DS.accentDim, color: DS.accent }}>
                        Ir a Producción <ArrowRight size={12} />
                    </button>
                </div>
            </div>
        );
    }

    const story = workspace.story;
    const composition = primaryComposition;

    if (!composition) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <p className="text-[13px] font-semibold" style={{ color: DS.txt }}>{story.headline}</p>
                    <p className="text-[11px] mt-1" style={{ color: DS.sub }}>La producción todavía no generó una Composition (sin hooks/guion/render disponibles).</p>
                </div>
            </div>
        );
    }

    const content = composition.content;
    const statusColor = STATUS_COLOR[composition.status];

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
                {/* PREVIEW */}
                <div className="flex flex-col items-center gap-2">
                    <div className="w-full rounded-2xl overflow-hidden flex items-center justify-center"
                        style={{ aspectRatio: '9/16', background: '#000', border: `1px solid ${DS.border}` }}>
                        {content.finalAssetUrl ? (
                            <video src={content.finalAssetUrl} controls className="w-full h-full object-contain" />
                        ) : (
                            <span className="text-[11px] px-4 text-center" style={{ color: DS.muted }}>Sin preview — render pendiente</span>
                        )}
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                        style={{ color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}30` }}>
                        <CheckCircle2 size={10} />{STATUS_LABEL[composition.status]}
                    </span>
                </div>

                {/* CONTEXT + CONTENT + PLATFORMS + ACTIONS */}
                <div className="space-y-4 min-w-0">
                    <div>
                        <h2 className="text-lg font-bold" style={{ color: DS.txt }}>{story.headline}</h2>
                        {content.angle && <p className="text-[11px] mt-0.5" style={{ color: DS.sub }}>Ángulo: {content.angle} · {composition.kind}</p>}
                    </div>

                    {content.hook && (
                        <div className="p-3 rounded-xl flex items-start gap-2" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                            <Sparkles size={14} style={{ color: DS.accent, flexShrink: 0, marginTop: 2 }} />
                            <p className="text-[12px] italic" style={{ color: DS.txt }}>&ldquo;{content.hook}&rdquo;</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        {content.narrativeSummary && (
                            <div className="p-2.5 rounded-xl flex items-start gap-1.5" style={{ background: DS.surfaceMid }}>
                                <Waves size={12} style={{ color: '#a78bfa', flexShrink: 0, marginTop: 1 }} />
                                <span className="text-[10px]" style={{ color: DS.sub }}>{content.narrativeSummary}</span>
                            </div>
                        )}
                        {content.mediaSummary && (
                            <div className="p-2.5 rounded-xl flex items-start gap-1.5" style={{ background: DS.surfaceMid }}>
                                <Clapperboard size={12} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                                <span className="text-[10px]" style={{ color: DS.sub }}>{content.mediaSummary}</span>
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-[9px] font-bold tracking-[0.2em] uppercase mb-1.5" style={{ color: DS.muted }}>Plataformas</p>
                        {composition.targetPlatforms.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {composition.targetPlatforms.map(p => (
                                    <span key={p} className="text-[10px] font-semibold px-2 py-1 rounded-md" style={{ background: DS.surfaceMid, color: DS.sub }}>{p}</span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[10px]" style={{ color: DS.sub }}>Sin plataformas seleccionadas todavía.</p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2" style={{ borderTop: `1px solid ${DS.borderSub}` }}>
                        <button onClick={onEdit}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all"
                            style={{ background: DS.surfaceMid, color: DS.txt, border: `1px solid ${DS.border}` }}>
                            <Edit3 size={12} />Editar
                        </button>

                        {composition.status === 'READY_FOR_REVIEW' && (
                            <button onClick={() => reviewComposition(composition.id, 'APPROVE')}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all"
                                style={{ background: DS.accent, color: '#fff' }}>
                                <CheckCircle2 size={12} />Revisar y aprobar
                            </button>
                        )}

                        {composition.status === 'APPROVED' && (
                            <button onClick={() => setActiveView('distribution')}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all"
                                style={{ background: DS.accentDim, color: DS.accent }}>
                                <Radio size={12} />Preparar distribución
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
