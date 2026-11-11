// La categoría real en `news` es texto libre e inconsistente entre
// pipelines de ingesta (p.ej. "deporte" en minúscula y "Fútbol" conviven
// como si fueran categorías distintas). Esto normaliza solo para
// AGRUPAR/DETECTAR, nunca para inventar una categoría que el artículo no
// tiene -- el valor mostrado en UI sigue siendo el original.

const SPORTS_KEYWORDS = ['deporte', 'fútbol', 'futbol', 'sport']

export function isSportsCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return SPORTS_KEYWORDS.some((kw) => normalized.includes(kw))
}
