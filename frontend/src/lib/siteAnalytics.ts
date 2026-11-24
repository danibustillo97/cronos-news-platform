import { supabase } from "@/lib/supabaseClient";

const SESSION_KEY = "nexus.analytics.session";
const ENTRY_RECORDED_KEY = "nexus.analytics.entry-recorded";

export interface AnalyticsDashboard {
  days: number;
  pageviews: number;
  sessions: number;
  clicks: number;
  engagedSessions: number;
  previousPageviews: number;
  previousSessions: number;
  previousClicks: number;
  previousEngagedSessions: number;
  clickRate: number;
  pagesPerSession: number;
  daily: { date: string; pageviews: number; sessions: number; clicks: number }[];
  topPages: { path: string; pageviews: number; sessions: number }[];
  topReferrers: { source: string; sessions: number }[];
  topCountries: { countryCode: string; sessions: number }[];
  topLocations: { countryCode: string; regionCode: string; sessions: number }[];
  devices: { device: "mobile" | "tablet" | "desktop"; sessions: number }[];
  topCampaigns: { source: string; campaign: string; sessions: number }[];
  topClicks: { label: string; targetPath: string | null; clicks: number }[];
}

interface AnalyticsEvent {
  sessionId: string;
  eventType: "page_view" | "click";
  pagePath: string;
  deviceType: "mobile" | "tablet" | "desktop";
  isEntry?: boolean;
  referrerDomain?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  elementLabel?: string | null;
  targetPath?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAnalyticsDashboard(value: unknown): value is AnalyticsDashboard {
  if (!isRecord(value)) return false;
  const numericFields = [
    "days", "pageviews", "sessions", "clicks", "engagedSessions",
    "previousPageviews", "previousSessions", "previousClicks", "previousEngagedSessions",
    "clickRate", "pagesPerSession",
  ];
  if (!numericFields.every((field) => typeof value[field] === "number" && Number.isFinite(value[field]))) return false;
  return Array.isArray(value.daily)
    && value.daily.every((item) => isRecord(item)
      && typeof item.date === "string"
      && typeof item.pageviews === "number"
      && typeof item.sessions === "number"
      && typeof item.clicks === "number")
    && Array.isArray(value.topPages)
    && value.topPages.every((item) => isRecord(item)
      && typeof item.path === "string"
      && typeof item.pageviews === "number"
      && typeof item.sessions === "number")
    && Array.isArray(value.topReferrers)
    && value.topReferrers.every((item) => isRecord(item)
      && typeof item.source === "string"
      && typeof item.sessions === "number")
    && Array.isArray(value.topCountries)
    && value.topCountries.every((item) => isRecord(item)
      && typeof item.countryCode === "string"
      && typeof item.sessions === "number")
    && Array.isArray(value.topLocations)
    && value.topLocations.every((item) => isRecord(item)
      && typeof item.countryCode === "string"
      && typeof item.regionCode === "string"
      && typeof item.sessions === "number")
    && Array.isArray(value.devices)
    && value.devices.every((item) => isRecord(item)
      && ["mobile", "tablet", "desktop"].includes(String(item.device))
      && typeof item.sessions === "number")
    && Array.isArray(value.topCampaigns)
    && value.topCampaigns.every((item) => isRecord(item)
      && typeof item.source === "string"
      && typeof item.campaign === "string"
      && typeof item.sessions === "number")
    && Array.isArray(value.topClicks)
    && value.topClicks.every((item) => isRecord(item)
      && typeof item.label === "string"
      && (typeof item.targetPath === "string" || item.targetPath === null)
      && typeof item.clicks === "number");
}

function getSessionId(): string {
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const sessionId = window.crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

function deviceType(): AnalyticsEvent["deviceType"] {
  if (window.innerWidth < 640) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
}

function safePath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path.slice(0, 300);
}

function campaignValue(value: string | null): string | null {
  const cleaned = value?.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120);
  if (cleaned && /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(cleaned)) return null;
  return cleaned || null;
}

function entryAttribution() {
  const url = new URL(window.location.href);
  let referrerDomain: string | null = null;
  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin !== window.location.origin) referrerDomain = referrer.hostname.slice(0, 253);
    } catch {
      referrerDomain = null;
    }
  }
  return {
    referrerDomain,
    utmSource: campaignValue(url.searchParams.get("utm_source")),
    utmMedium: campaignValue(url.searchParams.get("utm_medium")),
    utmCampaign: campaignValue(url.searchParams.get("utm_campaign")),
  };
}

async function sendEvent(event: AnalyticsEvent): Promise<void> {
  // The admin's "Portada" live preview (?preview=1 inside an iframe) is not a reader.
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("preview")) return;
  try {
    const response = await fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...event,
        pagePath: safePath(event.pagePath),
        targetPath: safePath(event.targetPath) ?? event.targetPath ?? null,
      }),
      keepalive: true,
    });
    if (!response.ok) {
      console.warn("Site analytics event could not be recorded:", response.status);
    }
  } catch (error) {
    console.warn("Site analytics event could not be recorded:", error);
  }
}

export function trackPageView(pagePath: string): void {
  if (typeof window === "undefined") return;
  const isEntry = window.sessionStorage.getItem(ENTRY_RECORDED_KEY) !== "true";
  if (isEntry) window.sessionStorage.setItem(ENTRY_RECORDED_KEY, "true");
  void sendEvent({
    sessionId: getSessionId(),
    eventType: "page_view",
    pagePath,
    deviceType: deviceType(),
    isEntry,
    ...(isEntry ? entryAttribution() : {}),
  });
}

function clickLabel(element: Element): string | null {
  const label = element.getAttribute("aria-label")
    ?? element.getAttribute("title")
    ?? element.textContent
    ?? "";
  const cleaned = label
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[correo]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, (value) => (
      value.replace(/\D/g, "").length >= 9 ? "[teléfono]" : value
    ))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned || null;
}

export function startClickTracking(): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest("a, button");
    if (!control || control.closest("[data-analytics-ignore]")) return;

    const anchor = control instanceof HTMLAnchorElement ? control : null;
    let targetPath: string | null = null;
    if (anchor?.href) {
      try {
        const url = new URL(anchor.href);
        targetPath = url.origin === window.location.origin ? safePath(url.pathname) : url.hostname;
      } catch {
        targetPath = null;
      }
    }

    void sendEvent({
      sessionId: getSessionId(),
      eventType: "click",
      pagePath: window.location.pathname,
      deviceType: deviceType(),
      elementLabel: clickLabel(control),
      targetPath,
    });
  };

  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

export async function getAnalyticsDashboard(days: number): Promise<AnalyticsDashboard> {
  const { data, error } = await supabase.rpc("get_site_analytics_dashboard", { p_days: days });
  if (error) throw new Error(error.message);
  if (!isAnalyticsDashboard(data)) throw new Error("Respuesta de analítica vacía o inválida.");
  return data;
}
