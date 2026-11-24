'use client'

// Tabla real de /api/sports/standings con caché en memoria por liga
// (el hub deportivo y la tarjeta del feed comparten la misma respuesta).

import { useEffect, useState } from 'react'
import { apiUrl } from '@/studio/lab/api-client'
import { sortStandings, type StandingsRowData } from '@/lib/standings'

interface StandingsResult { leagueName: string; table: StandingsRowData[] }

const TTL_MS = 5 * 60_000
const cache = new Map<string, { at: number; promise: Promise<StandingsResult> }>()

export function fetchStandings(league: string): Promise<StandingsResult> {
  const hit = cache.get(league)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise
  const promise = fetch(apiUrl(`/api/sports/standings?league=${encodeURIComponent(league)}`))
    .then((res) => (res.ok ? res.json() : { table: [] }))
    .then((data: { leagueName?: string; table?: StandingsRowData[] }) => ({
      leagueName: data.leagueName ?? '',
      table: sortStandings(Array.isArray(data.table) ? data.table : []),
    }))
    .catch(() => {
      cache.delete(league)
      return { leagueName: '', table: [] }
    })
  cache.set(league, { at: Date.now(), promise })
  return promise
}

export function useStandings(league: string | null) {
  const [state, setState] = useState<{ league: string | null; data: StandingsResult | null }>({ league: null, data: null })

  useEffect(() => {
    if (!league) return
    let cancelled = false
    fetchStandings(league).then((data) => { if (!cancelled) setState({ league, data }) })
    return () => { cancelled = true }
  }, [league])

  const current = state.league === league ? state.data : null
  return { table: current?.table ?? [], leagueName: current?.leagueName ?? '', loading: Boolean(league) && current === null }
}

/** Varias ligas a la vez (para los datos automáticos). Devuelve solo las que ya cargaron. */
export function useManyStandings(leagues: readonly string[]) {
  const key = leagues.join(',')
  const [data, setData] = useState<{ league: string; leagueName: string; table: StandingsRowData[] }[]>([])
  useEffect(() => {
    let cancelled = false
    const ids = key ? key.split(',') : []
    Promise.all(ids.map((league) => fetchStandings(league).then((r) => ({ league, ...r }))))
      .then((rows) => { if (!cancelled) setData(rows) })
    return () => { cancelled = true }
  }, [key])
  return data
}
