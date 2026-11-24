// Feed "Reels" del home -- lógica pura.
//
// composeReels: secuencia determinista que depende SOLO de las historias
// (así el HTML del servidor y el del navegador coinciden y nada se
// reordena cuando llegan datos). Los bloques que dependen de datos que se
// cargan en el navegador (tablas, partidos, encuestas, datos automáticos,
// publicidad) entran como "slots": si al final no hay datos, la tarjeta
// colapsa y no deja hueco.
//
// Reglas: nunca dos bloques que no son noticia seguidos (mientras haya
// noticias), nunca el mismo tipo dos veces seguidas, una tabla cada 6-8
// ítems con ligas rotando, y relleno cuando hay pocas noticias.

import type { Match } from '@/types/sports'
import { briefPoints, type FeedStory } from '@/lib/feedComposer'
import type { StandingsRowData } from '@/lib/standings'

export type ReelItem<S extends FeedStory = FeedStory> =
  | { type: 'news'; key: string; story: S }
  | { type: 'brief'; key: string; story: S }
  | { type: 'table'; key: string; league: string }
  | { type: 'match'; key: string; slot: number }
  | { type: 'poll'; key: string; slot: number }
  | { type: 'fact'; key: string; slot: number }
  | { type: 'capsule'; key: string; slot: number }
  | { type: 'picks'; key: string }
  | { type: 'ad'; key: string; position: 'HOME_TOP' | 'HOME_FEED' }

export type ReelType = ReelItem['type']

export const TABLE_ROTATION = ['col.1', 'eng.1', 'esp.1', 'conmebol.libertadores', 'ita.1', 'uefa.champions', 'ger.1'] as const

export interface ReelsInput<S extends FeedStory> {
  /** Historias para tarjetas (sin las del Escenario), en orden. */
  stories: S[]
  /** Historias del Escenario: pueden volver como "En 30 segundos" (otro formato, no duplicado). */
  stageStories?: S[]
  leagues?: readonly string[]
  /** Cantidad de slots a reservar por tipo. */
  matchSlots?: number
  pollSlots?: number
  factSlots?: number
  /** Cápsulas (efemérides, leyendas…); 0 = ninguna. */
  capsuleSlots?: number
  /** Una tarjeta "Parley del día" (como mucho una vez cada ~10 ítems). */
  picks?: boolean
  /** Una tabla cada N ítems (6-8). */
  tableEvery?: number
  adEvery?: number
  /** Tamaño mínimo del feed: se rellena con bloques de datos cuando hay pocas noticias. */
  minItems?: number
}
export function hasBrief(story: FeedStory): boolean {
  return briefPoints(story).length >= 2
}

