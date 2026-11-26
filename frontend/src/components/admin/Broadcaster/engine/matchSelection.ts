// Match selection of the production, kept apart from the data:
//   activeMatchId    — main match (any usable status: previa, live or post-match)
//   selectedMatchIds — matches selected for the LIVE production (ordered; live only)
//   liveMatchIds     — what the provider says is live now (derived, never stored)
// One module store (survives panels and tabs) persisted in localStorage; data
// refreshes never overwrite it. The multi-screen follows selectedMatchIds.

import { useEffect, useState } from "react";
import { readMultiSelection, writeMultiSelection } from "../football/liveBoard";

export interface SelectionState { activeMatchId: string | null; selectedMatchIds: string[] }
const KEY = "nexus.broadcast.selection.v1";

// ---------------------------------------------------------------- pure transitions (tested)
export const select = (s: SelectionState, id: string, eligible: boolean): SelectionState =>
  !eligible || s.selectedMatchIds.includes(id) ? s : { ...s, selectedMatchIds: [...s.selectedMatchIds, id] };
export const deselect = (s: SelectionState, id: string): SelectionState => ({ ...s, selectedMatchIds: s.selectedMatchIds.filter((x) => x !== id) });
export const toggle = (s: SelectionState, id: string, eligible: boolean): SelectionState => (s.selectedMatchIds.includes(id) ? deselect(s, id) : select(s, id, eligible));
export const selectAll = (s: SelectionState, liveIds: string[]): SelectionState => ({ ...s, selectedMatchIds: [...s.selectedMatchIds, ...liveIds.filter((id) => !s.selectedMatchIds.includes(id))] });
export const clear = (s: SelectionState): SelectionState => ({ ...s, selectedMatchIds: [] });
/** Changing the main match never touches the secondary ones. */
export const setActive = (s: SelectionState, id: string | null): SelectionState => ({ ...s, activeMatchId: id });
export const move = (s: SelectionState, id: string, dir: -1 | 1): SelectionState => {
  const i = s.selectedMatchIds.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= s.selectedMatchIds.length) return s;
  const next = [...s.selectedMatchIds];
  [next[i], next[j]] = [next[j], next[i]];
  return { ...s, selectedMatchIds: next };
};
/** Matches that left the live state leave the live selection (the main match stays: it may go to post-match). */
export const prune = (s: SelectionState, liveIds: Set<string>, known: Set<string>): SelectionState => {
  const kept = s.selectedMatchIds.filter((id) => liveIds.has(id) || !known.has(id));
  return kept.length === s.selectedMatchIds.length ? s : { ...s, selectedMatchIds: kept };
};

// ---------------------------------------------------------------- store
let state: SelectionState = { activeMatchId: null, selectedMatchIds: [] };
let loaded = false;
const listeners = new Set<(s: SelectionState) => void>();
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null") as SelectionState | null;
    state = v && Array.isArray(v.selectedMatchIds) ? v : { activeMatchId: null, selectedMatchIds: readMultiSelection() };
  } catch { /* defaults */ }
}
export function getSelection(): SelectionState { load(); return state; }
export function updateSelection(fn: (s: SelectionState) => SelectionState) {
  load();
  const next = fn(state);
  if (next === state) return;
  const selectionChanged = next.selectedMatchIds.join() !== state.selectedMatchIds.join();
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  if (selectionChanged) writeMultiSelection(state.selectedMatchIds); // the multi-screen follows the live selection
  listeners.forEach((l) => l(state));
}
export function useSelection(): SelectionState {
  const [s, set] = useState<SelectionState>({ activeMatchId: null, selectedMatchIds: [] });
  useEffect(() => { set(getSelection()); listeners.add(set); return () => { listeners.delete(set); }; }, []);
  return s;
}
