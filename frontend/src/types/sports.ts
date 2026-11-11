// Espejo real de lo que devuelve backend/app/presentation/api/sports.py --
// nunca se inventa un campo que el provider (ESPN, vía ese proxy) no
// entrega. `homeLogo`/`awayLogo`/`venue` pueden venir null si ESPN no los
// tiene para ese equipo/partido -- se maneja como fallback, nunca se
// fabrica un logo.
export interface Match {
  id: string
  league: string
  leagueName: string
  homeTeam: string
  awayTeam: string
  homeLogo: string | null
  awayLogo: string | null
  homeScore: number
  awayScore: number
  status: 'live' | 'finished' | 'scheduled'
  statusDetail: string
  date: string | null
  venue: string | null
}
