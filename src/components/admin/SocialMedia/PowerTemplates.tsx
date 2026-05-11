'use client';

import React, { useState, useCallback } from 'react';
import { 
    Zap, TrendingUp, Trophy, Target, Users, Timer,
    Newspaper, Flame, BarChart3, MessageSquare, Play,
    ChevronRight, Star, Sparkles
} from 'lucide-react';
import { useStudioContext } from './context';

const DS = {
    bg: '#0a0a0b',
    surface: '#141416',
    surfaceHover: '#1a1a1c',
    border: '#27272a',
    borderLight: '#3f3f46',
    accent: '#dc2626',
    accentHover: '#b91c1c',
    txt: '#fafafa',
    txtMuted: '#a1a1aa',
    txtSub: '#71717a',
} as const;

export interface PowerTemplate {
    id: string;
    name: string;
    category: 'viral' | 'news' | 'sports' | 'engagement';
    icon: React.ReactNode;
    description: string;
    generate: (news?: any) => TimelineItem[];
    defaultDuration: number;
}

export interface TimelineItem {
    id: string;
    type: 'image' | 'video' | 'text' | 'hook' | 'transition' | 'stat' | 'quote';
    content: string;
    duration: number;
    style?: 'breaking' | 'vs' | 'stat' | 'quote' | 'normal';
}

// HOOKS VIRALES PREMIUM
const VIRAL_HOOKS = [
    "🔥 ESTO ACABA DE PASAR...",
    "⚡ NOTICIA DE ÚLTIMA HORA",
    "😱 NO VAS A CREER ESTO",
    "👀 EL SECRETO QUE NADIE CONTEÓ",
    "💥 BOMBA EN EL MUNDO DEL FÚTBOL",
    "🚨 URGENTE",
    "🎯 INFORMACIÓN EXCLUSIVA",
    "⚠️ ATENCIÓN",
];

