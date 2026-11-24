'use client'

// Encuestas/debates: lectura (lista por placement) y voto. Si el backend
// aún no tiene los endpoints (404/503), devuelve [] y los bloques se ocultan.

import { useCallback, useEffect, useState } from 'react'
import {
  applyLocalVote, getVoterId, markVoted, normalizePoll, normalizePolls, randomUuid, readVoted, type Poll,
} from '@/lib/polls'
import { safeStorage } from '@/lib/players'

export function usePolls(query: string = 'placement=home') {
  const [polls, setPolls] = useState<Poll[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/polls?${query}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { polls: [] }))
      .then((data: unknown) => { if (!cancelled) setPolls(normalizePolls(data)) })
      .catch(() => { if (!cancelled) setPolls([]) })
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [query])

  return { polls, loaded }
}

export type VoteState = 'idle' | 'sending' | 'error'

/** Estado de voto de UNA encuesta: opción elegida (persistida local) + resultados vivos. */
export function usePollVote(initial: Poll) {
  const [poll, setPoll] = useState(initial)
  const [voted, setVoted] = useState<string | null>(null)
  const [state, setState] = useState<VoteState>('idle')

  useEffect(() => { setPoll(initial) }, [initial])
  useEffect(() => { setVoted(readVoted(safeStorage())[initial.id] ?? null) }, [initial.id])

  const vote = useCallback(async (optionId: string) => {
    if (voted || state === 'sending') return
    const storage = safeStorage()
    const voterId = getVoterId(storage, randomUuid)
    const previous = poll
    setState('sending')
    setVoted(optionId)
    setPoll((p) => applyLocalVote(p, optionId))
    try {
      const res = await fetch(`/api/polls/${encodeURIComponent(poll.id)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, voterId }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (res.ok || res.status === 409) {
        const server = normalizePoll(res.status === 409 && body && typeof body === 'object' ? (body as { poll?: unknown }).poll : body)
        if (server) setPoll(server)
        markVoted(storage, poll.id, optionId)
        setState('idle')
        return
      }
      throw new Error(String(res.status))
    } catch {
      setPoll(previous)
      setVoted(null)
      setState('error')
    }
  }, [poll, voted, state])

  return { poll, voted, vote, state }
}
