"use client";

// Command Center · operación en tiempo real: feed (24 h), piloto editorial,
// Revisión, SEO y monetización. Todo sale de datos reales y se refresca solo
// cada minuto; lo que no se puede leer se muestra como "sin datos".

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, CircleDollarSign, ExternalLink, FileSearch, Newspaper, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/studio/lab/api-client";
import { getAdProviderConfig } from "@/lib/adConfig";
import { NEWS_FEED_HOURS } from "@/lib/newsFreshness";
import {
  campaignTotals, feedHealth, monetizationChecks, opsAlerts,
  type AutomationState, type Campaign, type Check, type FeedRow, type Level,
} from "./ops";

const REFRESH_MS = 60_000;
const nf = new Intl.NumberFormat("es-CO");

interface OpsData {
  rows: FeedRow[] | null;
  automation: AutomationState | null;
  review: number | null;
  campaigns: Campaign[] | null;
  adsTxt: string | null;
  sitemap: number | null;
  newsSitemap: number | null;
  loadedAt: Date;
}

async function json<T>(path: string): Promise<T | null> {
  try {
    const res = await apiFetch(path);
    return res.ok ? ((await res.json()) as T) : null;
  } catch { return null; }
}

async function text(path: string): Promise<string | null> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

const countLoc = (xml: string | null) => (xml === null ? null : (xml.match(/<loc>/g) ?? []).length);

async function loadOps(): Promise<OpsData> {
  const since = new Date(Date.now() - 8 * 24 * 3_600_000).toISOString();
  const [news, automation, validated, required, ads, adsTxt, sitemap, newsSitemap] = await Promise.all([
    supabase.from("news").select("id,title,slug,excerpt,summary,image_url,published_at,category")
      .eq("status", "published").gte("published_at", since).order("published_at", { ascending: false }).limit(1000)
      .then(({ data, error }) => (error ? null : (data as FeedRow[])), () => null),
    json<AutomationState>("/api/settings/editorial-automation"),
    json<{ artifacts: unknown[] }>("/api/artifacts?status=VALIDATED&limit=200"),
    json<{ artifacts: unknown[] }>("/api/artifacts?status=REVIEW_REQUIRED&limit=200"),
    json<{ slots: { campaigns?: Campaign[] }[] }>("/api/admin/ads/slots"),
    text("/ads.txt"),
    text("/sitemap.xml"),
    text("/news-sitemap.xml"),
  ]);
  return {
    rows: news,
    automation,
    review: validated || required ? (validated?.artifacts.length ?? 0) + (required?.artifacts.length ?? 0) : null,
    campaigns: ads ? ads.slots.flatMap((s) => s.campaigns ?? []) : null,
    adsTxt,
    sitemap: countLoc(sitemap),
    newsSitemap: countLoc(newsSitemap),
    loadedAt: new Date(),
  };
}

const LEVEL_STYLE: Record<Level, string> = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  bad: "text-rose-300",
};

function LevelIcon({ level }: { level: Level }) {
  const Icon = level === "ok" ? CheckCircle2 : level === "warn" ? AlertTriangle : XCircle;
  return <Icon size={14} className={`mt-0.5 flex-shrink-0 ${LEVEL_STYLE[level]}`} />;
}

function Box({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-white/[0.065] bg-[#0b0b0d]">
      <div className="flex min-h-[48px] items-center justify-between gap-3 border-b border-white/[0.055] px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[10px] bg-white/[0.04] text-red-300">{icon}</span>
          <h3 className="truncate text-[12px] font-medium text-neutral-100">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: Level }) {
  return (
    <article className="rounded-[16px] border border-white/[0.055] bg-[#0b0b0d] px-3.5 py-3">
      <p className="text-[10px] font-medium text-neutral-500">{label}</p>
      <p className={`mt-2 text-[22px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${tone ? LEVEL_STYLE[tone] : "text-neutral-100"}`}>{value}</p>
      {hint && <p className="mt-1.5 truncate text-[9px] text-neutral-600" title={hint}>{hint}</p>}
    </article>
  );
}

function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="divide-y divide-white/[0.045]">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start gap-2.5 px-4 py-2.5">
          <LevelIcon level={c.level} />
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-neutral-200">{c.label}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ago(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return h < 48 ? `${h} h ${minutes % 60} min` : `${Math.floor(h / 24)} días`;
}

