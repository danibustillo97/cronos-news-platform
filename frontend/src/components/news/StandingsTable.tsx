// Tabla de posiciones genérica y reutilizable -- no depende de una
// competición específica. Recibe las filas ya resueltas (ver
// StandingsPanel.tsx / studio/lab/api-client.ts para el fetch real a
// backend/app/presentation/api/sports.py::get_standings) y solo se
// encarga de renderizarlas. `full` decide si se muestran GF/GC además de
// DG/Pts (la vista embebida las omite para no saturar el espacio).
//
// La franja de color a la izquierda de cada fila (Champions/Europa/
// Descenso/etc.) es la nota real que ESPN asigna a esa posición en esa
// competición y temporada -- nunca un umbral de posición inventado por
// nosotros (el corte de clasificación cambia de formato entre ligas y
// entre temporadas). Si el proveedor no manda nota para una fila, no se
// dibuja franja -- nunca se inventa una.

export interface StandingsRow {
  rank: string
  team: string
  logo: string | null
  played: string
  won: string
  drawn: string
  lost: string
  points: string
  goalDifference: string | null
  goalsFor: string | null
  goalsAgainst: string | null
  noteColor?: string | null
  noteDescription?: string | null
}

export default function StandingsTable({
  table, isDark, full = true, limit,
}: {
  table: StandingsRow[]
  isDark: boolean
  full?: boolean
  limit?: number
}) {
  const rows = limit ? table.slice(0, limit) : table

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
    <table className="w-full text-xs min-w-[380px] border-separate border-spacing-0">
      <thead>
        <tr>
          <th className="w-1" />
          <th className={`text-left font-semibold uppercase tracking-[0.08em] text-[10px] pb-2.5 pl-3 border-b ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#EDEDED]'}`}>#</th>
          <th className={`text-left font-semibold uppercase tracking-[0.08em] text-[10px] pb-2.5 border-b ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#EDEDED]'}`}>Equipo</th>
          <th className={`text-right font-semibold uppercase tracking-[0.08em] text-[10px] pb-2.5 px-2 border-b ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#EDEDED]'}`}>PJ</th>
          {full && <th className={`text-right font-semibold uppercase tracking-[0.08em] text-[10px] pb-2.5 px-2 border-b hidden sm:table-cell ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#EDEDED]'}`}>GF</th>}
          {full && <th className={`text-right font-semibold uppercase tracking-[0.08em] text-[10px] pb-2.5 px-2 border-b hidden sm:table-cell ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#EDEDED]'}`}>GC</th>}
          <th className={`text-right font-semibold uppercase tracking-[0.08em] text-[10px] pb-2.5 px-2 border-b ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#EDEDED]'}`}>DG</th>
          <th className={`text-right font-semibold uppercase tracking-[0.08em] text-[10px] pb-2.5 pl-2 pr-3 border-b ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#EDEDED]'}`}>Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.rank}
            title={row.noteDescription ?? undefined}
            className={`group ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'} transition-colors`}
          >
            <td className={`w-1 ${isDark ? 'border-b border-white/5' : 'border-b border-[#F3F3F3]'}`}>
              <div className="w-1 h-full min-h-[36px]" style={{ backgroundColor: row.noteColor ?? 'transparent' }} />
            </td>
            <td className={`py-2.5 pl-3 font-semibold tabular-nums ${isDark ? 'text-neutral-400 border-b border-white/5' : 'text-[#999] border-b border-[#F3F3F3]'}`}>{row.rank}</td>
            <td className={`py-2.5 ${isDark ? 'border-b border-white/5' : 'border-b border-[#F3F3F3]'}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center overflow-hidden ${isDark ? 'bg-white/5' : 'bg-[#F5F5F5]'}`}>
                  {row.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.logo} alt="" className="w-4 h-4 object-contain" />
                  ) : (
                    <span className={`text-[9px] font-bold ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>{row.team.slice(0, 1)}</span>
                  )}
                </span>
                <span className={`truncate font-medium ${isDark ? 'text-neutral-200' : 'text-[#161616]'}`}>{row.team}</span>
              </div>
            </td>
            <td className={`py-2.5 px-2 text-right tabular-nums ${isDark ? 'text-neutral-400 border-b border-white/5' : 'text-[#666] border-b border-[#F3F3F3]'}`}>{row.played}</td>
            {full && <td className={`py-2.5 px-2 text-right tabular-nums hidden sm:table-cell ${isDark ? 'text-neutral-400 border-b border-white/5' : 'text-[#666] border-b border-[#F3F3F3]'}`}>{row.goalsFor ?? '—'}</td>}
            {full && <td className={`py-2.5 px-2 text-right tabular-nums hidden sm:table-cell ${isDark ? 'text-neutral-400 border-b border-white/5' : 'text-[#666] border-b border-[#F3F3F3]'}`}>{row.goalsAgainst ?? '—'}</td>}
            <td className={`py-2.5 px-2 text-right tabular-nums ${isDark ? 'text-neutral-400 border-b border-white/5' : 'text-[#666] border-b border-[#F3F3F3]'}`}>{row.goalDifference ?? '—'}</td>
            <td className={`py-2.5 pl-2 pr-3 text-right ${isDark ? 'border-b border-white/5' : 'border-b border-[#F3F3F3]'}`}>
              <span className={`inline-block min-w-[1.75rem] text-center font-black tabular-nums rounded ${isDark ? 'text-white' : 'text-[#161616]'}`}>{row.points}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}