// PLANTILLAS PODEROSAS
export const POWER_TEMPLATES: PowerTemplate[] = [
    {
        id: 'breaking-news',
        name: 'Breaking News Pro',
        category: 'news',
        icon: <Newspaper size={18} />,
        description: 'Noticia urgente con hook impactante',
        defaultDuration: 15,
        generate: (news) => [
            {
                id: `hook-${Date.now()}`,
                type: 'hook',
                content: VIRAL_HOOKS[Math.floor(Math.random() * VIRAL_HOOKS.length)],
                duration: 3,
                style: 'breaking',
            },
            {
                id: `title-${Date.now()}`,
                type: 'text',
                content: news?.title || 'TITULAR DE NOTICIA',
                duration: 5,
                style: 'breaking',
            },
            {
                id: `image-${Date.now()}`,
                type: 'image',
                content: news?.image_url || '',
                duration: 4,
                style: 'normal',
            },
            {
                id: `summary-${Date.now()}`,
                type: 'text',
                content: news?.content?.substring(0, 100) || 'Resumen de la noticia...',
                duration: 3,
                style: 'normal',
            },
        ],
    },
    {
        id: 'vs-battle',
        name: 'VS Battle',
        category: 'sports',
        icon: <Target size={18} />,
        description: 'Comparación épica equipo vs equipo',
        defaultDuration: 20,
        generate: (news) => {
            const teams = news?.title?.match(/(\w+)\s+vs\s+(\w+)/i) || ['', 'Equipo A', 'Equipo B'];
            return [
                {
                    id: `hook-${Date.now()}`,
                    type: 'hook',
                    content: `⚔️ ${teams[1]} VS ${teams[2]}`,
                    duration: 3,
                    style: 'vs',
                },
                {
                    id: `team1-${Date.now()}`,
                    type: 'text',
                    content: teams[1].toUpperCase(),
                    duration: 2,
                    style: 'vs',
                },
                {
                    id: `vs-${Date.now()}`,
                    type: 'text',
                    content: 'VS',
                    duration: 1,
                    style: 'vs',
                },
                {
                    id: `team2-${Date.now()}`,
                    type: 'text',
                    content: teams[2].toUpperCase(),
                    duration: 2,
                    style: 'vs',
                },
                {
                    id: `context-${Date.now()}`,
                    type: 'text',
                    content: news?.content?.substring(0, 80) || 'El duelo del año',
                    duration: 4,
                    style: 'normal',
                },
                {
                    id: `cta-${Date.now()}`,
                    type: 'text',
                    content: '¿Quién ganará? Comenta 👇',
                    duration: 3,
                    style: 'normal',
                },
            ];
        },
    },
    {
        id: 'stats-card',
        name: 'Stats Card',
        category: 'sports',
        icon: <BarChart3 size={18} />,
        description: 'Estadísticas del jugador/equipo',
        defaultDuration: 12,
        generate: (news) => [
            {
                id: `hook-${Date.now()}`,
                type: 'hook',
                content: '📊 NÚMEROS QUE IMPACTAN',
                duration: 2,
                style: 'stat',
            },
            {
                id: `player-${Date.now()}`,
                type: 'text',
                content: news?.title?.split(':')[0] || 'JUGADOR DESTACADO',
                duration: 3,
                style: 'stat',
            },
            {
                id: `stat1-${Date.now()}`,
                type: 'stat',
                content: '15 Goles',
                duration: 2,
                style: 'stat',
            },
            {
                id: `stat2-${Date.now()}`,
                type: 'stat',
                content: '8 Asistencias',
                duration: 2,
                style: 'stat',
            },
            {
                id: `stat3-${Date.now()}`,
                type: 'stat',
                content: '92% Efectividad',
                duration: 2,
                style: 'stat',
            },
        ],
    },
    {
        id: 'hot-take',
        name: 'Hot Take 🔥',
        category: 'engagement',
        icon: <Flame size={18} />,
        description: 'Opinión controversial para generar debate',
        defaultDuration: 18,
        generate: (news) => [
            {
                id: `hook-${Date.now()}`,
                type: 'hook',
                content: '🔥 MI OPINIÓN IMPOPULAR',
                duration: 3,
                style: 'normal',
            },
            {
                id: `take-${Date.now()}`,
                type: 'text',
                content: news?.title || 'Esta es mi opinión controversial...',
                duration: 8,
                style: 'normal',
            },
            {
                id: `debate-${Date.now()}`,
                type: 'text',
                content: '¿Estás de acuerdo? 🔥 Comenta',
                duration: 4,
                style: 'normal',
            },
        ],
    },
    {
        id: 'quote-viral',
        name: 'Quote Viral',
        category: 'engagement',
        icon: <MessageSquare size={18} />,
        description: 'Frase memorable con diseño épico',
        defaultDuration: 10,
        generate: (news) => [
            {
                id: `quote-${Date.now()}`,
                type: 'quote',
                content: news?.title?.includes(':') 
                    ? news.title.split(':')[1].trim() 
                    : '"Las victorias se conquistan en la preparación"',
                duration: 7,
                style: 'quote',
            },
            {
                id: `author-${Date.now()}`,
                type: 'text',
                content: news?.title?.split(':')[0] || 'LEYENDA DEL FÚTBOL',
                duration: 3,
                style: 'quote',
            },
        ],
    },
    {
        id: 'countdown',
        name: 'Countdown',
        category: 'viral',
        icon: <Timer size={18} />,
        description: 'Cuenta regresiva para evento importante',
        defaultDuration: 15,
        generate: (news) => [
            {
                id: `hook-${Date.now()}`,
                type: 'hook',
                content: '⏰ FALTAN POCAS HORAS',
                duration: 2,
                style: 'normal',
            },
            {
                id: `event-${Date.now()}`,
                type: 'text',
                content: news?.title || 'EVENTO ESPECIAL',
                duration: 4,
                style: 'normal',
            },
            {
                id: `3-${Date.now()}`,
                type: 'text',
                content: '3',
                duration: 1,
                style: 'normal',
            },
            {
                id: `2-${Date.now()}`,
                type: 'text',
                content: '2',
                duration: 1,
                style: 'normal',
            },
            {
                id: `1-${Date.now()}`,
                type: 'text',
                content: '1',
                duration: 1,
                style: 'normal',
            },
            {
                id: `go-${Date.now()}`,
                type: 'hook',
                content: '🔥 YA EMPIEZA',
                duration: 2,
                style: 'breaking',
            },
        ],
    },
    {
        id: 'transfer-bomb',
        name: 'Transfer Bomb 💣',
        category: 'sports',
        icon: <Zap size={18} />,
        description: 'Noticia de fichaje bomba',
        defaultDuration: 16,
        generate: (news) => {
            const player = news?.title?.match(/([A-Z][a-z]+\s[A-Z][a-z]+)/)?.[0] || 'JUGADOR ESTRELLA';
            return [
                {
                    id: `hook-${Date.now()}`,
                    type: 'hook',
                    content: '💣 FICHAJE BOMBA CONFIRMADO',
                    duration: 3,
                    style: 'breaking',
                },
                {
                    id: `player-${Date.now()}`,
                    type: 'text',
                    content: player,
                    duration: 4,
                    style: 'breaking',
                },
                {
                    id: `new-team-${Date.now()}`,
                    type: 'text',
                    content: 'NUEVO EQUIPO 🏟️',
                    duration: 3,
                    style: 'normal',
                },
                {
                    id: `details-${Date.now()}`,
                    type: 'text',
                    content: news?.content?.substring(0, 60) || 'Detalles del traspaso...',
                    duration: 4,
                    style: 'normal',
                },
            ];
        },
    },
    {
        id: 'champion-moment',
        name: 'Champion Moment',
        category: 'sports',
        icon: <Trophy size={18} />,
        description: 'Celebración de campeonato o victoria épica',
        defaultDuration: 20,
        generate: (news) => [
            {
                id: `hook-${Date.now()}`,
                type: 'hook',
                content: '🏆 CAMPEONES',
                duration: 3,
                style: 'breaking',
            },
            {
                id: `winner-${Date.now()}`,
                type: 'text',
                content: news?.title?.split('campeón')?.[0]?.trim() || 'EQUIPO GANADOR',
                duration: 5,
                style: 'breaking',
            },
            {
                id: `celebration-${Date.now()}`,
                type: 'image',
                content: news?.image_url || '',
                duration: 6,
                style: 'normal',
            },
            {
                id: `cta-${Date.now()}`,
                type: 'text',
                content: 'Felícitalos en los comentarios 👇',
                duration: 3,
                style: 'normal',
            },
        ],
    },
];