export default function OperationsPanel() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setData(await loadOps()); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const config = useMemo(() => getAdProviderConfig(), []);
  const feed = useMemo(() => (data?.rows ? feedHealth(data.rows) : null), [data]);
  const money = useMemo(() => monetizationChecks(config, data?.adsTxt ?? null, data?.campaigns ?? null), [config, data]);
  const totals = useMemo(() => campaignTotals(data?.campaigns ?? null), [data]);
  const alerts = useMemo(() => (data ? opsAlerts(feed, data.automation, data.review, money) : []), [data, feed, money]);
  const maxBar = Math.max(1, ...(feed?.last24h ?? [0]));
  const pilot = data?.automation;
  const pilotLabel = !pilot ? "sin datos" : !pilot.enabled ? "Manual" : pilot.autoPublish ? `Publica solo (≥${pilot.minOriginality ?? 85}% original)` : "Redacta · tú apruebas";

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-3 pb-3">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-white/[0.055] pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="text-[14px] font-medium tracking-tight text-neutral-100">Operación</h2>
          <span className="hidden h-4 border-l border-white/[0.1] sm:block" />
          <span className="flex items-center gap-1.5 text-[10px] text-neutral-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            En vivo · se actualiza cada minuto{data ? ` · ${data.loadedAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Actualizar operación"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.075] bg-black/20 text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Stat label={`En el feed (${NEWS_FEED_HOURS} h)`} value={feed ? nf.format(feed.inFeed) : "—"} tone={feed ? (feed.inFeed ? "ok" : "bad") : undefined}
          hint={feed ? `${nf.format(feed.archived7d)} archivadas esta semana · siguen en /archivo` : "sin datos"} />
        <Stat label="Última publicación" value={feed ? ago(feed.minutesSinceLast) : "—"} tone={feed?.minutesSinceLast != null ? (feed.minutesSinceLast > 180 ? "warn" : "ok") : undefined}
          hint={feed?.lastPublishedAt ? feed.lastPublishedAt.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : undefined} />
        <Stat label="En Revisión" value={data?.review != null ? nf.format(data.review) : "—"} hint="Borradores esperando aprobación" />
        <Stat label="Piloto editorial" value={pilot ? (pilot.enabled ? "ON" : "OFF") : "—"} tone={pilot ? (pilot.enabled ? "ok" : "warn") : undefined} hint={pilotLabel} />
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Box title={`Publicaciones de las últimas ${NEWS_FEED_HOURS} h`} icon={<Newspaper size={15} />}
          action={feed ? <span className="text-[10px] text-neutral-500">{feed.emptyHours} h sin publicar</span> : undefined}>
          <div className="px-4 pb-3 pt-4">
            {feed ? (
              <div className="flex h-[96px] items-end gap-[3px]">
                {feed.last24h.map((n, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`hace ${NEWS_FEED_HOURS - 1 - i} h: ${n} publicación(es)`}>
                    <div className={`w-full rounded-t-[4px] ${n ? "bg-gradient-to-t from-red-500/50 to-red-300/85" : "bg-white/[0.05]"}`}
                      style={{ height: `${n ? Math.max(8, (n / maxBar) * 92) : 3}px` }} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[11px] text-neutral-600">No se pudieron leer las noticias.</p>
            )}
            <div className="mt-2 flex justify-between text-[9px] text-neutral-600"><span>hace {NEWS_FEED_HOURS} h</span><span>ahora</span></div>
          </div>
        </Box>

        <Box title="Alertas" icon={<AlertTriangle size={15} />} action={<span className="text-[10px] text-neutral-500">{alerts.length}</span>}>
          {alerts.length ? <CheckList checks={alerts.slice(0, 6)} /> : (
            <p className="px-4 py-8 text-center text-[11px] text-neutral-500">{data ? "Todo en orden." : "Cargando…"}</p>
          )}
        </Box>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Box title="SEO" icon={<FileSearch size={15} />}
          action={<span className="text-[10px] text-neutral-500">sitemap {data?.sitemap ?? "—"} · news {data?.newsSitemap ?? "—"}</span>}>
          {feed && feed.issues.length ? (
            <ul className="max-h-[260px] divide-y divide-white/[0.045] overflow-y-auto">
              {feed.issues.slice(0, 30).map(({ row, problems }) => (
                <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] text-neutral-200" title={row.title}>{row.title}</p>
                    <p className="mt-0.5 text-[10px] text-amber-300/80">{problems.join(" · ")}</p>
                  </div>
                  {row.slug && (
                    <Link href={`/noticia/${encodeURIComponent(row.slug)}`} target="_blank" aria-label="Abrir noticia" className="mt-0.5 flex-shrink-0 text-neutral-500 hover:text-white">
                      <ExternalLink size={12} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-[11px] text-neutral-500">
              {feed ? (feed.inFeed ? "Todas las noticias del feed tienen imagen, título y resumen correctos." : "No hay noticias en el feed para revisar.") : "Sin datos."}
            </p>
          )}
          <p className="border-t border-white/[0.045] px-4 py-2.5 text-[9px] leading-relaxed text-neutral-600">
            Las noticias salen del feed a las {NEWS_FEED_HOURS} h, pero conservan su URL: siguen indexadas en el sitemap y en /archivo.
          </p>
        </Box>

        <Box title="Monetización" icon={<CircleDollarSign size={15} />}
          action={<span className="text-[10px] text-neutral-500">{nf.format(totals.impressions)} impr. · {nf.format(totals.clicks)} clics{totals.ctr !== null ? ` · CTR ${totals.ctr.toFixed(2)}%` : ""}</span>}>
          <CheckList checks={money} />
          <p className="border-t border-white/[0.045] px-4 py-2.5 text-[9px] leading-relaxed text-neutral-600">
            Impresiones y clics son de las campañas directas. Los ingresos de AdSense se ven en tu cuenta de AdSense: Google no los expone sin conectar su API.
          </p>
        </Box>
      </div>

      {pilot && (
        <p className="flex items-center gap-1.5 px-1 text-[10px] text-neutral-600">
          <Bot size={12} /> Piloto: {pilotLabel} · hasta {pilot.maxArticlesPerDay} artículos por día · corre cada 10 min en GitHub Actions.
        </p>
      )}
    </div>
  );
}
