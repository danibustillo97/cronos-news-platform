'use client';

// Single production workspace for whichever story is active. NEW backend
// architecture: this no longer accepts manual file uploads — one click
// calls POST /api/stories/{id}/produce, which reads LAB's real export
// directly on the server and persists Story/Production/Composition rows in
// Supabase. This screen only renders the resulting projection
// (GET /api/stories/{id}/workspace) plus the Human Review gate.

import React, { useCallback, useEffect, useState } from 'react';
import {
    Factory, CheckCircle2, Circle, AlertTriangle, PlayCircle,
    ArrowRight, RefreshCw, DatabaseZap, LayoutList,
} from 'lucide-react';
import { RuntimeStatusBadge } from '@/components/admin/Production/RuntimeStatusBadge';
import { useProduction } from '@/studio/lab/ProductionContext';
import { DS } from '@/components/admin/SocialMedia/TopBar';

function StageRow({ done, label, detail }: { done: boolean; label: string; detail: string | null }) {
    return (
        <div className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ background: done ? '#22c55e08' : 'transparent' }}>
            {done ? <CheckCircle2 size={15} style={{ color: '#22c55e' }} /> : <Circle size={15} style={{ color: DS.muted }} />}
            <span className="text-[12px] font-medium w-32 flex-shrink-0" style={{ color: done ? DS.txt : DS.sub }}>{label}</span>
            <span className="text-[11px] truncate" style={{ color: DS.sub }}>{detail ?? (done ? '' : 'Pendiente')}</span>
        </div>
    );
}

const STATUS_COLOR: Record<string, string> = {
    RUNNING: '#3b82f6', PENDING: '#f59e0b', COMPLETED: '#22c55e', FAILED: '#ef4444',
};

function ProductionRow({ item, selected, onClick }: {
    item: { production: { id: string; storyId: string; status: string; stages: { done: boolean }[] }; storyHeadline: string | null };
    selected: boolean; onClick: () => void;
}) {
    const done = item.production.stages.filter(s => s.done).length;
    const total = item.production.stages.length;
    const color = STATUS_COLOR[item.production.status] ?? DS.muted;
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
            style={{ background: selected ? DS.surfaceMid : 'transparent' }}
        >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[12px] font-medium truncate flex-1" style={{ color: DS.txt }}>
                {item.storyHeadline ?? item.production.storyId}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide flex-shrink-0" style={{ color }}>
                {item.production.status.toLowerCase()}
            </span>
            <span className="text-[10px] flex-shrink-0" style={{ color: DS.sub }}>{done}/{total}</span>
        </button>
    );
}

