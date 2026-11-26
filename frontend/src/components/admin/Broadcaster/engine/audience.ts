// Audience Engagement Engine — polls, debates and moderated audience messages for
// a match, on top of the EXISTING backend contracts (no schema change):
//   public  GET  /api/polls?newsId=match:<league>:<id>       polls of the match with real votes
//   admin   POST /api/admin/polls · PATCH /api/admin/polls/{id}  create / open / close
//   admin   GET  /api/admin/comments?status=pending|visible · PATCH /api/admin/comments/{id}  moderation
// Audience questions = comments on the match polls; nothing reaches the screen
// without the operator choosing it. Votes are never invented: an empty poll shows 0.

import { apiFetch } from "@/studio/lab/api-client";

export interface PollOption { id?: string; label: string; votes: number; argument?: string | null }
export interface MatchPoll { id: string; kind: "poll" | "debate"; question: string; status: "draft" | "open" | "closed"; options: PollOption[]; total: number; createdAt?: string }
export interface AudienceMessage { id: string; author: string; body: string; status: "pending" | "visible" | "hidden"; targetId: string; createdAt?: string }
export type PollTemplate = "who-wins" | "figure" | "debate";

export const matchNewsId = (league: string, id: string) => `match:${league}:${id}`;

/** Real options for each template (teams, real scorers / starters). Null when the data is not there. */
export function pollFromTemplate(template: PollTemplate, ctx: { home: string; away: string; scorers?: string[]; starters?: string[] }): { kind: "poll" | "debate"; question: string; options: { label: string }[] } | null {
  if (template === "who-wins") return { kind: "poll", question: `¿Quién gana: ${ctx.home} o ${ctx.away}?`, options: [{ label: ctx.home }, { label: "Empate" }, { label: ctx.away }] };
  if (template === "figure") {
    const names = [...new Set([...(ctx.scorers ?? []), ...(ctx.starters ?? [])])].filter(Boolean).slice(0, 6);
    if (names.length < 2) return null;
    return { kind: "poll", question: `¿Quién fue la figura de ${ctx.home} vs ${ctx.away}?`, options: names.map((label) => ({ label })) };
  }
  return { kind: "debate", question: `¿Qué equipo mereció más en ${ctx.home} vs ${ctx.away}?`, options: [{ label: ctx.home }, { label: ctx.away }] };
}

function toPoll(p: { id: string; kind?: string; question: string; status?: string; options?: { id?: string; label: string; votes?: number; argument?: string | null }[]; total?: number; createdAt?: string }): MatchPoll {
  const options = (p.options ?? []).map((o) => ({ id: o.id, label: o.label, votes: o.votes ?? 0, argument: o.argument }));
  return { id: p.id, kind: p.kind === "debate" ? "debate" : "poll", question: p.question, status: (p.status as MatchPoll["status"]) ?? "open", options, total: p.total ?? options.reduce((n, o) => n + o.votes, 0), createdAt: p.createdAt };
}

export async function listMatchPolls(league: string, id: string): Promise<MatchPoll[]> {
  const res = await fetch(`/api/polls?newsId=${encodeURIComponent(matchNewsId(league, id))}&limit=20`);
  if (!res.ok) throw new Error(`Votaciones no disponibles (HTTP ${res.status})`);
  const body = await res.json() as { polls?: Parameters<typeof toPoll>[0][] };
  return (body.polls ?? []).map(toPoll);
}

export async function createMatchPoll(league: string, id: string, poll: NonNullable<ReturnType<typeof pollFromTemplate>>): Promise<MatchPoll> {
  const res = await apiFetch("/api/admin/polls", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...poll, status: "open", placement: ["pulse", "home"], newsId: matchNewsId(league, id) }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof body?.detail === "string" ? body.detail : `No se pudo crear la votación (HTTP ${res.status})`);
  return toPoll(body);
}

export async function setPollStatus(pollId: string, status: "open" | "closed"): Promise<void> {
  const res = await apiFetch(`/api/admin/polls/${encodeURIComponent(pollId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error(`No se pudo ${status === "closed" ? "cerrar" : "abrir"} la votación (HTTP ${res.status})`);
}

/** Messages of the audience on the match polls (pending first: they need moderation). */
export async function listAudienceMessages(pollIds: string[]): Promise<AudienceMessage[]> {
  if (!pollIds.length) return [];
  const ids = new Set(pollIds);
  const lists = await Promise.all((["pending", "visible"] as const).map(async (status) => {
    const res = await apiFetch(`/api/admin/comments?status=${status}`);
    if (!res.ok) throw new Error(`Mensajes no disponibles (HTTP ${res.status})`);
    return (await res.json()) as { id: string; author: string; body: string; status: AudienceMessage["status"]; targetType: string; targetId: string; createdAt?: string }[];
  }));
  return lists.flat().filter((c) => c.targetType === "poll" && ids.has(c.targetId)).map((c) => ({ id: c.id, author: c.author, body: c.body, status: c.status, targetId: c.targetId, createdAt: c.createdAt }));
}

export async function moderate(commentId: string, status: "visible" | "hidden"): Promise<void> {
  const res = await apiFetch(`/api/admin/comments/${encodeURIComponent(commentId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error(`No se pudo moderar (HTTP ${res.status})`);
}
