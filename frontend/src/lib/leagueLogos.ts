// Logos de competiciones (CDN de ESPN, ya permitido en next.config) +
// fallback tipográfico. Los ids numéricos salen del propio ESPN
// (site.api.espn.com/.../{liga}/scoreboard -> leagues[0].logos) y cada URL
// se verificó (200 image/png, variantes 500 y 500-dark) el 2026-11-24.
// Una liga fuera del mapa NUNCA recibe un logo inventado: devuelve null y
// la UI pinta el monograma.

export const ESPN_LEAGUE_LOGO_IDS: Readonly<Record<string, number>> = {
  'col.1': 1543,
  'esp.1': 15,
  'eng.1': 23,
  'ita.1': 12,
  'ger.1': 10,
  'fra.1': 9,
  'uefa.champions': 2,
  'uefa.europa': 2310,
  'conmebol.libertadores': 58,
  'conmebol.sudamericana': 1208,
  'arg.1': 1,
  'bra.1': 85,
}

export const LEAGUE_LABELS: Readonly<Record<string, string>> = {
  'col.1': 'Liga BetPlay',
  'esp.1': 'LaLiga',
  'eng.1': 'Premier League',
  'ita.1': 'Serie A',
  'ger.1': 'Bundesliga',
  'fra.1': 'Ligue 1',
  'uefa.champions': 'Champions League',
  'uefa.europa': 'Europa League',
  'conmebol.libertadores': 'Libertadores',
  'conmebol.sudamericana': 'Sudamericana',
  'arg.1': 'Liga Argentina',
  'bra.1': 'Brasileirão',
}

/** `dark` = variante pensada para fondo oscuro. */
export function leagueLogoUrl(leagueId: string | null | undefined, dark = false): string | null {
  if (!leagueId) return null
  const id = ESPN_LEAGUE_LOGO_IDS[leagueId.trim().toLowerCase()]
  if (id === undefined) return null
  return `https://a.espncdn.com/i/leaguelogos/soccer/${dark ? '500-dark' : '500'}/${id}.png`
}

const STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'fc', 'cf', 'sc', 'ac', 'cd', 'club', 'y', 'and', 'the'])

/** "Atlético Nacional" -> "AN", "Millonarios" -> "MI", "" -> "?". */
export function monogram(name: string | null | undefined): string {
  const words = (name ?? '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const meaningful = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()))
  const pool = meaningful.length > 0 ? meaningful : words
  if (pool.length === 0) return '?'
  if (pool.length === 1) return pool[0].slice(0, 2).toUpperCase()
  return (pool[0][0] + pool[1][0]).toUpperCase()
}

/** Tono estable (0-359) para el fondo del monograma -- mismo nombre, mismo color. */
export function monogramHue(name: string | null | undefined): number {
  let hash = 0
  for (const ch of name ?? '') hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return hash % 360
}
