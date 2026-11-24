'use client'

import { useMemo } from 'react'
import { Vote } from 'lucide-react'
import PortalPage, { pageShell } from '@/components/portal/PortalPage'
import { PollBlock } from '@/components/portal/PollCard'
import { Skeleton } from '@/components/portal/PortalBits'
import { usePolls } from '@/lib/usePolls'
import { sortPolls, type Poll } from '@/lib/polls'

export default function PollsClient() {
  const home = usePolls('placement=home')
  const pulse = usePolls('placement=pulse')
  const polls = useMemo(() => {
    const byId = new Map<string, Poll>()
    for (const p of [...home.polls, ...pulse.polls]) byId.set(p.id, p)
    return sortPolls([...byId.values()], new Date())
  }, [home.polls, pulse.polls])
  const loaded = home.loaded && pulse.loaded

  return (
    <PortalPage>
      <div className={`${pageShell} max-w-[960px] pb-20 pt-8 sm:pt-12`}>
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]"><Vote size={14} aria-hidden="true" /> Tu opinión cuenta</p>
        <h1 className="mt-2 text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.015em] text-[var(--nx-ink)]">Encuestas y debates</h1>
        <div className="mt-8 flex flex-col gap-4">
          {!loaded ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64" />)
          ) : polls.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--nx-line-strong)] px-6 py-14 text-center">
              <p className="text-base font-bold text-[var(--nx-ink)]">No hay votaciones abiertas en este momento.</p>
              <p className="mt-1 text-sm text-[var(--nx-muted)]">La redacción publica nuevas preguntas cada semana.</p>
            </div>
          ) : polls.map((p) => <PollBlock key={p.id} poll={p} hero={p.kind === 'debate'} />)}
        </div>
      </div>
    </PortalPage>
  )
}
