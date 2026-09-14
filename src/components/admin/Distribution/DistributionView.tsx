'use client';

// Content Outputs for the active story, sourced from the real backend
// projection (GET /api/stories/{id}/workspace). A story is not just "a
// video" — each row here is a DistributionPlan the backend computed, honest
// about which channels are actually wired up (rule #16/#35).

import React, { useEffect, useState } from 'react';
import {
    Globe, Smartphone, Instagram, Youtube, Facebook,
    CheckCircle2, Circle, ArrowRight, Link2, RefreshCw,
} from 'lucide-react';
import { useProduction } from '@/studio/lab/ProductionContext';
import { apiUrl } from '@/studio/lab/api-client';
import type { DistributionPlanDTO } from '@/studio/lab/api-types';
import { DS } from '@/components/admin/SocialMedia/TopBar';

const PLATFORM_ICON: Record<string, React.ReactNode> = {
    WEB: <Globe size={16} />, TIKTOK: <Smartphone size={16} />, INSTAGRAM: <Instagram size={16} />,
    FACEBOOK: <Facebook size={16} />, YOUTUBE: <Youtube size={16} />,
};
const PLATFORM_LABEL: Record<string, string> = {
    WEB: 'Web Article', TIKTOK: 'TikTok', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook', YOUTUBE: 'YouTube',
};
const ALL_PLATFORMS = ['WEB', 'TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE'];

function OutputRow({ plan, onPrepare }: { plan: DistributionPlanDTO | { platform: string; status: 'NOT_CONNECTED' }; onPrepare?: () => void }) {
    const status = plan.status;
    const color = status === 'PUBLISHED' ? '#22c55e' : status === 'READY' ? '#60a5fa' : status === 'PENDING' ? '#f59e0b' : status === 'FAILED' ? '#ef4444' : DS.muted;
    const label = { PUBLISHED: 'Publicado', READY: 'Listo', PENDING: 'En curso', FAILED: 'Falló', NOT_CONNECTED: 'No conectado' }[status];

    return (
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${DS.borderSub}` }}>
            <span className="flex-shrink-0" style={{ color: DS.sub }}>{PLATFORM_ICON[plan.platform]}</span>
            <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold" style={{ color: DS.txt }}>{PLATFORM_LABEL[plan.platform]}</p>
                {'copy' in plan && plan.copy && <p className="text-[11px] truncate" style={{ color: DS.sub }}>{plan.copy}</p>}
            </div>
            <span className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
                {status === 'PUBLISHED' || status === 'READY' ? <CheckCircle2 size={10} /> : <Circle size={10} />}
                {label}
            </span>
            {'publicationUrl' in plan && plan.publicationUrl && (
                <a href={plan.publicationUrl} target="_blank" rel="noreferrer"
                    className="flex-shrink-0 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg" style={{ color: DS.accent }}>
                    Ver →
                </a>
            )}
        </div>
    );
}

export function DistributionView() {
    const { activeStory, workspace, setActiveView } = useProduction();
    const [preparing, setPreparing] = useState(false);
    const [plans, setPlans] = useState<DistributionPlanDTO[] | null>(null);

    const composition = workspace?.compositions[0] ?? null;
    const existingPlans = composition ? workspace?.distributionPlans[composition.id] : undefined;

    useEffect(() => {
        setPlans(existingPlans ?? null);
    }, [existingPlans]);

    const prepareAll = async () => {
        if (!composition) return;
        setPreparing(true);
        try {
            const res = await fetch(apiUrl(`/api/compositions/${composition.id}/prepare-distribution`), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platforms: ALL_PLATFORMS, copy: composition.content.hook }),
            });
            if (res.ok) {
                const body = await res.json();
                setPlans(body.distributionPlans);
            }
        } finally {
            setPreparing(false);
        }
    };

    if (!workspace?.story) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <Globe size={28} style={{ color: DS.muted }} className="mx-auto mb-3" />
                    <p className="text-[13px] font-semibold" style={{ color: DS.txt }}>Sin historia producida</p>
                    <p className="text-[11px] mt-1" style={{ color: DS.sub }}>Producí una historia primero para ver sus canales de distribución.</p>
                    <button onClick={() => setActiveView('production')}
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold"
                        style={{ background: DS.accentDim, color: DS.accent }}>
                        Ir a Producción <ArrowRight size={12} />
                    </button>
                </div>
            </div>
        );
    }

    const rows: (DistributionPlanDTO | { platform: string; status: 'NOT_CONNECTED' })[] = plans
        ? ALL_PLATFORMS.map(p => plans.find(pl => pl.platform === p) ?? { platform: p, status: 'NOT_CONNECTED' as const })
        : ALL_PLATFORMS.map(p => ({ platform: p, status: 'NOT_CONNECTED' as const }));

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold" style={{ color: DS.txt }}>{workspace.story.headline}</h2>
                        <p className="text-[12px] mt-0.5" style={{ color: DS.sub }}>Content Outputs — dónde puede vivir esta historia.</p>
                    </div>
                    {composition?.status === 'APPROVED' && !plans && (
                        <button onClick={prepareAll} disabled={preparing}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold"
                            style={{ background: DS.accent, color: '#fff' }}>
                            {preparing ? <RefreshCw size={12} className="animate-spin" /> : null}
                            Preparar distribución
                        </button>
                    )}
                </div>

                {!composition && (
                    <p className="text-[11px] px-1" style={{ color: DS.sub }}>Todavía no hay una Composition — completá la producción y el Human Review primero.</p>
                )}
                {composition && composition.status !== 'APPROVED' && (
                    <p className="text-[11px] px-1" style={{ color: DS.sub }}>La Composition debe estar APPROVED (Human Review) antes de preparar distribución.</p>
                )}

                <div className="rounded-2xl overflow-hidden" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                    {rows.map(r => <OutputRow key={r.platform} plan={r} />)}
                </div>

                <p className="flex items-center gap-1.5 text-[10px]" style={{ color: DS.muted }}>
                    <Link2 size={10} />"No conectado" = sin credenciales/adapter configurado todavía — no publica nada.
                </p>
            </div>
        </div>
    );
}
