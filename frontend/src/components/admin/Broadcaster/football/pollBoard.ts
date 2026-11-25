// Keeps the on-air poll fresh while viewers vote on the portal. Lives at module
// level so it keeps running when the operator switches console tabs.

import { setPollBoard, type PollBoard } from "./designs";

interface ApiPoll { id: string; kind: "poll" | "debate"; question: string; options: { label: string; votes: number }[]; totalVotes: number }

let timer: number | null = null;
let currentId: string | null = null;

export function toPollBoard(p: ApiPoll): PollBoard {
  return { kind: p.kind, question: p.question, options: p.options.map((o) => ({ label: o.label, votes: o.votes })), total: p.totalVotes };
}

async function refresh() {
  if (!currentId) return;
  try {
    const res = await fetch(`/api/polls/${currentId}`);
    if (res.ok) setPollBoard(toPollBoard(await res.json()));
  } catch { /* next tick retries */ }
}

export function startPollBoard(id: string) {
  currentId = id;
  void refresh();
  if (timer !== null) window.clearInterval(timer);
  timer = window.setInterval(() => void refresh(), 10_000);
}

export function stopPollBoard() {
  currentId = null;
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  setPollBoard(null);
}

export const onAirPollId = () => currentId;