export function composeReels<S extends FeedStory>(input: ReelsInput<S>): ReelItem<S>[] {
  const leagues = input.leagues ?? TABLE_ROTATION
  const tableEvery = Math.min(8, Math.max(6, input.tableEvery ?? 7))
  const adEvery = Math.max(6, input.adEvery ?? 9)
  const minItems = input.minItems ?? 14

  // Formato de cada historia: 1 de cada 4 (si tiene material) como "En 30 segundos".
  const storyItems: ReelItem<S>[] = input.stories.map((story, i) =>
    i % 4 === 2 && hasBrief(story)
      ? { type: 'brief', key: `brief-${story.id}`, story }
      : { type: 'news', key: `news-${story.id}`, story })
  const stageBriefs: ReelItem<S>[] = (input.stageStories ?? [])
    .filter(hasBrief)
    .slice(0, 2)
    .map((story) => ({ type: 'brief', key: `brief-${story.id}`, story }))

  // Cola de relleno en orden de prioridad, con tipos alternados.
  const fillers: ReelItem<S>[] = []
  const counters = { match: 0, poll: 0, fact: 0, capsule: 0 }
  const caps = { match: input.matchSlots ?? 3, poll: input.pollSlots ?? 2, fact: input.factSlots ?? 6, capsule: input.capsuleSlots ?? 0 }
  const cycle: ('brief' | 'match' | 'fact' | 'poll' | 'capsule')[] = ['brief', 'capsule', 'match', 'fact', 'poll', 'capsule', 'fact', 'brief', 'match', 'fact']
  let guard = 0
  while (guard++ < 40) {
    let added = false
    for (const kind of cycle) {
      if (kind === 'brief') {
        const next = stageBriefs.shift()
        if (next) { fillers.push(next); added = true }
      } else if (counters[kind] < caps[kind]) {
        fillers.push({ type: kind, key: `${kind}-${counters[kind]}`, slot: counters[kind] } as ReelItem<S>)
        counters[kind] += 1
        added = true
      }
    }
    if (!added) break
  }

  const out: ReelItem<S>[] = []
  let leagueIndex = 0
  let sinceTable = 3 // primera tabla temprano (≈ 4.º-5.º ítem)
  const lastNonNews = () => [...out].reverse().find((i) => i.type !== 'news')?.type
  const takeFiller = (): ReelItem<S> | null => {
    const last = out[out.length - 1]?.type
    const idx = fillers.findIndex((f) => f.type !== last && f.type !== lastNonNews())
    const pick = idx >= 0 ? idx : fillers.findIndex((f) => f.type !== last)
    return pick >= 0 ? fillers.splice(pick, 1)[0] : null
  }
  const pushTable = () => {
    if (leagues.length === 0) return false
    const league = leagues[leagueIndex % leagues.length]
    out.push({ type: 'table', key: `table-${league}-${leagueIndex}`, league })
    leagueIndex += 1
    sinceTable = 0
    return true
  }

  storyItems.forEach((item, i) => {
    out.push(item)
    sinceTable += 1
    const isNews = item.type === 'news'
    // Tras un ítem de noticia puede ir UN bloque distinto (nunca dos seguidos).
    if (!isNews) return
    // Si lo que sigue es un "En 30 segundos" (no noticia), no se intercala nada aquí.
    if (storyItems[i + 1] && storyItems[i + 1].type !== 'news') return
    if (sinceTable >= tableEvery - 1 && out[out.length - 1].type !== 'table') { pushTable(); return }
    const few = storyItems.length < 8
    if (few || i % 2 === 1) {
      const f = takeFiller()
      if (f) { out.push(f); sinceTable += 1 }
    }
  })

  // Relleno: pocas noticias -> se alternan datos sin repetir tipo consecutivo.
  guard = 0
  while (out.length < minItems && guard++ < 40) {
    const last = out[out.length - 1]?.type
    if (sinceTable >= tableEvery - 2 && last !== 'table') { if (pushTable()) continue }
    const f = takeFiller()
    if (f) { out.push(f); sinceTable += 1; continue }
    if (last !== 'table' && pushTable()) continue
    break
  }

  // Parley del día: una sola vez, después de una noticia a partir del ~8.º ítem.
  if (input.picks && out.length > 0) {
    let at = out.findIndex((it, i) => i >= 7 && it.type === 'news' && out[i + 1]?.type !== 'picks')
    if (at < 0) at = Math.min(out.length - 1, 7)
    // Nunca pegado a otro bloque que no sea noticia si se puede evitar.
    out.splice(at + 1, 0, { type: 'picks', key: 'picks' })
  }

  // Publicidad: HOME_TOP tras el 3.er ítem, luego HOME_FEED cada `adEvery`,
  // siempre después de una noticia cuando la hay (y nunca junto a otra publicidad).
  const withAds: ReelItem<S>[] = []
  let adCount = 0
  let nextAdAt = 3
  out.forEach((item, i) => {
    withAds.push(item)
    const nextType = out[i + 1]?.type
    if (i + 1 >= nextAdAt && (item.type === 'news' || i === out.length - 1 || !out.some((o, j) => j > i && o.type === 'news')) && nextType !== 'ad') {
      withAds.push({ type: 'ad', key: `ad-${adCount}`, position: adCount === 0 ? 'HOME_TOP' : 'HOME_FEED' })
      adCount += 1
      nextAdAt = i + 1 + adEvery
    }
  })
  return withAds
}

