'use client';

import React, { useCallback, useState } from 'react';
import {
    ImagePlus, Type, Video,
    Sparkles, Trash2,
} from 'lucide-react';
import { useStudioContext } from './context';
import { DS } from './TopBar';
import { generateHookText } from './viralHooks';

// Viral content blocks — 3 tones total (marca + 2 variantes), no arcoíris.
// Sticker/Sonido salieron de acá: no hacían nada al clickear, y Sonido real
// ya está en Herramientas → Audio.
const CONTENT_BLOCKS = [
    { id: 'image', name: 'Imagen', icon: <ImagePlus size={15} />, color: '#22c55e', shortcut: 'IMG' },
    { id: 'video', name: 'Video', icon: <Video size={15} />, color: '#e5173f', shortcut: 'VID' },
    { id: 'text', name: 'Texto', icon: <Type size={15} />, color: '#64748b', shortcut: 'TXT' },
    { id: 'hook', name: 'Hook 3s', icon: <Sparkles size={15} />, color: '#e5173f', shortcut: 'HK' },
];

/**
 * Barra horizontal de inserción rápida — mismas 6 acciones que antes vivían
 * en el rail vertical "Elementos", solo que ahora no le compiten ancho al
 * canvas. Debajo, una tira de miniaturas del contenido actual (antes
 * "Contenido Actual") aparece solo cuando hay algo que mostrar.
 */
export function InsertBar() {
    const { customTitle, setCustomTitle, projectImages, setProjectImages, selectedNews } = useStudioContext();
    const [uploading, setUploading] = useState(false);

    const handleUpload = useCallback(async (type: 'image' | 'video') => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = type === 'image' ? 'image/*' : 'video/*';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            setUploading(true);
            const url = URL.createObjectURL(file);
            if (type === 'image') {
                setProjectImages([...(projectImages || []), url]);
            }
            setUploading(false);
        };
        input.click();
    }, [projectImages, setProjectImages]);

    const addTextBlock = useCallback(() => {
        const newTitle = customTitle ? `${customTitle}\n\n✨ NUEVO TEXTO` : '✨ Texto Viral';
        setCustomTitle(newTitle);
    }, [customTitle, setCustomTitle]);

    const addHook = useCallback(() => {
        setCustomTitle(`${generateHookText(selectedNews)}\n\n${customTitle || ''}`);
    }, [customTitle, selectedNews, setCustomTitle]);

    const onBlockClick = (id: string) => {
        if (id === 'image' || id === 'video') handleUpload(id as 'image' | 'video');
        else if (id === 'text') addTextBlock();
        else if (id === 'hook') addHook();
    };

    const hasCurrentContent = Boolean(projectImages?.length || customTitle);

    return (
        <div className="flex-shrink-0 border-b" style={{ background: DS.bg, borderColor: DS.borderSub }}>
            <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
                {CONTENT_BLOCKS.map((block) => (
                    <button
                        key={block.id}
                        onClick={() => onBlockClick(block.id)}
                        disabled={uploading && (block.id === 'image' || block.id === 'video')}
                        title={block.name}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex-shrink-0 disabled:opacity-50"
                        style={{ background: `${block.color}12`, border: `1px solid ${block.color}30`, color: block.color }}
                    >
                        {uploading && (block.id === 'image' || block.id === 'video') ? (
                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : block.icon}
                        {block.name}
                    </button>
                ))}
            </div>

            {hasCurrentContent && (
                <div className="flex items-center gap-2 px-3 pb-2">
                    <div className="flex gap-1 overflow-x-auto">
                        {projectImages?.map((img, i) => (
                            <div key={i} className="w-9 h-9 rounded-md flex-shrink-0 overflow-hidden relative group">
                                <img src={img} alt="" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => setProjectImages(projectImages.filter((_, idx) => idx !== i))}
                                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={11} style={{ color: '#ef4444' }} />
                                </button>
                            </div>
                        ))}
                    </div>
                    {customTitle && (
                        <p className="text-[10px] truncate flex-1" style={{ color: DS.sub }}>
                            {customTitle}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
