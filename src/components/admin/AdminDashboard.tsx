"use client";

import { useEffect, useState } from "react";
import { FileText, Globe, ArrowRight, Factory, CheckCircle2, AlertTriangle, Circle, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useProduction } from "@/studio/lab/ProductionContext";
import { apiUrl } from "@/studio/lab/api-client";
import { DS } from "@/components/admin/SocialMedia/TopBar";

interface NewsSummary {
  total: number;
  published: number;
  draft: number;
  recent: { id: string; title: string; status: string; published_at: string }[];
}

function useNewsSummary() {
  const [summary, setSummary] = useState<NewsSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('news')
      .select('id, title, status, published_at')
      .order('published_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setSummary({
          total: data.length,
          published: data.filter(n => n.status === 'published').length,
          draft: data.filter(n => n.status !== 'published').length,
          recent: data.slice(0, 5),
        });
      });
    return () => { cancelled = true; };
  }, []);

  return summary;
}

interface DiscoveryItem {
  newsId: string; title: string; category: string | null; score: number;
  reasons: { factor: string; explanation: string }[];
}

function useDiscoveryToday() {
  const [items, setItems] = useState<DiscoveryItem[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/discovery/today')).then(r => r.json()).then(body => {
      if (!cancelled && Array.isArray(body.items)) setItems(body.items.slice(0, 5));
    }).catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);
  return items;
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="p-4 rounded-xl" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
    <p className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: DS.sub }}>{label}</p>
    <p className="text-2xl font-bold mt-1" style={{ color: DS.txt }}>{value}</p>
  </div>
);

export default function AdminDashboard() {
  const { activeStory, workspace, setActiveView, lastError } = useProduction();
  const news = useNewsSummary();
  const discovery = useDiscoveryToday();

  const stages = workspace?.production?.stages ?? [];
  const done = stages.filter(s => s.done).length;
  const composition = workspace?.compositions[0] ?? null;
  const pendingReview = composition?.status === 'READY_FOR_REVIEW';

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: DS.txt }}>¿Qué está pasando hoy?</h2>
          <p className="text-[12px] mt-0.5" style={{ color: DS.sub }}>Estado real de producción y contenido — sin métricas simuladas.</p>
        </div>
        {lastError?.error === 'SCHEMA_NOT_PROVISIONED' && (
          <span className="flex-shrink-0 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg" style={{ color: '#f59e0b', background: '#f59e0b12', border: '1px solid #f59e0b30' }}>
            Backend no provisto — ver supabase_setup/cronos_platform_schema.sql
          </span>
        )}
      </div>

      {/* Discover Today */}
      <div className="rounded-2xl overflow-hidden" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${DS.borderSub}` }}>
          <Sparkles size={14} style={{ color: DS.accent }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: DS.sub }}>Discover Today</span>
        </div>
        {discovery === null ? (
          <div className="p-4 text-[11px]" style={{ color: DS.sub }}>Cargando…</div>
        ) : discovery.length === 0 ? (
          <div className="p-4 text-[11px]" style={{ color: DS.sub }}>Sin noticias recientes para puntuar.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: DS.borderSub }}>
            {discovery.map(item => (
              <div key={item.newsId} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: DS.surfaceMid, color: DS.accent }}>
                  {item.score.toFixed(1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium truncate" style={{ color: DS.txt }}>{item.title}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: DS.muted }}>{item.reasons.map(r => r.explanation).join(' · ')}</p>
                </div>
                {item.category && (
                  <span className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: DS.surfaceMid, color: DS.sub }}>
                    {item.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* active story in production */}
      <div className="rounded-2xl overflow-hidden" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${DS.borderSub}` }}>
          <Factory size={14} style={{ color: DS.accent }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: DS.sub }}>Producción activa</span>
        </div>

        {workspace?.story ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold truncate" style={{ color: DS.txt }}>{workspace.story.headline}</p>
                <p className="text-[11px] mt-0.5" style={{ color: DS.sub }}>{done} de {stages.length} etapas — {workspace.story.status.toLowerCase()}</p>
              </div>
              <button
                onClick={() => setActiveView('production')}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                style={{ background: DS.accentDim, color: DS.accent }}
              >
                Continuar producción <ArrowRight size={12} />
              </button>
            </div>

            {stages.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {stages.map(s => (
                  <span key={s.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold"
                    style={{
                      background: s.done ? '#22c55e12' : DS.surfaceMid,
                      color: s.done ? '#22c55e' : DS.muted,
                      border: `1px solid ${s.done ? '#22c55e30' : DS.border}`,
                    }}
                  >
                    {s.done ? <CheckCircle2 size={9} /> : <Circle size={9} />}
                    {s.label}
                  </span>
                ))}
              </div>
            )}

            {pendingReview && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]" style={{ background: '#f59e0b12', color: '#f59e0b', border: '1px solid #f59e0b30' }}>
                <AlertTriangle size={12} />
                Composition lista — esperando Human Review antes de pasar a Studio.
              </div>
            )}
          </div>
        ) : activeStory ? (
          <div className="p-6 text-center">
            <p className="text-[12px]" style={{ color: DS.sub }}>{activeStory.title} — todavía no se produjo.</p>
            <button onClick={() => setActiveView('production')}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
              style={{ background: DS.accentDim, color: DS.accent }}
            >
              Producir ahora <ArrowRight size={12} />
            </button>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-[12px]" style={{ color: DS.sub }}>No hay ninguna historia en producción.</p>
            <button
              onClick={() => setActiveView('news')}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
              style={{ background: DS.accentDim, color: DS.accent }}
            >
              Ir a News <ArrowRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* real news snapshot */}
      <div className="rounded-2xl overflow-hidden" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${DS.borderSub}` }}>
          <FileText size={14} style={{ color: DS.accent }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: DS.sub }}>Redacción</span>
        </div>

        {!news ? (
          <div className="p-4 text-[11px]" style={{ color: DS.sub }}>Cargando…</div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Total" value={news.total} />
              <Stat label="Publicadas" value={news.published} />
              <Stat label="Borradores" value={news.draft} />
            </div>
            <div className="space-y-1">
              {news.recent.map(n => (
                <div key={n.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ background: DS.surfaceMid }}>
                  <span className="text-[11px] truncate" style={{ color: DS.txt }}>{n.title}</span>
                  <span className="flex-shrink-0 flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ color: n.status === 'published' ? '#22c55e' : '#f59e0b', background: n.status === 'published' ? '#22c55e12' : '#f59e0b12' }}>
                    <Globe size={9} />{n.status === 'published' ? 'Publicada' : 'Borrador'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
