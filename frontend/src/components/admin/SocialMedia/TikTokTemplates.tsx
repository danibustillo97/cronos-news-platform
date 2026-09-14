'use client';

import React, { useState } from 'react';
import {
    Sparkles, TrendingUp, Zap, MessageCircle,
    Play, Clock, Plus, LayoutTemplate,
} from 'lucide-react';
import { useStudioContext } from './context';
import { DS } from './TopBar';
import { generateHookText } from './viralHooks';
import type { LayoutMode } from '@/studio/shared/types';

const LAYOUT_LABEL: Record<Exclude<LayoutMode, 'auto'>, string> = {
    overlay: 'Overlay',
    split: 'Split',
    breaking: 'Urgente',
    minimal: 'Clean',
};

export interface Template {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    /** Duración objetivo aproximada — informativa, no se fuerza sobre el guion generado. */
    duration: number;
    layoutMode: Exclude<LayoutMode, 'auto'>;
    fontSize: number;
    hasHook: boolean;
    hasWatermark: boolean;
}

const TEMPLATES: Template[] = [
    {
        id: 'viral-news',
        name: 'Noticia Viral',
        description: 'Overlay con hook impactante sobre la imagen de la noticia',
        icon: <TrendingUp size={20} />,
        color: '#e5173f',
        duration: 15000,
        layoutMode: 'overlay',
        fontSize: 56,
        hasHook: true,
        hasWatermark: true,
    },
    {
        id: 'quick-fact',
        name: 'Dato Rápido',
        description: 'Diseño limpio y minimalista, texto grande',
        icon: <Zap size={20} />,
        color: '#00f2ea',
        duration: 20000,
        layoutMode: 'minimal',
        fontSize: 44,
        hasHook: true,
        hasWatermark: true,
    },
    {
        id: 'story-mode',
        name: 'Story Mode',
        description: 'Imagen y texto lado a lado, formato split',
        icon: <Play size={20} />,
        color: '#ff0050',
        duration: 45000,
        layoutMode: 'split',
        fontSize: 50,
        hasHook: true,
        hasWatermark: true,
    },
    {
        id: 'quote-viral',
        name: 'Quote Viral',
        description: 'Texto grande estilo cita, sin hook',
        icon: <MessageCircle size={20} />,
        color: '#f59e0b',
        duration: 10000,
        layoutMode: 'minimal',
        fontSize: 60,
        hasHook: false,
        hasWatermark: true,
    },
    {
        id: 'blank',
        name: 'En Blanco',
        description: 'Overlay simple, listo para editar desde cero',
        icon: <Plus size={20} />,
        color: '#50505c',
        duration: 30000,
        layoutMode: 'overlay',
        fontSize: 48,
        hasHook: false,
        hasWatermark: true,
    },
];

export function TikTokTemplates() {
    const {
        selectedNews, setFormat, setAspectRatio,
        setLayoutMode, setFontSize, setShowWatermark, setCustomTitle,
    } = useStudioContext();
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

    const handleSelectTemplate = (template: Template) => {
        setSelectedTemplate(template.id);

        setFormat('video');
        setAspectRatio('9:16');
        setLayoutMode(template.layoutMode);
        setFontSize(template.fontSize);
        setShowWatermark(template.hasWatermark);

        // Aplica la plantilla sobre la noticia real ya seleccionada — nunca
        // fabrica una noticia falsa con imagen vacía.
        const base = selectedNews?.title || template.name;
        setCustomTitle(template.hasHook ? `${generateHookText(selectedNews)}\n\n${base}` : base);
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-bold" style={{ color: DS.txt }}>
                    Plantillas Virales
                </h3>
                <span className="text-[10px]" style={{ color: DS.sub }}>
                    Optimizado para TikTok
                </span>
            </div>

            {!selectedNews && (
                <p className="text-[10px]" style={{ color: DS.sub }}>
                    Elegí una noticia en la pestaña Noticias para que la plantilla tenga imagen real.
                </p>
            )}

            <div className="grid grid-cols-1 gap-2">
                {TEMPLATES.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className="p-3 rounded-xl text-left transition-all border-2"
                        style={{
                            background: selectedTemplate === template.id ? `${template.color}15` : DS.surface,
                            borderColor: selectedTemplate === template.id ? template.color : DS.border,
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: `${template.color}20`, color: template.color }}
                            >
                                {template.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-[12px] font-semibold" style={{ color: DS.txt }}>
                                        {template.name}
                                    </p>
                                    {selectedTemplate === template.id && (
                                        <Sparkles size={13} style={{ color: template.color }} />
                                    )}
                                </div>
                                <p className="text-[10px] mt-0.5" style={{ color: DS.sub }}>
                                    {template.description}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[10px] flex items-center gap-1" style={{ color: DS.sub }}>
                                        <Clock size={10} />
                                        ≈{Math.round(template.duration / 1000)}s
                                    </span>
                                    <span className="text-[10px] flex items-center gap-1" style={{ color: DS.sub }}>
                                        <LayoutTemplate size={10} />
                                        {LAYOUT_LABEL[template.layoutMode]}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {template.hasHook && (
                            <div className="flex items-center gap-1.5 mt-3 pt-2 border-t" style={{ borderColor: DS.border }}>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: DS.accentDim, color: DS.accent }}>
                                    HOOK
                                </span>
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {selectedTemplate && (
                <div
                    className="p-3 rounded-xl text-center"
                    style={{ background: DS.accentDim, border: `1px solid ${DS.accent}30` }}
                >
                    <p className="text-[10px]" style={{ color: DS.accent }}>
                        Plantilla aplicada — layout, tamaño de fuente y marca de agua actualizados en el canvas.
                    </p>
                </div>
            )}
        </div>
    );
}
