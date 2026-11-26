// Graphics Engine catalogue: every on-air graphic with its screen LAYER, PRIORITY
// and default duration. Arbitration keeps the screen readable:
//  - "lower", "center" and "full" layers hold one graphic at a time (line-ups home+away
//    count as one group); "full" also clears center and lower;
//  - "bug" (scoreboard), "ticker" and "side" (ad) coexist with everything;
//  - an AUTOMATIC graphic never replaces a higher-priority one on its layer (it waits
//    and retries); the OPERATOR always can (force).

export type Layer = "bug" | "lower" | "center" | "full" | "ticker" | "side";
export interface CatalogEntry { label: string; layer: Layer; priority: number; seconds?: number; group?: string; data: string }

export const CATALOG: Record<string, CatalogEntry> = {
  pro: { label: "Marcador", layer: "bug", priority: 50, data: "Partido en vivo" },
  elite: { label: "Marcador elite", layer: "bug", priority: 50, data: "Partido en vivo" },
  compact: { label: "Marcador compacto", layer: "bug", priority: 50, data: "Partido en vivo" },
  editorial: { label: "Marcador editorial", layer: "bug", priority: 50, data: "Partido en vivo" },
  live: { label: "Marcador live", layer: "bug", priority: 50, data: "Partido en vivo" },
  cinta: { label: "Cinta informativa", layer: "ticker", priority: 20, data: "Marcadores + datos de la jornada" },
  ad: { label: "Publicidad", layer: "side", priority: 10, data: "Imágenes del operador" },
  "goal-pro": { label: "Gol", layer: "lower", priority: 100, seconds: 11, data: "Evento confirmado + ficha ESPN" },
  goal: { label: "Gol (clásico)", layer: "lower", priority: 95, seconds: 8, data: "Evento confirmado" },
  "goal-alert": { label: "Gol en otro partido", layer: "lower", priority: 80, seconds: 8, data: "Momentos ESPN" },
  var: { label: "VAR", layer: "lower", priority: 75, seconds: 6, data: "Evento" },
  card: { label: "Tarjeta", layer: "lower", priority: 70, seconds: 7, data: "Evento confirmado" },
  sub: { label: "Cambio", layer: "lower", priority: 60, seconds: 8, data: "Evento confirmado" },
  events: { label: "Último evento", layer: "lower", priority: 40, seconds: 6, data: "Eventos" },
  timeline: { label: "Cronología", layer: "lower", priority: 45, seconds: 15, data: "Eventos del partido" },
  lower: { label: "Rótulo", layer: "lower", priority: 30, data: "Operador" },
  dato: { label: "Dato", layer: "lower", priority: 30, seconds: 8, data: "Datos verificados" },
  "result-card": { label: "Resultado (descanso / final)", layer: "center", priority: 85, seconds: 20, data: "Resultado de la fuente" },
  "lineup-home": { label: "Alineación local", layer: "center", priority: 55, seconds: 20, group: "lineups", data: "Alineaciones ESPN" },
  "lineup-away": { label: "Alineación visitante", layer: "center", priority: 55, seconds: 20, group: "lineups", data: "Alineaciones ESPN" },
  player: { label: "Jugador destacado", layer: "center", priority: 55, seconds: 15, data: "Ficha y temporada ESPN" },
  stats: { label: "Estadísticas", layer: "center", priority: 50, seconds: 15, data: "Estadísticas ESPN" },
  standings: { label: "Tabla de posiciones", layer: "center", priority: 50, seconds: 25, data: "Clasificación ESPN" },
  duel: { label: "Comparativa de jugadores", layer: "center", priority: 50, seconds: 20, data: "Temporada ESPN" },
  "poll-result": { label: "Resultado de votación", layer: "center", priority: 45, seconds: 15, data: "Votos reales del portal" },
  prematch: { label: "Previa", layer: "center", priority: 45, data: "Forma y datos ESPN" },
  poll: { label: "Encuesta en vivo", layer: "center", priority: 40, data: "Votos reales del portal" },
  multi: { label: "Multipantalla", layer: "center", priority: 35, data: "Marcadores ESPN" },
  recap: { label: "Programa automático", layer: "full", priority: 90, data: "Jornada ESPN" },
};

export const entryOf = (variant: string): CatalogEntry => CATALOG[variant] ?? { label: variant, layer: "center", priority: 40, data: "—" };

export interface Arbitration { evict: string[]; blocked: boolean; blocker?: string }

/** Which graphics leave when `incoming` enters; `blocked` when an automatic graphic would hide a more important one. */
export function arbitrate(onAir: { id: string; variant?: string }[], incoming: string, force: boolean): Arbitration {
  const inc = entryOf(incoming);
  const exclusive = (l: Layer) => l === "lower" || l === "center" || l === "full";
  const clashes = onAir.filter((g) => {
    if (!g.variant) return false;
    const e = entryOf(g.variant);
    if (g.variant === incoming) return true; // same graphic is replaced by the new one
    if (inc.group && e.group === inc.group) return false;
    if (inc.layer === "full") return exclusive(e.layer);
    if (e.layer === "full") return exclusive(inc.layer);
    return exclusive(inc.layer) && e.layer === inc.layer;
  });
  const blocker = clashes.find((g) => g.variant !== incoming && entryOf(g.variant!).priority > inc.priority);
  if (blocker && !force) return { evict: [], blocked: true, blocker: blocker.variant };
  return { evict: clashes.map((g) => g.id), blocked: false };
}
