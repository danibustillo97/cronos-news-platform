'use client'

// Interacción del hincha (todo guardado en el navegador):
// - "Predice el marcador" en la previa; tras el final: "¡Acertaste!".
// - "¿Quién fue el mejor?" al terminar el partido.
// - "Racha del hincha": días seguidos visitando NEXUS.
// - Tarjeta para compartir un gol (imagen generada en el navegador).

import { useEffect, useState } from 'react'
import { Check, Flame, Minus, Plus, Share2, Trophy } from 'lucide-react'
import { RESULT_LABEL, evaluatePrediction, mvpCandidates, readMvp, readPredictions, saveMvp, savePrediction, touchStreak, type Prediction, type Streak } from '@/lib/fanPlay'
import { safeStorage } from '@/lib/players'
import type { MatchDetail } from '@/lib/matchCenter'
import type { Moment } from '@/lib/moments'

// ------------------------------------------------------- predice el marcador

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="max-w-full truncate text-[12px] font-semibold text-[var(--nx-ink-2)]">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={(e) => { e.stopPropagation(); onChange(Math.max(0, value - 1)) }} aria-label={`Menos goles para ${label}`} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--nx-surface-2)] text-[var(--nx-ink)] active:scale-90"><Minus size={16} /></button>
        <span className="w-8 text-center text-2xl font-bold tabular-nums text-[var(--nx-ink)]" aria-live="polite">{value}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onChange(Math.min(15, value + 1)) }} aria-label={`Más goles para ${label}`} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--nx-surface-2)] text-[var(--nx-ink)] active:scale-90"><Plus size={16} /></button>
      </div>
    </div>
  )
}