export function PowerTemplatesPanel({ onApply }: { onApply: (items: TimelineItem[]) => void }) {
    const { news, selectedNews, handleNewsSelect } = useStudioContext();
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [showNewsPicker, setShowNewsPicker] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<PowerTemplate | null>(null);

    const categories = [
        { id: 'all', name: 'Todas', icon: <Sparkles size={14} /> },
        { id: 'viral', name: 'Viral', icon: <Flame size={14} /> },
        { id: 'news', name: 'Noticias', icon: <Newspaper size={14} /> },
        { id: 'sports', name: 'Deportes', icon: <Trophy size={14} /> },
        { id: 'engagement', name: 'Engage', icon: <MessageSquare size={14} /> },
    ];

    const filteredTemplates = selectedCategory === 'all' 
        ? POWER_TEMPLATES 
        : POWER_TEMPLATES.filter(t => t.category === selectedCategory);

    const applyTemplate = (template: PowerTemplate, newsItem?: any) => {
        const items = template.generate(newsItem);
        onApply(items);
        setSelectedTemplate(null);
        setShowNewsPicker(false);
    };

    const handleTemplateClick = (template: PowerTemplate) => {
        if (selectedNews) {
            // Si ya hay noticia seleccionada, aplicar directo
            applyTemplate(template, selectedNews);
        } else if (news.length > 0) {
            // Si hay noticias disponibles, mostrar picker
            setSelectedTemplate(template);
            setShowNewsPicker(true);
        } else {
            // Si no hay noticias, aplicar con valores por defecto
            applyTemplate(template);
        }
    };

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: DS.txt }}>
                    <Zap size={16} style={{ color: DS.accent }} />
                    Plantillas Power
                </h3>
                {selectedNews && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: DS.accent + '20', color: DS.accent }}>
                        Con noticia
                    </span>
                )}
            </div>

            {/* News Picker Modal */}
            {showNewsPicker && selectedTemplate && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.8)' }}
                >
                    <div 
                        className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl p-4"
                        style={{ background: DS.surface, border: `1px solid ${DS.border}` }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold" style={{ color: DS.txt }}>
                                Seleccionar noticia para "{selectedTemplate.name}"
                            </h4>
                            <button 
                                onClick={() => setShowNewsPicker(false)}
                                style={{ color: DS.txtMuted }}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                            {news.map((item: any) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        handleNewsSelect(item);
                                        applyTemplate(selectedTemplate, item);
                                    }}
                                    className="w-full p-3 rounded-lg text-left transition-all hover:bg-white/5"
                                    style={{ background: DS.bg, border: `1px solid ${DS.border}` }}
                                >
                                    <p className="text-xs font-medium line-clamp-2" style={{ color: DS.txt }}>
                                        {item.title}
                                    </p>
                                    <p className="text-[10px] mt-1" style={{ color: DS.txtSub }}>
                                        {item.category} • {new Date(item.created_at).toLocaleDateString()}
                                    </p>
                                </button>
                            ))}
                        </div>
                        
                        <button
                            onClick={() => applyTemplate(selectedTemplate)}
                            className="w-full mt-4 py-2 rounded-lg text-xs font-medium"
                            style={{ background: DS.border, color: DS.txtMuted }}
                        >
                            Usar sin noticia (vacío)
                        </button>
                    </div>
                </div>
            )}

            {/* Categories */}
            <div className="flex gap-1 overflow-x-auto pb-1">
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all flex-shrink-0"
                        style={{
                            background: selectedCategory === cat.id ? DS.border : 'transparent',
                            color: selectedCategory === cat.id ? DS.txt : DS.txtMuted,
                        }}
                    >
                        {cat.icon}
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Templates Grid */}
            <div className="space-y-2">
                {filteredTemplates.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => handleTemplateClick(template)}
                        className="w-full p-3 rounded-lg text-left transition-all border hover:border-gray-500 group"
                        style={{ background: DS.bg, borderColor: DS.border }}
                    >
                        <div className="flex items-start gap-3">
                            <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ 
                                    background: template.category === 'viral' ? '#dc262620' : 
                                               template.category === 'news' ? '#2563eb20' :
                                               template.category === 'sports' ? '#16a34a20' : '#f59e0b20',
                                    color: template.category === 'viral' ? '#dc2626' : 
                                           template.category === 'news' ? '#2563eb' :
                                           template.category === 'sports' ? '#16a34a' : '#f59e0b',
                                }}
                            >
                                {template.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold" style={{ color: DS.txt }}>
                                        {template.name}
                                    </p>
                                    <span 
                                        className="text-[8px] px-1 py-0.5 rounded"
                                        style={{ 
                                            background: DS.surfaceHover,
                                            color: DS.txtSub,
                                        }}
                                    >
                                        {template.defaultDuration}s
                                    </span>
                                </div>
                                <p className="text-[10px] mt-0.5" style={{ color: DS.txtSub }}>
                                    {template.description}
                                </p>
                            </div>
                            <ChevronRight 
                                size={16} 
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                style={{ color: DS.txtMuted }} 
                            />
                        </div>
                    </button>
                ))}
            </div>

            {/* Selected News Info */}
            {selectedNews && (
                <div 
                    className="p-3 rounded-lg border-l-2"
                    style={{ 
                        background: DS.bg, 
                        borderLeftColor: DS.accent,
                        borderTop: `1px solid ${DS.border}`,
                        borderRight: `1px solid ${DS.border}`,
                        borderBottom: `1px solid ${DS.border}`,
                    }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <Newspaper size={12} style={{ color: DS.accent }} />
                        <span className="text-[10px] font-medium" style={{ color: DS.accent }}>
                            Noticia activa
                        </span>
                    </div>
                    <p className="text-xs line-clamp-2" style={{ color: DS.txt }}>
                        {selectedNews.title}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: DS.txtSub }}>
                        {selectedNews.category}
                    </p>
                </div>
            )}

            {/* Tips */}
            <div className="p-3 rounded-lg" style={{ background: DS.bg, border: `1px solid ${DS.border}` }}>
                <p className="text-[10px] font-medium mb-1" style={{ color: DS.txtMuted }}>
                    💡 Tip profesional:
                </p>
                <p className="text-[10px]" style={{ color: DS.txtSub }}>
                    Las plantillas se adaptan automáticamente a la noticia seleccionada. 
                    El hook varía para mantener el contenido fresco.
                </p>
            </div>
        </div>
    );
}