// --------------------------------------------------------- En 30 segundos

export type BriefSlide =
  | { kind: 'title'; text: string; kicker: string }
  | { kind: 'point'; text: string; index: number; total: number }
  | { kind: 'cta'; text: string }

/** Diapositivas de "En 30 segundos": portada, 2-3 frases clave de la nota, cierre. */
export function briefSlides(story: Pick<FeedStory, 'title' | 'excerpt' | 'content' | 'summary'> & { category?: string | null }): BriefSlide[] {
  const points = briefPoints(story, 3)
  if (points.length < 2) return []
  return [
    { kind: 'title', text: story.title, kicker: story.category || 'En 30 segundos' },
    ...points.map((text, i) => ({ kind: 'point' as const, text, index: i + 1, total: points.length })),
    { kind: 'cta', text: 'Leer la noticia completa' },
  ]
}

/** Duración por diapositiva para que el total ronde los 30 s. */
export function slideDurationMs(count: number): number {
  if (count <= 0) return 7500
  return Math.round(Math.min(9000, Math.max(6000, 30_000 / count)))
}

// ----------------------------------------------------- Datos automáticos

export interface AutoFact {
  id: string
  kicker: string
  headline: string
  value: string | null
  detail: string | null
  href: string
  league?: string
}

function n(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const x = Number(String(v).replace('+', ''))
  return Number.isFinite(x) ? x : null
}

