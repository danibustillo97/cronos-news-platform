'use client'

// Fila de partido reutilizable -- una sola fuente de verdad para cómo se
// ve un marcador en todo NEXUS (Pulse, de una sola línea muy compacta, y
// "list" para donde un partido necesita más aire, ej. una tabla
// destacada). Diferencia claramente LIVE / FINAL / PRÓXIMO -- nunca deja
// el estado perdido en una esquina. Nunca inventa un logo: si ESPN no lo
// entrega, usa un fallback tipográfico con la inicial del equipo.

import Image from 'next/image'
import type { Match } from '@/types/sports'

function formatKickoff(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(date)
  if (date.toDateString() === now.toDateString()) return `Hoy · ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `Mañana · ${time}`
  return `${new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(date)} · ${time}`
}

function TeamLogo({ src, name, size }: { src: string | null; name: string; size: number }) {
  if (src) {
    return <Image src={src} alt="" width={size} height={size} className="object-contain flex-shrink-0" />
  }
  return (
    <span
      className="flex-shrink-0 flex items-center justify-center rounded-full bg-white/10 text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  )
}

function StatusLabel({ match, isDark, compact = false }: { match: Match; isDark: boolean; compact?: boolean }) {
  if (match.status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#E30613] flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#E30613] animate-pulse" /> {match.statusDetail || 'EN VIVO'}
      </span>
    )
  }
  if (match.status === 'finished') {
    return <span className={`text-[10px] font-bold flex-shrink-0 ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>FINAL</span>
  }
  return (
    <span className={`text-[10px] font-bold flex-shrink-0 ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>
      {compact ? formatKickoff(match.date).split(' · ')[1] ?? formatKickoff(match.date) : formatKickoff(match.date)}
    </span>
  )
}

export default function MatchRow({ match, variant, isDark = true }: { match: Match; variant: 'ticker' | 'list'; isDark?: boolean }) {
  if (variant === 'ticker') {
    return (
      <div
        className="flex items-center gap-2 flex-shrink-0 px-3.5 border-l border-white/[0.08] whitespace-nowrap"
        role="listitem"
        aria-label={`${match.leagueName}: ${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}`}
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-500">{match.leagueName}</span>
        <TeamLogo src={match.homeLogo} name={match.homeTeam} size={14} />
        <span className="text-[11px] text-neutral-300">{match.homeTeam}</span>
        <span className="text-[11px] text-white font-bold">{match.homeScore}–{match.awayScore}</span>
        <span className="text-[11px] text-neutral-300">{match.awayTeam}</span>
        <TeamLogo src={match.awayLogo} name={match.awayTeam} size={14} />
        <StatusLabel match={match} isDark compact />
      </div>
    )
  }

  return (
    <div
      className={`flex items-center py-3 border-b ${isDark ? 'border-white/10' : 'border-[#E5E5E5]'}`}
      role="listitem"
      aria-label={`${match.leagueName}: ${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}`}
    >
      <span className={`text-[10px] font-bold uppercase tracking-[0.1em] w-24 flex-shrink-0 truncate ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>
        {match.leagueName}
      </span>
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        <span className={`truncate text-sm text-right ${isDark ? 'text-neutral-200' : 'text-[#161616]'}`}>{match.homeTeam}</span>
        <TeamLogo src={match.homeLogo} name={match.homeTeam} size={18} />
      </div>
      <span className={`font-bold px-3 text-sm flex-shrink-0 tabular-nums ${isDark ? 'text-white' : 'text-[#161616]'}`}>
        {match.homeScore}–{match.awayScore}
      </span>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <TeamLogo src={match.awayLogo} name={match.awayTeam} size={18} />
        <span className={`truncate text-sm ${isDark ? 'text-neutral-200' : 'text-[#161616]'}`}>{match.awayTeam}</span>
      </div>
      <div className="w-20 text-right flex-shrink-0">
        <StatusLabel match={match} isDark={isDark} />
      </div>
    </div>
  )
}
