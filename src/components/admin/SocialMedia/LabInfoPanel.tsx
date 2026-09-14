'use client';

// "Historia" — Studio's contextual view of the Composition CRONOS' backend
// produced for the active story. Sourced entirely from the shared
// ProductionContext (GET /api/stories/{id}/workspace) — no file loading, no
// artifact parsing in the browser. Selecting a hook/using the script here
// pushes into the SAME existing Studio state (customTitle, generatedHook,
// videoScript, projectImages, loadRenderedVideoFromUrl) the rest of the
// editor already uses — one state, many surfaces.

import React, { useCallback } from 'react';
import {
    FolderInput, Waves, Sparkles, Film, ArrowRight, CheckCircle2, Clapperboard,
} from 'lucide-react';
import { useStudioContext } from './context';
import { useProduction } from '@/studio/lab/ProductionContext';
import { DS } from './TopBar';
import type { ScriptSegment } from '@/studio/shared/types';

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="p-3 rounded-xl space-y-2" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
        <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-semibold" style={{ color: DS.txt }}>{title}</span>
        </div>
        {children}
    </div>
);

export function LabInfoPanel() {
    const { customTitle, setCustomTitle, generatedHook, setGeneratedHook, setVideoScript, loadRenderedVideoFromUrl } = useStudioContext();
    const { activeStory, workspace, primaryComposition, setActiveView } = useProduction();

    const content = primaryComposition?.content ?? null;

    const useScriptInTimeline = useCallback(() => {
        if (!content?.script?.length) return;
        const segments: ScriptSegment[] = content.script.map(s => ({
            text: s.text, duration: Math.max(3000, Math.min(8000, s.text.length * 70)), image: null,
        }));
        setVideoScript(segments);
    }, [content, setVideoScript]);

    const useFinalAsset = useCallback(() => {
        if (!content?.finalAssetUrl) return;
        loadRenderedVideoFromUrl(content.finalAssetUrl);
    }, [content, loadRenderedVideoFromUrl]);

    if (!workspace?.story) {
        return (
            <div className="p-3 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: DS.txt }}>
                    <FolderInput size={16} style={{ color: DS.accent }} />
                    Historia
                </h3>
                <p className="text-[10px]" style={{ color: DS.sub }}>
                    {activeStory ? 'Esta historia todavía no fue producida.' : 'Sin historia activa.'}
                </p>
                <button onClick={() => setActiveView('production')}
                    className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2"
                    style={{ background: DS.accentDim, color: DS.accent }}
                >
                    Ir a Producción <ArrowRight size={12} />
                </button>
            </div>
        );
    }

    const story = workspace.story;

    return (
        <div className="p-3 space-y-3 overflow-y-auto h-full">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: DS.txt }}>
                    <FolderInput size={16} style={{ color: DS.accent }} />
                    Historia
                </h3>
                <span className="text-[9px] font-mono" style={{ color: DS.muted }}>{story.status}</span>
            </div>

            <button
                onClick={() => setCustomTitle(story.headline)}
                className="w-full p-2 rounded-lg text-left text-[11px] transition-all hover:opacity-80"
                style={{ background: DS.surfaceMid, border: `1px solid ${DS.border}`, color: DS.txt }}
                title="Usar como titular del canvas"
            >
                {story.headline}
            </button>
            {story.summary && <p className="text-[10px] leading-relaxed px-1" style={{ color: DS.sub }}>{story.summary}</p>}

            {!content && (
                <p className="text-[10px] px-1" style={{ color: DS.sub }}>Producción sin Composition todavía.</p>
            )}

            {content && (
                <>
                    {content.angle && (
                        <p className="text-[9px] px-1" style={{ color: DS.muted }}>Ángulo: <strong style={{ color: DS.sub }}>{content.angle}</strong></p>
                    )}

                    {content.hook && (
                        <Section icon={<Sparkles size={14} style={{ color: DS.accent }} />} title="Hook">
                            <button onClick={() => setGeneratedHook(content.hook!)}
                                className="w-full p-2 rounded-lg text-left text-[11px] transition-all hover:opacity-80"
                                style={{
                                    background: generatedHook === content.hook ? `${DS.accent}12` : DS.surfaceMid,
                                    border: `1px solid ${generatedHook === content.hook ? `${DS.accent}40` : DS.border}`, color: DS.txt,
                                }}
                            >
                                {content.hook}
                                {generatedHook === content.hook && (
                                    <span className="flex items-center gap-1 mt-1 text-[9px]" style={{ color: '#22c55e' }}><CheckCircle2 size={9} />Activo</span>
                                )}
                            </button>
                        </Section>
                    )}

                    {content.script.length > 0 && (
                        <Section icon={<Film size={14} style={{ color: DS.accent }} />} title="Guion">
                            <button onClick={useScriptInTimeline}
                                className="w-full py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5"
                                style={{ background: DS.accentDim, color: DS.accent }}
                            >
                                Usar este guion en el Timeline <ArrowRight size={10} />
                            </button>
                            <div className="space-y-1">
                                {content.script.map((s, i) => (
                                    <p key={i} className="text-[10px]" style={{ color: DS.sub }}>
                                        <strong style={{ color: DS.muted }}>{s.section}</strong> — {s.text}
                                    </p>
                                ))}
                            </div>
                        </Section>
                    )}

                    {content.narrativeSummary && (
                        <Section icon={<Waves size={14} style={{ color: '#a78bfa' }} />} title="Narrativa">
                            <p className="text-[10px]" style={{ color: DS.sub }}>{content.narrativeSummary}</p>
                        </Section>
                    )}

                    {content.mediaSummary && (
                        <Section icon={<Clapperboard size={14} style={{ color: '#f59e0b' }} />} title="Producción">
                            <p className="text-[10px]" style={{ color: DS.sub }}>{content.mediaSummary}</p>
                        </Section>
                    )}

                    {content.finalAssetUrl && (
                        <Section icon={<Film size={14} style={{ color: DS.accent }} />} title="Final reel">
                            <button onClick={useFinalAsset}
                                className="w-full py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5"
                                style={{ background: DS.accentDim, color: DS.accent }}
                            >
                                Usar como video del Studio <ArrowRight size={10} />
                            </button>
                        </Section>
                    )}
                </>
            )}
        </div>
    );
}