const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`

/**
 * Datos generados SOLO a partir de tablas y marcadores reales. Si un dato
 * no se puede calcular con certeza (tabla vacía, sin partidos jugados,
 * empates en el primer lugar), simplemente no se genera.
 */
export function autoFacts(
  standings: { league: string; label: string; table: StandingsRowData[] }[],
  matches: Match[],
  now: Date,
): AutoFact[] {
  const facts: AutoFact[] = []

  const live = matches.filter((m) => m.status === 'live')
  if (live.length > 0) {
    facts.push({
      id: 'live-now', kicker: 'Ahora mismo', value: String(live.length),
      headline: live.length === 1 ? 'partido en vivo' : 'partidos en vivo',
      detail: live.slice(0, 3).map((m) => `${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`).join(' · '),
      href: '/deportes/futbol?view=live',
    })
  }

  const today = now.toDateString()
  const playedToday = matches.filter((m) => m.status !== 'scheduled' && m.date && new Date(m.date).toDateString() === today)
  const goalsToday = playedToday.reduce((s, m) => s + m.homeScore + m.awayScore, 0)
  if (playedToday.length > 0 && goalsToday > 0) {
    facts.push({
      id: 'goals-today', kicker: 'Goles de hoy', value: String(goalsToday),
      headline: `${goalsToday === 1 ? 'gol' : 'goles'} en ${plural(playedToday.length, 'partido', 'partidos')}`,
      detail: null, href: '/deportes/futbol?view=results',
    })
  }

  const biggest = matches
    .filter((m) => m.status === 'finished' && Math.abs(m.homeScore - m.awayScore) >= 3)
    .sort((a, b) => Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore))[0]
  if (biggest) {
    const homeWon = biggest.homeScore > biggest.awayScore
    facts.push({
      id: `rout-${biggest.id}`, kicker: 'Goleada', value: `${biggest.homeScore}-${biggest.awayScore}`,
      headline: `${homeWon ? biggest.homeTeam : biggest.awayTeam} goleó a ${homeWon ? biggest.awayTeam : biggest.homeTeam}`,
      detail: biggest.leagueName, href: `/deportes/futbol?league=${encodeURIComponent(biggest.league)}&view=results`, league: biggest.league,
    })
  }

  for (const { league, label, table } of standings) {
    const rows = table.filter((r) => n(r.points) !== null)
    if (rows.length < 2) continue
    const href = `/deportes/futbol/tabla?league=${encodeURIComponent(league)}`
    const [first, second] = [...rows].sort((a, b) => (n(a.rank) ?? 99) - (n(b.rank) ?? 99))
    const p1 = n(first.points)!
    const p2 = n(second.points)!
    const played = n(first.played) ?? 0
    if (played > 0 && p1 > p2) {
      const gap = p1 - p2
      facts.push({
        id: `leader-${league}`, kicker: `Líder · ${label}`, value: `${p1} pts`,
        headline: `${first.team} manda en ${label}`,
        detail: `${plural(gap, 'punto', 'puntos')} sobre ${second.team} tras ${plural(played, 'fecha', 'fechas')}`,
        href, league,
      })
    }
    const withPlayed = rows.filter((r) => (n(r.played) ?? 0) > 0 && n(r.goalsFor) !== null)
    if (withPlayed.length >= 4) {
      const attack = [...withPlayed].sort((a, b) => n(b.goalsFor)! - n(a.goalsFor)!)
      if (n(attack[0].goalsFor)! > 0 && n(attack[0].goalsFor)! !== n(attack[1].goalsFor)) {
        facts.push({
          id: `attack-${league}`, kicker: `Mejor ataque · ${label}`, value: String(n(attack[0].goalsFor)),
          headline: `goles de ${attack[0].team}`, detail: `en ${plural(n(attack[0].played)!, 'partido', 'partidos')}`, href, league,
        })
      }
      const defense = [...withPlayed].filter((r) => n(r.goalsAgainst) !== null).sort((a, b) => n(a.goalsAgainst)! - n(b.goalsAgainst)!)
      if (defense.length >= 2 && n(defense[0].goalsAgainst) !== n(defense[1].goalsAgainst)) {
        facts.push({
          id: `defense-${league}`, kicker: `Mejor defensa · ${label}`, value: String(n(defense[0].goalsAgainst)),
          headline: `goles recibidos por ${defense[0].team}`, detail: `en ${plural(n(defense[0].played)!, 'partido', 'partidos')}`, href, league,
        })
      }
    }
  }

  // Siempre disponible y sin números inventados: invita al comparador.
  facts.push({
    id: 'compare-cta', kicker: 'Cara a cara', value: null,
    headline: 'Luis Díaz vs James Rodríguez', detail: 'Compara goles, asistencias y remates temporada por temporada.',
    href: '/jugadores/comparar?a=257390&b=82816',
  })

  // Intercala por liga para no repetir la misma competición seguida.
  const out: AutoFact[] = []
  const pool = [...facts]
  while (pool.length > 0) {
    const last = out[out.length - 1]?.league
    const idx = pool.findIndex((f) => !f.league || f.league !== last)
    out.push(pool.splice(idx >= 0 ? idx : 0, 1)[0])
  }
  return out
}

/** Partidos para el slot k: 0 = en vivo/próximos destacados, 1 = próximos de hoy, 2 = últimos resultados. */
export function matchesForSlot(matches: Match[], slot: number, now: Date, max = 3): { title: string; matches: Match[] } | null {
  const t = (m: Match) => (m.date ? Date.parse(m.date) : 0)
  const live = matches.filter((m) => m.status === 'live')
  const upcoming = matches.filter((m) => m.status === 'scheduled' && t(m) >= now.getTime() - 15 * 60_000).sort((a, b) => t(a) - t(b))
  const results = matches.filter((m) => m.status === 'finished').sort((a, b) => t(b) - t(a))
  const groups: { title: string; matches: Match[] }[] = []
  if (live.length > 0) groups.push({ title: 'En vivo', matches: live.slice(0, max) })
  if (upcoming.length > 0) groups.push({ title: 'Próximos partidos', matches: upcoming.slice(0, max) })
  if (results.length > 0) groups.push({ title: 'Resultados', matches: results.slice(0, max) })
  if (upcoming.length > max) groups.push({ title: 'Más tarde', matches: upcoming.slice(max, max * 2) })
  return groups[slot] ?? null
}

