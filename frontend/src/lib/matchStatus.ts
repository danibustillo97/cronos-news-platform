// ESPN entrega el detalle de estado en inglés ("HT", "FT", "Halftime",
// "Scheduled", "63'"). Esto lo pasa a español sin inventar minutos.

const MAP: Record<string, string> = {
  ht: 'Entretiempo',
  halftime: 'Entretiempo',
  'half time': 'Entretiempo',
  ft: 'Final',
  'full time': 'Final',
  final: 'Final',
  aet: 'Final (prórroga)',
  'ft-pens': 'Final (penales)',
  pens: 'Penales',
  et: 'Prórroga',
  'extra time': 'Prórroga',
  scheduled: 'Programado',
  postponed: 'Aplazado',
  canceled: 'Cancelado',
  cancelled: 'Cancelado',
  suspended: 'Suspendido',
  abandoned: 'Abandonado',
  delayed: 'Demorado',
  'in progress': 'En juego',
  '1st half': 'Primer tiempo',
  '2nd half': 'Segundo tiempo',
}

export function localizeStatus(detail: string | null | undefined, fallback = 'En juego'): string {
  const raw = (detail ?? '').trim()
  if (!raw) return fallback
  const hit = MAP[raw.toLowerCase()]
  if (hit) return hit
  // Minutos ("63'", "90'+3'") se dejan tal cual.
  if (/^\d{1,3}'?(\+\d{1,2}'?)?$/.test(raw)) return raw.endsWith("'") ? raw : `${raw}'`
  return raw
}