export function PredictScore({ matchId, home, away, final, locked = false, compact = false }: { matchId: string; home: string; away: string; final: { home: number; away: number } | null; locked?: boolean; compact?: boolean }) {
  const [saved, setSaved] = useState<Prediction | null>(null)
  const [editing, setEditing] = useState(false)
  const [h, setH] = useState(1)
  const [a, setA] = useState(0)
  useEffect(() => { setSaved(readPredictions(safeStorage())[matchId] ?? null) }, [matchId])

  if (locked && !saved) return null
  if (saved && !editing) {
    const result = final ? evaluatePrediction(saved, final) : null
    return (
      <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${result === 'exacto' ? 'bg-[#16A34A]/15' : result === 'resultado' ? 'bg-[#FACC15]/15' : 'bg-[var(--nx-surface-2)]'}`}>
        <span className="min-w-0 text-[13px] text-[var(--nx-ink-2)]">
          {result ? <strong className="text-[var(--nx-ink)]">{RESULT_LABEL[result]}</strong> : 'Tu pronóstico'}: <span className="font-bold tabular-nums text-[var(--nx-ink)]">{home} {saved.home}-{saved.away} {away}</span>
        </span>
        {!locked && <button type="button" onClick={(e) => { e.stopPropagation(); setH(saved.home); setA(saved.away); setEditing(true) }} className="min-h-[40px] shrink-0 text-[12px] font-semibold text-[var(--nx-accent-text)]">Cambiar</button>}
      </div>
    )
  }
  if (compact && !editing) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(true) }} className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--nx-line-strong)] text-[13px] font-semibold text-[var(--nx-ink)] active:scale-[0.99]">
        🎯 Predice el marcador
      </button>
    )
  }
  return (
    <div className="rounded-xl border border-[var(--nx-line)] p-3" onClick={(e) => e.stopPropagation()}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">🎯 Predice el marcador</p>
      <div className="flex items-center gap-2">
        <Stepper label={home} value={h} onChange={setH} />
        <span className="pt-5 text-lg font-bold text-[var(--nx-muted)]">-</span>
        <Stepper label={away} value={a} onChange={setA} />
      </div>
      <button type="button" onClick={() => { savePrediction(safeStorage(), matchId, h, a); setSaved({ home: h, away: a, at: new Date().toISOString() }); setEditing(false); try { navigator.vibrate?.(10) } catch { /* sin vibración */ } }}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#FACC15] text-sm font-bold text-black active:scale-[0.98]">
        <Check size={16} aria-hidden="true" /> Guardar pronóstico
      </button>
      <p className="mt-1.5 text-center text-[11px] text-[var(--nx-muted)]">Solo para divertirte: se guarda en este dispositivo.</p>
    </div>
  )
}

// ------------------------------------------------------ ¿quién fue el mejor?

export function BestPlayer({ detail }: { detail: MatchDetail }) {
  const [pick, setPick] = useState<string | null>(null)
  useEffect(() => { setPick(readMvp(safeStorage(), detail.id)) }, [detail.id])
  const goals = detail.events.filter((e) => (e.type === 'goal' || e.type === 'penalty-goal') && e.player).map((e) => e.player!.name)
  const assists = detail.events.filter((e) => (e.type === 'goal' || e.type === 'penalty-goal') && e.assist).map((e) => e.assist!.name)
  const starters = [...detail.lineups.home, ...detail.lineups.away].filter((p) => p.starter).map((p) => p.name)
  const candidates = mvpCandidates(goals, assists, starters)
  if (candidates.length < 2) return null
  return (
    <section aria-label="¿Quién fue el mejor?" className="mt-5 rounded-2xl border border-[var(--nx-line)] p-3">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[var(--nx-ink)]"><Trophy size={15} className="text-[var(--nx-accent-text)]" aria-hidden="true" /> ¿Quién fue el mejor?</p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((c) => (
          <button key={c} type="button" aria-pressed={pick === c} onClick={() => { saveMvp(safeStorage(), detail.id, c); setPick(c); try { navigator.vibrate?.(10) } catch { /* */ } }}
            className={`inline-flex min-h-[40px] items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors active:scale-95 ${pick === c ? 'bg-[#FACC15] text-black' : 'border border-[var(--nx-line)] text-[var(--nx-ink)]'}`}>
            {pick === c && <Check size={14} className="mr-1" aria-hidden="true" />}{c}
          </button>
        ))}
      </div>
      {pick && <p className="mt-2 text-[12px] text-[var(--nx-muted)]">Tu elección: <strong className="text-[var(--nx-ink-2)]">{pick}</strong> (guardada en este dispositivo).</p>}
    </section>
  )
}

// ------------------------------------------------------------ racha del hincha

export function StreakChip() {
  const [streak, setStreak] = useState<Streak | null>(null)
  useEffect(() => { setStreak(touchStreak(safeStorage())) }, [])
  if (!streak) return null
  return (
    <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-[#F97316]/15 px-3 text-[12px] font-bold text-[#F97316]" title={`Mejor racha: ${streak.best} días`}>
      <Flame size={14} aria-hidden="true" /> {streak.days === 1 ? 'Racha: 1 día' : `Racha de ${streak.days} días`}
    </span>
  )
}

// ------------------------------------------------ tarjeta para compartir un gol

function drawGoalCard(m: Moment): Promise<Blob | null> {
  const c = document.createElement('canvas')
  c.width = 1080
  c.height = 1350
  const g = c.getContext('2d')
  if (!g) return Promise.resolve(null)
  const grad = g.createLinearGradient(0, 0, 0, c.height)
  grad.addColorStop(0, '#1d1a06')
  grad.addColorStop(1, '#0a0a0a')
  g.fillStyle = grad
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#FACC15'
  // Rayo de NEXUS
  g.beginPath()
  const s = 3.2, ox = 80, oy = 70
  ;[[13, 2], [3, 14], [12, 14], [11, 22], [21, 10], [12, 10]].forEach(([x, y], i) => (i ? g.lineTo(ox + x * s, oy + y * s) : g.moveTo(ox + x * s, oy + y * s)))
  g.closePath(); g.fill()
  g.font = '800 44px system-ui, sans-serif'; g.textBaseline = 'middle'
  g.fillText('NEXUS', 170, 112)
  g.fillStyle = '#9a9a95'; g.font = '700 34px system-ui, sans-serif'
  g.fillText(m.leagueName.toUpperCase(), 80, 300)
  g.fillStyle = '#FACC15'; g.font = '900 120px system-ui, sans-serif'
  g.fillText('¡GOOOL!', 80, 440)
  g.fillStyle = '#f5f5f3'; g.font = '800 64px system-ui, sans-serif'
  g.fillText(m.player?.name ?? '', 80, 570, 920)
  g.fillStyle = '#9a9a95'; g.font = '600 40px system-ui, sans-serif'
  g.fillText(`Minuto ${m.minute}`, 80, 640)
  g.fillStyle = '#f5f5f3'; g.font = '800 56px system-ui, sans-serif'
  g.fillText(m.home.name, 80, 860, 700)
  g.fillText(m.away.name, 80, 960, 700)
  g.font = '900 96px system-ui, sans-serif'; g.textAlign = 'right'
  g.fillStyle = m.team === 'home' ? '#FACC15' : '#f5f5f3'; g.fillText(String(m.score.home), 1000, 860)
  g.fillStyle = m.team === 'away' ? '#FACC15' : '#f5f5f3'; g.fillText(String(m.score.away), 1000, 960)
  g.textAlign = 'left'; g.fillStyle = '#9a9a95'; g.font = '600 34px system-ui, sans-serif'
  g.fillText('nexusnews.info', 80, 1260)
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'))
}

export function ShareGoalButton({ moment }: { moment: Moment }) {
  const [busy, setBusy] = useState(false)
  const share = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const blob = await drawGoalCard(moment)
      if (!blob) return
      const file = new File([blob], `gol-${moment.player?.name ?? 'nexus'}.png`.replace(/\s+/g, '-'), { type: 'image/png' })
      const text = moment.headline || `¡Gol de ${moment.player?.name ?? ''}!`
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text })
      else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = file.name; a.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 2000)
      }
    } catch { /* cancelado */ } finally { setBusy(false) }
  }
  return (
    <button type="button" onClick={share} disabled={busy} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-[var(--nx-ink-2)] hover:bg-[var(--nx-surface-2)] disabled:opacity-60">
      <Share2 size={18} aria-hidden="true" /> {busy ? 'Creando…' : 'Compartir gol'}
    </button>
  )
}
