import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

interface AnalyticsPayload {
  sessionId?: unknown;
  eventType?: unknown;
  pagePath?: unknown;
  deviceType?: unknown;
  isEntry?: unknown;
  referrerDomain?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  elementLabel?: unknown;
  targetPath?: unknown;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength);
  return cleaned || null;
}

function safePath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("?") || value.includes("#")) return null;
  return value.length <= 300 ? value : null;
}

function geoCode(value: string | null, pattern: RegExp): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  return pattern.test(normalized) ? normalized : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid analytics event." }, { status: 400 });
  }
  const payload = body as AnalyticsPayload;

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  const pagePath = safePath(payload.pagePath);
  const deviceType = payload.deviceType;
  const isPageView = payload.eventType === "page_view";
  const isClick = payload.eventType === "click";
  const eventType = isPageView ? "page_view" : "click";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
    || !pagePath
    || !["mobile", "tablet", "desktop"].includes(String(deviceType))
    || (!isPageView && !isClick)) {
    return NextResponse.json({ error: "Invalid analytics event." }, { status: 400 });
  }

  const isEntry = isPageView && payload.isEntry === true;
  const countryCode = isEntry
    ? geoCode(request.headers.get("x-vercel-ip-country"), /^[A-Z]{2}$/)
    : null;
  const regionCode = countryCode && isEntry
    ? geoCode(request.headers.get("x-vercel-ip-country-region"), /^[A-Z0-9-]{1,12}$/)
    : null;

  const { data, error } = await supabase.rpc("record_site_analytics_event", {
    p_session_id: sessionId,
    p_event_type: eventType,
    p_page_path: pagePath,
    p_device_type: deviceType,
    p_is_entry: isEntry,
    p_referrer_domain: isEntry ? optionalText(payload.referrerDomain, 253) : null,
    p_utm_source: isEntry ? optionalText(payload.utmSource, 120) : null,
    p_utm_medium: isEntry ? optionalText(payload.utmMedium, 120) : null,
    p_utm_campaign: isEntry ? optionalText(payload.utmCampaign, 120) : null,
    p_element_label: eventType === "click" ? optionalText(payload.elementLabel, 100) : null,
    p_target_path: eventType === "click" ? optionalText(payload.targetPath, 300) : null,
    p_country_code: countryCode,
    p_region_code: regionCode,
  });

  if (error) {
    console.error("Site analytics event could not be recorded:", error.message);
    return NextResponse.json({ error: "Analytics event could not be recorded." }, { status: 503 });
  }

  return NextResponse.json({ recorded: data === true }, { status: 202 });
}
