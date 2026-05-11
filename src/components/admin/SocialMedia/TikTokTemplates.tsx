'use client';

import React, { useState } from 'react';
import { 
    Sparkles, TrendingUp, Zap, MessageCircle, 
    Play, Clock, Hash, Music, Type, Plus
} from 'lucide-react';
import { useStudioContext } from './context';

const DS = {
    bg: '#09090b',
    surface: '#111114',
    surfaceMid: '#16161a',
    border: '#1e1e24',
    accent: '#e5173f',
    accentDim: 'rgba(229,23,63,0.12)',
    txt: '#e8e8f0',
    sub: '#50505c',
    muted: '#28282e',
} as const;

export interface Template {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    duration: number;
    style: {
        bgColor: string;
        textColor: string;
        accentColor: string;
        fontStyle: 'bold' | 'minimal' | 'fun';
    };
    elements: {
        hasHook: boolean;
        hasCaptions: boolean;
        hasProgressBar: boolean;
        hasWatermark: boolean;
        hasCTA: boolean;
    };
}

const TEMPLATES: Template[] = [
    {
        id: 'viral-news',
        name: 'Noticia Viral',
        description: 'Formato 9:16 con hook impactante y caption automático',
        icon: <TrendingUp size={20} />,
        color: '#e5173f',
        duration: 15000,
        style: {
            bgColor: '#000000',
            textColor: '#ffffff',
            accentColor: '#e5173f',
            fontStyle: 'bold',
        },
        elements: {
            hasHook: true,
            hasCaptions: true,
            hasProgressBar: true,
            hasWatermark: true,
            hasCTA: true,
        },
    },
    {
        id: 'quick-fact',
        name: 'Dato Rápido',
        description: '15-30 segundos, texto grande, música trending',
        icon: <Zap size={20} />,
        color: '#00f2ea',
        duration: 20000,
        style: {
            bgColor: '#0a0a0c',
            textColor: '#ffffff',
            accentColor: '#00f2ea',
            fontStyle: 'minimal',
        },
        elements: {
            hasHook: true,
            hasCaptions: true,
            hasProgressBar: true,
            hasWatermark: true,
            hasCTA: false,
        },
    },
    {
        id: 'story-mode',
        name: 'Story Mode',
        description: 'Formato vertical con múltiples escenas',
        icon: <Play size={20} />,
        color: '#ff0050',
        duration: 45000,
        style: {
            bgColor: '#000000',
            textColor: '#ffffff',
            accentColor: '#ff0050',
            fontStyle: 'fun',
        },
        elements: {
            hasHook: true,
            hasCaptions: true,
            hasProgressBar: true,
            hasWatermark: true,
            hasCTA: true,
        },
    },
    {
        id: 'quote-viral',
        name: 'Quote Viral',
        description: 'Texto inspirador/motivacional con fondo dinámico',
        icon: <MessageCircle size={20} />,
        color: '#f59e0b',
        duration: 10000,
        style: {
            bgColor: '#1a1a2e',
            textColor: '#ffffff',
            accentColor: '#f59e0b',
            fontStyle: 'bold',
        },
        elements: {
            hasHook: false,
            hasCaptions: false,
            hasProgressBar: false,
            hasWatermark: true,
            hasCTA: true,
        },
    },
    {
        id: 'blank',
        name: 'En Blanco',
        description: 'Lienzo vacío 9:16 para crear desde cero',
        icon: <Plus size={20} />,
        color: '#50505c',
        duration: 30000,
        style: {
            bgColor: '#000000',
            textColor: '#ffffff',
            accentColor: '#e5173f',
            fontStyle: 'minimal',
        },
        elements: {
            hasHook: false,
            hasCaptions: false,
            hasProgressBar: false,
            hasWatermark: true,
            hasCTA: false,
        },
    },
];

export function TikTokTemplates() {
    const { selectedNews, setSelectedNews, format, setFormat, aspectRatio, setAspectRatio } = useStudioContext();
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

    const handleSelectTemplate = (template: Template) => {
        setSelectedTemplate(template.id);
        
        // Set format to TikTok 9:16
        setFormat('video');
        setAspectRatio('9:16');
        
        // Create a "virtual" news item for the template
        const virtualNews = {
            id: `template-${template.id}`,
            title: template.name,
            summary: template.description,
            content: '',
            image_url: '',
            source: 'TikTok Studio',
            published_at: new Date().toISOString(),
            template: template,
        };
        
        setSelectedNews(virtualNews as any);
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold" style={{ color: DS.txt }}>
                    Plantillas Virales
                </h3>
                <span className="text-xs" style={{ color: DS.sub }}>
                    Optimizado para TikTok
                </span>
            </div>

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
                                    <p className="text-sm font-semibold" style={{ color: DS.txt }}>
                                        {template.name}
                                    </p>
                                    {selectedTemplate === template.id && (
                                        <Sparkles size={14} style={{ color: template.color }} />
                                    )}
                                </div>
                                <p className="text-xs mt-0.5" style={{ color: DS.sub }}>
                                    {template.description}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[10px] flex items-center gap-1" style={{ color: DS.sub }}>
                                        <Clock size={10} />
                                        {Math.round(template.duration / 1000)}s
                                    </span>
                                    <span className="text-[10px] flex items-center gap-1" style={{ color: DS.sub }}>
                                        <Type size={10} />
                                        {template.style.fontStyle}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Preview of features */}
                        <div className="flex items-center gap-1.5 mt-3 pt-2 border-t" style={{ borderColor: DS.border }}>
                            {template.elements.hasHook && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: DS.accentDim, color: DS.accent }}>
                                    HOOK
                                </span>
                            )}
                            {template.elements.hasCaptions && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: DS.surfaceMid, color: DS.sub }}>
                                    CAPTIONS
                                </span>
                            )}
                            {template.elements.hasProgressBar && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: DS.surfaceMid, color: DS.sub }}>
                                    PROGRESS
                                </span>
                            )}
                            {template.elements.hasCTA && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: DS.surfaceMid, color: DS.sub }}>
                                    CTA
                                </span>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {selectedTemplate && (
                <div 
                    className="p-3 rounded-xl text-center"
                    style={{ background: DS.accentDim, border: `1px solid ${DS.accent}30` }}
                >
                    <p className="text-xs" style={{ color: DS.accent }}>
                        Plantilla seleccionada. Configura tu contenido en el canvas.
                    </p>
                </div>
            )}
        </div>
    );
}
