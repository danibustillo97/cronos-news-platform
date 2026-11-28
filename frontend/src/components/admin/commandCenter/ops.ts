// Command Center: pure, testable rules over REAL data (published news rows,
// the autopilot settings, the ad configuration and the direct campaigns).
// Nothing here invents a number: a check without data says "sin datos".

import { isCurrentNews, NEWS_FEED_HOURS } from "@/lib/newsFreshness";
import type { AdProviderConfig } from "@/lib/adConfig";

export interface FeedRow {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  summary: string | null;
  image_url: string | null;
  published_at: string | null;
  category: string | null;
}

export type Level = "ok" | "warn" | "bad";
export interface Check { id: string; label: string; level: Level; detail: string }

const HOUR = 3_600_000;
const plain = (v: string | null | undefined) => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** SEO problems of one published story (what Google and Discover penalise). */
export function seoProblems(row: FeedRow): string[] {
  const out: string[] = [];
  const title = plain(row.title);
  const desc = plain(row.excerpt) || plain(row.summary);
  if (!row.slug) out.push("sin URL");
  if (!row.image_url) out.push("sin imagen (no sale en Discover)");
  if (title.length > 70) out.push(`título largo (${title.length})`);
  else if (title.length < 25) out.push(`título corto (${title.length})`);
  if (!desc) out.push("sin resumen (meta descripción)");
  else if (desc.length < 70) out.push(`resumen corto (${desc.length})`);
  return out;
}

export interface FeedHealth {
  inFeed: number;
  last24h: number[];                    // publications per hour, oldest -> newest (24 bars)
  lastPublishedAt: Date | null;
  minutesSinceLast: number | null;
  archived7d: number;                   // left the feed in the last 7 days (kept in /archivo)
  emptyHours: number;                   // of the last 24 h, hours with no publication
  issues: { row: FeedRow; problems: string[] }[];
}

export function feedHealth(rows: FeedRow[], now: Date = new Date()): FeedHealth {
  const dated = rows
    .filter((r) => r.published_at && Number.isFinite(new Date(r.published_at).getTime()))
    .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());
  const current = dated.filter((r) => isCurrentNews(r, now));
  const last24h = Array.from({ length: NEWS_FEED_HOURS }, () => 0);
  for (const r of current) {
    const ago = Math.floor((now.getTime() - new Date(r.published_at!).getTime()) / HOUR);
    if (ago >= 0 && ago < NEWS_FEED_HOURS) last24h[NEWS_FEED_HOURS - 1 - ago]++;
  }
  const lastPublishedAt = dated[0] ? new Date(dated[0].published_at!) : null;
  return {
    inFeed: current.length,
    last24h,
    lastPublishedAt,
    minutesSinceLast: lastPublishedAt ? Math.max(0, Math.round((now.getTime() - lastPublishedAt.getTime()) / 60_000)) : null,
    archived7d: dated.length - current.length,
    emptyHours: last24h.filter((n) => n === 0).length,
    issues: current.map((row) => ({ row, problems: seoProblems(row) })).filter((x) => x.problems.length),
  };
}

export interface AutomationState { enabled: boolean; autoPublish?: boolean; minOriginality?: number; maxArticlesPerDay: number }

export interface Campaign { live?: boolean; impressions?: number; clicks?: number }

