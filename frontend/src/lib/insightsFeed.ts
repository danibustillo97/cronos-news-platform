// "Motor inteligente": antesalas e impactos de partidos.
//   GET /api/insights/feed -> { insights: Insight[], updatedAt }
// Los datos (facts) se muestran tal cual llegan: nunca se inventan.

import type { MomentItem } from '@/lib/moments'

export interface InsightTeam { id: string; name: string; short: string; logo: string | null; score: number | null; form: string | null; position: number | null; points: number | null }
export interface Insight {
  id: string
  kind: 'preview' | 'impact'
  league: string
  leagueName: string
  matchId: string
  kickoff: string
  state: string
  headline: string
  facts: string[]
  home: InsightTeam
  away: InsightTeam
  market: { home: number; draw: number; away: number } | null
  h2h: { date: string; result: 'W' | 'D' | 'L'; score: string; competition: string }[]
  standings: { pos: number; teamId: string; team: string; points: number; played: number; gd: number; highlight: boolean }[]
  format: string | null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0)

function team(v: unknown): InsightTeam {
  const r = isRecord(v) ? v : {}
  const name = str(r.name, 80) || '—'
  const form = str(r.form, 10).toUpperCase().replace(/[^WDL]/g, '')
  return { id: str(r.id, 64), name, short: str(r.short, 30) || name, logo: str(r.logo, 600) || null, score: numOrNull(r.score), form: form || null, position: numOrNull(r.position), points: numOrNull(r.points) }
}

export function normalizeFeedInsights(raw: unknown): Insight[] {
  const list = isRecord(raw) && Array.isArray(raw.insights) ? raw.insights : []
  const seen = new Set<string>()
  const out: Insight[] = []
  for (const x of list) {
    if (!isRecord(x)) continue
    const id = str(x.id, 128)
    const kind = x.kind === 'preview' || x.kind === 'impact' ? x.kind : null
    if (!id || !kind || seen.has(id) || !str(x.matchId, 64)) continue
    seen.add(id)
    const m = isRecord(x.market) ? x.market : null
    out.push({
      id, kind,
      league: str(x.league, 40), leagueName: str(x.leagueName, 80), matchId: str(x.matchId, 64),
      kickoff: str(x.kickoff, 40), state: str(x.state, 10), headline: str(x.headline, 200),
      facts: (Array.isArray(x.facts) ? x.facts : []).map((f) => str(f, 300)).filter(Boolean).slice(0, 10),
      home: team(x.home), away: team(x.away),
      market: m && [m.home, m.draw, m.away].every((v) => typeof v === 'number') ? { home: int(m.home), draw: int(m.draw), away: int(m.away) } : null,
      h2h: (Array.isArray(x.h2h) ? x.h2h : []).filter(isRecord).map((h) => ({
        date: str(h.date, 40), result: (h.result === 'W' || h.result === 'D' ? h.result : 'L') as 'W' | 'D' | 'L', score: str(h.score, 12), competition: str(h.competition, 80),
      })).slice(0, 10),
      standings: (Array.isArray(x.standings) ? x.standings : []).filter(isRecord).map((s) => ({
        pos: int(s.pos), teamId: str(s.teamId, 64), team: str(s.team, 80), points: int(s.points), played: int(s.played), gd: int(s.gd), highlight: s.highlight === true,
      })).filter((s) => s.team).slice(0, 12),
      format: str(x.format, 600) || null,
    })
  }
  return out
}

export type DynamicItem = { type: 'moment'; key: string; item: MomentItem } | { type: 'insight'; key: string; insight: Insight }

/**
 * Mezcla momentos (lo que pasó) y antesalas (lo que viene) para los
 * lugares dinámicos del feed: alterna empezando por el momento más
 * reciente; cuando se acaba un tipo, sigue el otro.
 */
export function mergeDynamic(moments: MomentItem[], insights: Insight[]): DynamicItem[] {
  const out: DynamicItem[] = []
  const max = Math.max(moments.length, insights.length)
  for (let i = 0; i < max; i++) {
    if (moments[i]) out.push({ type: 'moment', key: moments[i].key, item: moments[i] })
    if (insights[i]) out.push({ type: 'insight', key: `in-${insights[i].id}`, insight: insights[i] })
  }
  return out
}

/** "hoy 14:45", "mañana 20:00", "jue 26 · 12:45". */
export function kickoffShort(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  if (d.toDateString() === now.toDateString()) return `hoy ${time}`
  if (d.toDateString() === tomorrow.toDateString()) return `mañana ${time}`
  return `${new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric' }).format(d)} · ${time}`
}
