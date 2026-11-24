// Going on air switches the public homepage stage automatically:
//   video live -> stage "video" with the Kick player
//   radio live -> stage "radio" with the Zeno.fm listen URL (unless video is live)
// The previous layout is remembered and restored when the transmission ends.

import { apiFetch } from "@/studio/lab/api-client";
import { DEFAULT_LAYOUT, type PortalLayout } from "@/types/portal";

const SNAPSHOT_KEY = "nexus.portal.beforeOnAir";

export type OnAirSource = "video" | "radio";

async function readLayout(): Promise<PortalLayout> {
  const response = await apiFetch("/api/portal/layout");
  return response.ok ? (await response.json()) as PortalLayout : DEFAULT_LAYOUT;
}

async function writeLayout(layout: PortalLayout): Promise<void> {
  const response = await apiFetch("/api/portal/layout", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(layout),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || body?.message || `HTTP ${response.status}`);
  }
}

function rememberOnce(layout: PortalLayout) {
  try {
    if (!window.sessionStorage.getItem(SNAPSHOT_KEY)) window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(layout));
  } catch {
    // storage blocked: restore falls back to the news stage
  }
}

export function kickPlayerUrl(channel: string): string | null {
  const clean = channel.trim().replace(/^https?:\/\/(www\.|player\.)?kick\.com\//i, "").replace(/\/+$/, "");
  return /^[A-Za-z0-9_-]{2,40}$/.test(clean) ? `https://kick.com/${clean}` : null;
}

/** Put the live transmission on the homepage stage. Returns false if not configured. */
export async function portalGoLive(source: OnAirSource, opts: { url: string; title: string }): Promise<void> {
  const current = await readLayout();
  if (source === "radio" && current.stage.mode === "video") return; // video has priority on the stage
  rememberOnce(current);
  const stage = source === "video"
    ? { ...current.stage, mode: "video" as const, video: { url: opts.url, title: opts.title } }
    : { ...current.stage, mode: "radio" as const, radio: { url: opts.url, title: opts.title } };
  await writeLayout({ ...current, stage });
}

/** Transmission ended: give the stage back to what it showed before. */
export async function portalEndLive(source: OnAirSource): Promise<void> {
  const current = await readLayout();
  if (current.stage.mode !== source) return; // someone already changed it by hand
  let before: PortalLayout | null = null;
  try {
    const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
    before = raw ? (JSON.parse(raw) as PortalLayout) : null;
    window.sessionStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    before = null;
  }
  const mode = before && before.stage.mode !== source ? before.stage.mode : "news";
  await writeLayout({ ...current, stage: { ...current.stage, mode } });
}
