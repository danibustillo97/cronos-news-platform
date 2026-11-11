// Espejo real de backend/app/presentation/api/sports.py -- LEAGUE_NAMES /
// _STANDINGS_TABS. Única fuente en el frontend para no duplicar esta
// lista en cada componente/página que necesite el selector de ligas.
// Si el backend agrega una liga nueva, agregarla acá también (no hay
// endpoint que la derive dinámicamente salvo /api/sports/standings/leagues,
// que devuelve lo mismo pero exige un fetch extra solo para pintar un
// toolbar que casi nunca cambia).

export interface League {
  id: string
  label: string
}

// Mismo orden que _STANDINGS_TABS: copas continentales primero, ligas
// locales después.
export const FOOTBALL_LEAGUES: League[] = [
  { id: 'uefa.champions', label: 'Champions' },
  { id: 'conmebol.libertadores', label: 'Libertadores' },
  { id: 'conmebol.sudamericana', label: 'Sudamericana' },
  { id: 'col.1', label: 'Liga BetPlay' },
  { id: 'eng.1', label: 'Premier League' },
  { id: 'esp.1', label: 'La Liga' },
  { id: 'ita.1', label: 'Serie A' },
  { id: 'ger.1', label: 'Bundesliga' },
]

export const DEFAULT_LEAGUE = 'col.1'

// Deportes sin integración de datos en backend todavía -- section 8 del
// brief pide que la arquitectura esté preparada para extenderse, pero
// sin inventar datos que no existen. Cada uno resuelve a una página
// "Próximamente" real y clara (app/deportes/[sport]/page.tsx), nunca a
// un link muerto ni a una tabla con datos falsos.
export const OTHER_SPORTS: { id: string; label: string }[] = [
  { id: 'baloncesto', label: 'Baloncesto' },
  { id: 'tenis', label: 'Tenis' },
  { id: 'f1', label: 'Fórmula 1' },
]
