'use client';

import React, { useState, useCallback } from 'react';
import { Upload, CheckCircle, X, Smartphone, RefreshCw, Clock, Video, Link2 } from 'lucide-react';
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

export function TikTokPublisher() {
    const { tiktokAccount, connectTikTok, disconnectTikTok, refreshTikTokAccount, lastRecordedBlob, publishToTikTok, clearLastRecording } = useStudioContext();
    
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishResult, setPublishResult] = useState<{ success: boolean; message: string; url?: string } | null>(null);
    const [title, setTitle] = useState('');

    const handlePublish = useCallback(async () => {
        if (!lastRecordedBlob || !tiktokAccount?.connected) return;
        
        setIsPublishing(true);
        setPublishResult(null);
        
        try {
            const result = await publishToTikTok(lastRecordedBlob, title || 'Video desde Nexus News');
            
            if (result.success) {
                setPublishResult({
                    success: true,
                    message: '¡Video publicado exitosamente!',
                    url: result.share_url || undefined
                });
                clearLastRecording();
            } else {
                setPublishResult({
                    success: false,
                    message: result.error || 'Error al publicar'
                });
            }
        } catch (error) {
            setPublishResult({
                success: false,
                message: 'Error inesperado al publicar'
            });
        } finally {
            setIsPublishing(false);
        }
    }, [lastRecordedBlob, tiktokAccount, title || '', publishToTikTok, clearLastRecording]);

    // Si no hay cuenta conectada
    if (!tiktokAccount?.connected) {
        return (
            <div className="p-4 rounded-2xl border border-dashed" style={{ background: DS.surface, borderColor: DS.border }}>
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: DS.surfaceMid }}>
                        <Smartphone size={18} style={{ color: DS.sub }} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: DS.txt }}>TikTok Developer</p>
                        <p className="text-xs" style={{ color: DS.sub }}>Conecta para publicar</p>
                    </div>
                </div>
                <button
                    onClick={connectTikTok}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{ background: DS.accent, color: '#fff' }}
                >
                    <Link2 size={16} />
                    Conectar TikTok
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 rounded-2xl space-y-4" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
            {/* Header - Cuenta conectada */}
            <div className="flex items-center gap-3">
                <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #ff0050 0%, #00f2ea 100%)' }}
                >
                    {tiktokAccount.avatar_url ? (
                        <img src={tiktokAccount.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                    ) : (
                        <Smartphone size={18} style={{ color: '#fff' }} />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: DS.txt }}>
                        @{tiktokAccount.display_name || 'usuario'}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: tiktokAccount.is_expired ? '#ef4444' : '#22c55e' }} />
                        <p className="text-xs" style={{ color: DS.sub }}>
                            {tiktokAccount.is_expired ? 'Sesión expirada' : 'Conectado'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={disconnectTikTok}
                    className="p-2 rounded-lg transition-all hover:bg-red-500/10"
                    style={{ color: DS.sub }}
                    title="Desconectar"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Video disponible para publicar */}
            {lastRecordedBlob && (
                <div className="p-3 rounded-xl space-y-3" style={{ background: DS.surfaceMid, border: `1px solid ${DS.border}` }}>
                    <div className="flex items-center gap-2">
                        <Video size={16} style={{ color: DS.accent }} />
                        <p className="text-sm font-medium" style={{ color: DS.txt }}>Video listo para publicar</p>
                    </div>
                    
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Título del video..."
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: DS.bg, border: `1px solid ${DS.border}`, color: DS.txt }}
                    />
                    
                    <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        style={{ background: DS.accent, color: '#fff' }}
                    >
                        {isPublishing ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                Publicando...
                            </>
                        ) : (
                            <>
                                <Upload size={16} />
                                Publicar en TikTok
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Sin video grabado */}
            {!lastRecordedBlob && (
                <div className="p-3 rounded-xl text-center" style={{ background: DS.surfaceMid, border: `1px solid ${DS.border}` }}>
                    <p className="text-xs" style={{ color: DS.sub }}>
                        Graba un video para publicarlo en TikTok
                    </p>
                </div>
            )}

            {/* Resultado de publicación */}
            {publishResult && (
                <div 
                    className="p-3 rounded-xl flex items-start gap-2"
                    style={{ 
                        background: publishResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${publishResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}
                >
                    {publishResult.success ? (
                        <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                    ) : (
                        <X size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                    )}
                    <div className="flex-1">
                        <p className="text-sm" style={{ color: publishResult.success ? '#22c55e' : '#ef4444' }}>
                            {publishResult.message}
                        </p>
                        {publishResult.url && (
                            <a 
                                href={publishResult.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs underline mt-1 inline-block"
                                style={{ color: DS.accent }}
                            >
                                Ver en TikTok
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
