'use client'

// Hook único para leer backend/app/presentation/api/sports.py::get_scoreboard.
// Antes cada consumidor (ModernNewsPortal) hacía un fetch único al montar
// y nunca refrescaba -- un partido que pasaba a EN VIVO o terminaba no se
// actualizaba sin recargar la página. Este hook agrega un poll real
// (30s, razonable para un scoreboard, no tan agresivo como para saturar
// el proxy ESPN) y lo comparte entre Home (Pulse) y el hub /deportes.

import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '@/studio/lab/api-client'
import type { Match } from '@/types/sports'

const POLL_MS = 30_000

export function useScoreboard(leagues?: string) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const leaguesRef = useRef(leagues)
  leaguesRef.current = leagues

  useEffect(() => {
    let cancelled = false

    const load = () => {
      const qs = leaguesRef.current ? `?leagues=${leaguesRef.current}` : ''
      fetch(apiUrl(`/api/sports/scoreboard${qs}`))
        .then((res) => (res.ok ? res.json() : []))
        .then((rows: Match[]) => { if (!cancelled) setMatches(rows) })
        .catch(() => { if (!cancelled) setMatches([]) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }

    load()
    const id = window.setInterval(load, POLL_MS)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [leagues])

  return { matches, loading }
}
