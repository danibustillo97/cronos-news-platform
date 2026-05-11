'use client';

import React, { useState, useCallback } from 'react';
import { 
    Zap, Hash, Sparkles, TrendingUp, 
    Copy, Check, RefreshCw, Lightbulb,
    Volume2, Type, Clock
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

// Hook templates for viral videos
const HOOK_TEMPLATES = [
    { type: 'shock', text: "Esto es LOCURA...", emoji: "😱" },
    { type: 'secret', text: "El secreto que nadie te cuenta...", emoji: "🤫" },
    { type: 'mistake', text: "El ERROR más grande del {team}...", emoji: "❌" },
    { type: 'reveal', text: "La VERDAD sobre {player}...", emoji: "👀" },
    { type: 'urgent', text: "URGENTE: {event} cambia TODO", emoji: "⚡" },
    { type: 'number', text: "3 cosas que NO sabías de...", emoji: "3️⃣" },
    { type: 'question', text: "¿Por qué {player} hizo esto?", emoji: "❓" },
    { type: 'prediction', text: "Esto va a PASAR en {event}...", emoji: "🔮" },
];

// Trending hashtags for sports
const TRENDING_HASHTAGS = [
    '#futbol', '#champions', '#messi', '#ronaldo', '#viral',
    '#sports', '#fyp', '#foryou', '#trending', '#noticias',
    '#goal', '#highlight', '#football', '#soccer', '#deportes',
    '#nexusnews', '#tiktoksports', '#futboltiktok', '#news'
];

export function ViralTools() {
    const { customTitle, setCustomTitle } = useStudioContext();
    const [copied, setCopied] = useState(false);
    const [generatedHook, setGeneratedHook] = useState('');
    const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const generateHook = useCallback(() => {
        setIsGenerating(true);
        
        // Pick random template
        const template = HOOK_TEMPLATES[Math.floor(Math.random() * HOOK_TEMPLATES.length)];
        
        // Simple replacements
        let hook = template.text
            .replace('{team}', 'Barcelona')
            .replace('{player}', 'Messi')
            .replace('{event}', 'el Clásico');
        
        setTimeout(() => {
            setGeneratedHook(`${template.emoji} ${hook}`);
            setIsGenerating(false);
        }, 500);
    }, []);

    const copyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    const toggleHashtag = useCallback((tag: string) => {
        setSelectedHashtags(prev => 
            prev.includes(tag) 
                ? prev.filter(t => t !== tag)
                : [...prev, tag].slice(0, 5)
        );
    }, []);

    const optimizeText = useCallback(() => {
        if (!customTitle) return;
        
        // Simple optimizations
        let optimized = customTitle;
        
        // Add hook if missing
        if (!optimized.includes('😱') && !optimized.includes('⚡') && !optimized.includes('🔥')) {
            optimized = `🔥 ${optimized}`;
        }
        
        // Add hashtags
        const hashtags = selectedHashtags.length > 0 
            ? selectedHashtags.join(' ')
            : '#futbol #fyp #viral';
        
        optimized = `${optimized}\n\n${hashtags}`;
        
        setCustomTitle(optimized);
    }, [customTitle, selectedHashtags, setCustomTitle]);

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: DS.txt }}>
                    <Zap size={16} style={{ color: DS.accent }} />
                    Herramientas Virales
                </h3>
            </div>

            {/* Hook Generator */}
            <div className="p-3 rounded-xl space-y-3" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                <div className="flex items-center gap-2">
                    <Sparkles size={14} style={{ color: DS.accent }} />
                    <span className="text-xs font-semibold" style={{ color: DS.txt }}>Generador de Hooks</span>
                </div>
                
                <p className="text-[10px]" style={{ color: DS.sub }}>
                    Genera un hook impactante para los primeros 3 segundos
                </p>

                {generatedHook && (
                    <div 
                        className="p-2.5 rounded-lg text-sm cursor-pointer transition-all hover:opacity-80"
                        style={{ background: DS.accentDim }}
                        onClick={() => copyToClipboard(generatedHook)}
                    >
                        <div className="flex items-center justify-between">
                            <span style={{ color: DS.accent }}>{generatedHook}</span>
                            {copied ? (
                                <Check size={14} style={{ color: '#22c55e' }} />
                            ) : (
                                <Copy size={14} style={{ color: DS.sub }} />
                            )}
                        </div>
                    </div>
                )}

                <button
                    onClick={generateHook}
                    disabled={isGenerating}
                    className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{ background: DS.accentDim, color: DS.accent }}
                >
                    {isGenerating ? (
                        <RefreshCw size={14} className="animate-spin" />
                    ) : (
                        <Lightbulb size={14} />
                    )}
                    {isGenerating ? 'Generando...' : 'Generar Hook'}
                </button>
            </div>

            {/* Hashtag Selector */}
            <div className="p-3 rounded-xl space-y-3" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                <div className="flex items-center gap-2">
                    <Hash size={14} style={{ color: '#00f2ea' }} />
                    <span className="text-xs font-semibold" style={{ color: DS.txt }}>Hashtags Trending</span>
                </div>
                
                <p className="text-[10px]" style={{ color: DS.sub }}>
                    Selecciona hasta 5 hashtags para maximizar alcance
                </p>

                <div className="flex flex-wrap gap-1.5">
                    {TRENDING_HASHTAGS.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => toggleHashtag(tag)}
                            className="px-2 py-1 rounded-md text-[10px] font-medium transition-all"
                            style={{
                                background: selectedHashtags.includes(tag) ? '#00f2ea20' : DS.surfaceMid,
                                color: selectedHashtags.includes(tag) ? '#00f2ea' : DS.sub,
                                border: `1px solid ${selectedHashtags.includes(tag) ? '#00f2ea50' : DS.border}`,
                            }}
                        >
                            {tag}
                        </button>
                    ))}
                </div>

                {selectedHashtags.length > 0 && (
                    <div className="pt-2 border-t" style={{ borderColor: DS.border }}>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px]" style={{ color: DS.sub }}>
                                {selectedHashtags.length}/5 seleccionados
                            </span>
                            <button
                                onClick={() => copyToClipboard(selectedHashtags.join(' '))}
                                className="text-[10px] flex items-center gap-1"
                                style={{ color: DS.accent }}
                            >
                                {copied ? <Check size={12} /> : <Copy size={12} />}
                                Copiar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Text Optimizer */}
            <div className="p-3 rounded-xl space-y-3" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                <div className="flex items-center gap-2">
                    <TrendingUp size={14} style={{ color: '#f59e0b' }} />
                    <span className="text-xs font-semibold" style={{ color: DS.txt }}>Optimizador de Texto</span>
                </div>
                
                <p className="text-[10px]" style={{ color: DS.sub }}>
                    Optimiza tu título para máximo engagement
                </p>

                <button
                    onClick={optimizeText}
                    disabled={!customTitle}
                    className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                >
                    <Type size={14} />
                    Optimizar Título
                </button>
            </div>

            {/* Tips */}
            <div className="p-3 rounded-xl" style={{ background: DS.surfaceMid, border: `1px solid ${DS.border}` }}>
                <div className="flex items-start gap-2">
                    <Clock size={14} style={{ color: DS.sub, flexShrink: 0 }} />
                    <div>
                        <p className="text-[10px] font-semibold" style={{ color: DS.txt }}>
                            Tips para viralizar:
                        </p>
                        <ul className="text-[9px] mt-1 space-y-1" style={{ color: DS.sub }}>
                            <li>• Primeros 3 segundos = Hook fuerte</li>
                            <li>• Duración ideal: 15-45 segundos</li>
                            <li>• Texto grande y legible</li>
                            <li>• Música trending aumenta alcance</li>
                            <li>• Publicar entre 7-9pm para más views</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
