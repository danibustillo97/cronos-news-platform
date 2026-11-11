'use client'

// Tabla de posiciones real -- fetch en vivo al proxy ESPN
// (backend/app/presentation/api/sports.py). La vista embebida muestra un
// resumen legible (nunca corta la tabla en silencio); "Ver tabla
// completa" abre un diálogo con TODOS los puestos que el provider
// entrega, usando los mismos datos ya obtenidos -- no dispara una
// segunda request.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trophy, X } from 'lucide-react'
import { apiUrl } from '@/studio/lab/api-client'
import { usePortalTheme } from '@/context/ThemeContext'
import { FOOTBALL_LEAGUES } from '@/lib/sportsLeagues'
import StandingsTable, { type StandingsRow } from '@/components/news/StandingsTable'

const TABS = FOOTBALL_LEAGUES
const VISIBLE_ROWS = 8

export default function StandingsPanel() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
  const [active, setActive] = useState(TABS[0].id)
  const [table, setTable] = useState<StandingsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showFull, setShowFull] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(apiUrl(`/api/sports/standings?league=${active}`))
      .then((res) => (res.ok ? res.json() : { table: [] }))
      .then((data) => { if (!cancelled) setTable(data.table || []) })
      .catch(() => { if (!cancelled) setTable([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [active])

  useEffect(() => {
    if (!showFull) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowFull(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showFull])

  const activeLabel = TABS.find((t) => t.id === active)?.label ?? ''

  return (
    <div className={`border p-5 ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-[#E5E5E5]'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-bold flex items-center gap-2 text-xs uppercase tracking-[0.1em] ${isDark ? 'text-white' : 'text-[#161616]'}`}>
          <Trophy size={13} className="text-[#E30613]" aria-hidden="true" /> Tablas en vivo
        </h3>
      </div>

      <div
        role="tablist"
        aria-label="Competición"
        className="flex gap-1 mb-4 border-b pb-2 overflow-x-auto scrollbar-hide"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E5E5' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-2 py-1 text-[11px] font-bold whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E30613] ${
              active === tab.id
                ? 'bg-[#E30613] text-white'
                : isDark ? 'text-neutral-400 hover:text-white' : 'text-[#666] hover:text-[#161616]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-neutral-500">Cargando...</div>
      ) : table.length === 0 ? (
        <div className="py-6 text-center text-xs text-neutral-500">No disponible por ahora.</div>
      ) : (
        <>
          <StandingsTable table={table} isDark={isDark} full={false} limit={VISIBLE_ROWS} />
          <div className="mt-3 flex items-center gap-4">
            {table.length > VISIBLE_ROWS && (
              <button
                onClick={() => setShowFull(true)}
                className="text-xs font-bold text-[#E30613] hover:opacity-70 transition-opacity"
              >
                Ver tabla completa →
              </button>
            )}
            <Link
              href={`/deportes/futbol/tabla?league=${active}`}
              className={`text-xs font-bold hover:opacity-70 transition-opacity ${isDark ? 'text-neutral-400' : 'text-[#666]'}`}
            >
              Ir al hub de fútbol →
            </Link>
          </div>
        </>
      )}

      {showFull && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Tabla completa de ${activeLabel}`}
          onClick={() => setShowFull(false)}
        >
          <div className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-black/40'}`} />
          <div
            className={`relative w-full max-w-md max-h-[80vh] overflow-y-auto p-5 ${isDark ? 'bg-[#0B0B0B] border border-white/10' : 'bg-white border border-[#E5E5E5]'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold text-sm uppercase tracking-[0.1em] ${isDark ? 'text-white' : 'text-[#161616]'}`}>{activeLabel}</h3>
              <button
                onClick={() => setShowFull(false)}
                aria-label="Cerrar"
                className={`p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E30613] ${isDark ? 'text-neutral-400 hover:text-white' : 'text-[#666] hover:text-[#161616]'}`}
              >
                <X size={18} />
              </button>
            </div>
            <StandingsTable table={table} isDark={isDark} full />
          </div>
        </div>
      )}
    </div>
  )
}