/** Monetisation checklist: what is earning, what is configured, what is missing. */
export function monetizationChecks(config: AdProviderConfig, adsTxt: string | null, campaigns: Campaign[] | null): Check[] {
  const pub = config.adsensePublisherId?.replace(/^ca-/, "") ?? "";
  const units = Object.values(config.adsenseSlots).filter(Boolean).length + (config.adsenseDefaultSlot ? 1 : 0);
  const live = campaigns?.filter((c) => c.live) ?? [];
  const checks: Check[] = [
    {
      id: "adsense", label: "Google AdSense",
      level: config.adsenseEnabled && pub ? (units ? "ok" : "warn") : "bad",
      detail: !pub ? "Falta el ID de editor (NEXT_PUBLIC_ADSENSE_PUBLISHER_ID)."
        : !config.adsenseEnabled ? "Configurado pero apagado (NEXT_PUBLIC_ADSENSE_ENABLED=true)."
          : units ? `Activo · ${units} unidad(es) de anuncio; llena los espacios sin campaña directa.`
            : "Activo pero sin unidades: crea una en AdSense y ponla en NEXT_PUBLIC_ADSENSE_SLOT_DEFAULT.",
    },
    {
      id: "adstxt", label: "ads.txt",
      level: adsTxt === null ? "warn" : pub && adsTxt.includes(pub) ? "ok" : adsTxt.trim() ? "warn" : "bad",
      detail: adsTxt === null ? "No se pudo leer /ads.txt."
        : !adsTxt.trim() ? "Vacío: Google no paga anuncios sin ads.txt (ADS_TXT_LINES)."
          : pub && !adsTxt.includes(pub) ? "No incluye tu ID de AdSense." : "Publicado y válido.",
    },
    {
      id: "ga4", label: "Google Analytics 4",
      level: config.ga4MeasurementId ? "ok" : "warn",
      detail: config.ga4MeasurementId ? `Midiendo (${config.ga4MeasurementId}).` : "Sin ID (NEXT_PUBLIC_GA4_MEASUREMENT_ID). La analítica propia sí funciona.",
    },
    {
      id: "direct", label: "Campañas directas",
      level: campaigns === null ? "warn" : live.length ? "ok" : "warn",
      detail: campaigns === null ? "No se pudieron leer las campañas."
        : live.length ? `${live.length} en curso.` : "Ninguna en curso: vende espacios en Publicidad.",
    },
  ];
  return checks;
}

export function campaignTotals(campaigns: Campaign[] | null): { impressions: number; clicks: number; ctr: number | null } {
  const impressions = (campaigns ?? []).reduce((n, c) => n + (c.impressions ?? 0), 0);
  const clicks = (campaigns ?? []).reduce((n, c) => n + (c.clicks ?? 0), 0);
  return { impressions, clicks, ctr: impressions ? (clicks / impressions) * 100 : null };
}

/** Alerts ranked by what costs readers or money right now. */
export function opsAlerts(feed: FeedHealth | null, automation: AutomationState | null, review: number | null, money: Check[]): Check[] {
  const out: Check[] = [];
  if (feed) {
    if (feed.inFeed === 0) out.push({ id: "feed-empty", label: "El feed está vacío", level: "bad", detail: `No hay noticias de las últimas ${NEWS_FEED_HOURS} h: la portada no tiene actualidad.` });
    else if (feed.minutesSinceLast !== null && feed.minutesSinceLast > 180) out.push({ id: "feed-stale", label: "Sin publicar hace más de 3 h", level: "warn", detail: "Google y los lectores premian la frecuencia. Publica o activa la publicación automática." });
    if (feed.issues.length) out.push({ id: "seo", label: `${feed.issues.length} noticia(s) del feed con problemas SEO`, level: "warn", detail: "Revisa la lista de SEO: imagen, título y resumen." });
  }
  if (automation && !automation.enabled) out.push({ id: "auto-off", label: "Piloto automático apagado", level: "warn", detail: "Nadie redacta mientras no estás. Enciéndelo en Editorial → Modo." });
  else if (automation && !automation.autoPublish) out.push({ id: "auto-review", label: "El piloto redacta pero no publica", level: "warn", detail: "Los borradores esperan tu aprobación en Revisión." });
  if (review && review > 0) out.push({ id: "review", label: `${review} borrador(es) esperando en Revisión`, level: review > 10 ? "warn" : "ok", detail: "Apruébalos o descártalos para que el feed no se quede sin actualidad." });
  for (const c of money) if (c.level === "bad") out.push({ ...c, id: `money-${c.id}`, label: `${c.label}: no monetiza` });
  const rank: Record<Level, number> = { bad: 0, warn: 1, ok: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
