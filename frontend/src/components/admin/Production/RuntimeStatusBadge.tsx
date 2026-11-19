'use client';

// "● LOCAL CONNECTED" / "○ LOCAL DISCONNECTED" -- nunca inventa progreso
// (sección 22 del pedido): refleja exactamente lo que useProduction()
// obtiene de GET /api/runtime/status, sin estado propio.

import { useProduction } from '@/studio/lab/ProductionContext';
import { DS } from '@/components/admin/SocialMedia/TopBar';

export function RuntimeStatusBadge() {
    const { runtimeConnected } = useProduction();

    if (runtimeConnected === null) {
        return (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: DS.muted }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: DS.muted }} />
                Consultando runtime…
            </span>
        );
    }

    return (
        <span
            className="flex items-center gap-1.5 text-[10px] font-semibold"
            style={{ color: runtimeConnected ? '#22c55e' : '#ef4444' }}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: runtimeConnected ? '#22c55e' : '#ef4444' }} />
            {runtimeConnected ? 'LOCAL CONNECTED' : 'LOCAL DISCONNECTED'}
        </span>
    );
}
