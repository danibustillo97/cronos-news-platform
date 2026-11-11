// Tiempo de lectura estimado a partir del contenido real del artículo
// (conteo de palabras / 200 wpm) -- nunca un número inventado. Si no hay
// contenido todavía (solo excerpt), se estima sobre eso; sin ninguno de
// los dos, no se muestra nada (ver usos: siempre chequear > 0).
const WORDS_PER_MINUTE = 200

export function estimateReadMinutes(...texts: (string | null | undefined)[]): number {
  const combined = texts.filter(Boolean).join(' ').replace(/<[^>]*>/g, ' ')
  const words = combined.trim().split(/\s+/).filter(Boolean).length
  if (words === 0) return 0
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}
