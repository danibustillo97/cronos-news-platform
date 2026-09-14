'use client';

// Studio's outer shell: Composition-first by default (rule #14), the
// pre-existing rich editor only mounts once the user explicitly asks to
// edit — advanced editing is a layer, not the product's center.

import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CompositionWorkspace } from './CompositionWorkspace';
import SocialMediaGenerator from '@/components/admin/SocialMedia/SocialMedia';
import { DS } from '@/components/admin/SocialMedia/TopBar';

export default function StudioView() {
    const [editing, setEditing] = useState(false);

    if (editing) {
        return (
            <div className="h-full flex flex-col overflow-hidden">
                <div className="flex-shrink-0 flex items-center gap-2 px-3 h-9" style={{ background: DS.bg, borderBottom: `1px solid ${DS.borderSub}` }}>
                    <button onClick={() => setEditing(false)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: DS.sub }}>
                        <ArrowLeft size={12} />Volver a la Composition
                    </button>
                </div>
                <div className="flex-1 min-h-0">
                    <SocialMediaGenerator />
                </div>
            </div>
        );
    }

    return <CompositionWorkspace onEdit={() => setEditing(true)} />;
}