export function ProductionWorkspace() {
    const {
        activeStory, storyId, workspace, primaryComposition, isProducing, isLoadingWorkspace, lastError,
        produceStory, reviewComposition, setActiveView, resetProduction,
        activeProductions, openProduction,
    } = useProduction();

    const [manualStoryId, setManualStoryId] = useState('');
    // Prefer the real story_id (LAB item_id, set once convert-to-content
    // ran) over whatever the user typed manually as a last-resort escape
    // hatch — nunca el newsId, que ya no coincide con el story_id real.
    const effectiveStoryId = activeStory?.storyId ?? storyId ?? null;

    const handleProduce = useCallback(() => {
        const id = effectiveStoryId || manualStoryId;
        if (id) produceStory(id);
    }, [effectiveStoryId, manualStoryId, produceStory]);

    const story = workspace?.story;
    const production = workspace?.production;
    const stages = production?.stages ?? [];
    const doneCount = stages.filter(s => s.done).length;
    const finalAssetUrl = primaryComposition?.content.finalAssetUrl ?? null;
    const readyForReview = primaryComposition?.status === 'READY_FOR_REVIEW';
    const approved = primaryComposition?.status === 'APPROVED';

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-5">
                {/* tablero operacional -- todas las producciones reales en curso */}
                {activeProductions.length > 0 && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${DS.borderSub}` }}>
                            <LayoutList size={14} style={{ color: DS.accent }} />
                            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: DS.sub }}>
                                Producciones ({activeProductions.length})
                            </span>
                        </div>
                        <div className="p-1.5 space-y-0.5 max-h-[220px] overflow-y-auto">
                            {activeProductions.map(item => (
                                <ProductionRow
                                    key={item.production.id}
                                    item={item}
                                    selected={item.production.storyId === (activeStory?.storyId ?? storyId)}
                                    onClick={() => openProduction(item.production.storyId, item.storyHeadline)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold truncate" style={{ color: DS.txt }}>
                            {story?.headline ?? activeStory?.title ?? 'Producción de contenido'}
                        </h2>
                        <p className="text-[12px] mt-0.5" style={{ color: DS.sub }}>
                            {production
                                ? `${doneCount} de ${stages.length} etapas — producción ${production.status.toLowerCase()}`
                                : 'Elegí una historia (desde News, o un story_id de LAB) y CRONOS orquesta la producción.'}
                        </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-3">
                        <RuntimeStatusBadge />
                        {story && (
                            <button onClick={resetProduction}
                                className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                                style={{ color: DS.sub, border: `1px solid ${DS.border}` }}
                            >
                                Nueva historia
                            </button>
                        )}
                    </div>
                </div>

                {/* produce control */}
                <div className="rounded-2xl p-4 space-y-3" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                    <div className="flex items-center gap-2">
                        <Factory size={14} style={{ color: DS.accent }} />
                        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: DS.sub }}>Producir</span>
                    </div>
                    <p className="text-[11px]" style={{ color: DS.sub }}>
                        CRONOS le pide a LAB los artifacts reales de esta historia y persiste el resultado — sin cargar archivos.
                    </p>

                    {!effectiveStoryId && (
                        <input
                            type="text" value={manualStoryId} onChange={e => setManualStoryId(e.target.value)}
                            placeholder="story_id de LAB (avanzado / debugging — el flujo normal es desde News)"
                            className="w-full rounded-lg px-3 py-2 text-[12px] outline-none"
                            style={{ background: DS.surfaceMid, border: `1px solid ${DS.border}`, color: DS.txt }}
                        />
                    )}

                    {/* Deshabilitado si ya hay una Production real: ese ciclo de vida
                        ahora lo maneja el Local Runtime (resume_production), nunca este
                        botón -- reusarlo acá pisaría el checklist real de 14 etapas con
                        una lectura síncrona de los 9 capability ports viejos y marcaría
                        FAILED una producción que en realidad solo está esperando al
                        Creative Worker (bug real encontrado y corregido en esta sesión). */}
                    <button onClick={handleProduce} disabled={isProducing || Boolean(production) || (!effectiveStoryId && !manualStoryId)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40"
                        style={{ background: DS.accent, color: '#fff' }}
                        title={production ? 'Esta historia ya tiene una producción real en curso — se actualiza sola.' : undefined}
                    >
                        {isProducing ? <RefreshCw size={12} className="animate-spin" /> : <Factory size={12} />}
                        {isProducing ? 'Produciendo…' : production ? 'En curso' : 'Producir historia'}
                    </button>

                    {lastError && (
                        <div className="flex items-start gap-2 rounded-lg p-2.5 text-[11px]" style={{ background: '#f59e0b0c', border: '1px solid #f59e0b30', color: '#f59e0b' }}>
                            <DatabaseZap size={13} className="flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold">{lastError.error === 'SCHEMA_NOT_PROVISIONED' ? 'Backend no provisto' : lastError.error}</p>
                                <p className="mt-0.5" style={{ color: DS.sub }}>
                                    {lastError.error === 'SCHEMA_NOT_PROVISIONED'
                                        ? 'Ejecutá supabase_setup/cronos_platform_schema.sql en el SQL Editor de Supabase para activar Producción/Composition/Distribución.'
                                        : lastError.message}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* checklist */}
                {production && (
                    <div className="rounded-2xl p-2" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                        {isLoadingWorkspace ? (
                            <div className="p-4 text-[11px]" style={{ color: DS.sub }}>Cargando…</div>
                        ) : stages.map(s => <StageRow key={s.id} done={s.done} label={s.label} detail={s.detail} />)}
                    </div>
                )}

                {production?.status === 'FAILED' && (
                    <div className="flex items-start gap-2 rounded-xl p-3 text-[11px]" style={{ background: '#ef444410', border: '1px solid #ef444430', color: '#ef4444' }}>
                        <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                        <span>{production.errors.join(' · ') || 'La producción falló.'}</span>
                    </div>
                )}

                {/* human review gate */}
                {primaryComposition && (readyForReview || approved) && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: DS.surface, border: `1px solid ${approved ? '#22c55e40' : DS.border}` }}>
                        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${DS.borderSub}` }}>
                            <PlayCircle size={14} style={{ color: approved ? '#22c55e' : DS.accent }} />
                            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: DS.sub }}>Human Review</span>
                        </div>
                        <div className="p-4 space-y-3">
                            {finalAssetUrl && (
                                <video
                                    src={finalAssetUrl}
                                    controls
                                    className="w-full max-w-[220px] rounded-xl"
                                    style={{ aspectRatio: '9/16', background: '#000' }}
                                />
                            )}
                            {primaryComposition.content.hook && (
                                <p className="text-[11px] italic" style={{ color: DS.sub }}>&ldquo;{primaryComposition.content.hook}&rdquo;</p>
                            )}

                            {approved ? (
                                <div className="flex items-center gap-2 text-[11px]" style={{ color: '#22c55e' }}>
                                    <CheckCircle2 size={13} />Revisado — disponible en Studio para publicar.
                                </div>
                            ) : (
                                <button
                                    onClick={() => reviewComposition(primaryComposition.id, 'APPROVE')}
                                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all"
                                    style={{ background: DS.accent, color: '#fff' }}
                                >
                                    Aprobar y enviar a Studio <ArrowRight size={12} />
                                </button>
                            )}
                            <button
                                onClick={() => setActiveView('social')}
                                className="ml-2 text-[11px] font-semibold"
                                style={{ color: DS.sub }}
                            >
                                Ir a Studio →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
