// Persistence of the production room: rundowns per match, automation (modes, dedupe,
// history, paused), event stores (dedupe across reloads) and operator preferences.
// Saved at once in localStorage (works offline) and, when signed in, in Supabase
// (existing table football_broadcast_matches, RLS by user, marked row) so it follows
// the operator to another device. No schema change.

import { PRODUCTION_COMPETITION, loadProductionWorkspace, saveFootballBroadcast } from "@/lib/footballBroadcastStorage";

export interface ProductionWorkspace {
  version: 1;
  savedAt: number;
  rundowns: Record<string, unknown>;      // matchKey -> Block[]
  automation?: unknown;                   // AutomationEngine.serialize()
  events?: Record<string, unknown>;       // matchKey -> MatchEventStore.serialize()
  prefs: { rundownMode?: "auto" | "manual"; automationOn?: boolean };
}

const KEY = "nexus.production.v1";
const ROW = "nexus.production.row";
export const emptyWorkspace = (): ProductionWorkspace => ({ version: 1, savedAt: 0, rundowns: {}, prefs: {} });

export function readLocal(): ProductionWorkspace {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null") as ProductionWorkspace | null; return v?.version === 1 ? v : emptyWorkspace(); } catch { return emptyWorkspace(); }
}
export function writeLocal(ws: ProductionWorkspace) {
  try { localStorage.setItem(KEY, JSON.stringify(ws)); } catch { /* quota / private mode: the cloud copy still works */ }
}

/** Newest of local and cloud (cloud only when signed in). */
export async function loadWorkspace(): Promise<ProductionWorkspace> {
  const local = readLocal();
  try {
    const row = await loadProductionWorkspace<ProductionWorkspace>();
    if (row?.payload?.version === 1) {
      try { localStorage.setItem(ROW, row.id); } catch { /* ignore */ }
      return row.payload.savedAt > local.savedAt ? row.payload : local;
    }
  } catch { /* offline or no session */ }
  return local;
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Local now; cloud debounced (5 s) to keep traffic low during a live match. */
export function saveWorkspace(ws: ProductionWorkspace) {
  const stamped = { ...ws, savedAt: Date.now() };
  writeLocal(stamped);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    let rowId: string | null = null;
    try { rowId = localStorage.getItem(ROW); } catch { /* ignore */ }
    void saveFootballBroadcast(rowId, "Producción NEXUS SPORT", PRODUCTION_COMPETITION, stamped)
      .then((id) => { if (id) { try { localStorage.setItem(ROW, id); } catch { /* ignore */ } } })
      .catch(() => { /* stays local until the next save */ });
  }, 5000);
}
