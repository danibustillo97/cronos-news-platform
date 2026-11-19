// Registro de las experiencias editoriales que componen el Home -- no
// contenido, solo METADATA de qué existe y por qué. Agregar una
// experiencia nueva (País, Mundo, Economía, Cultura, Tecnología...) es
// sumar una entrada acá con su propio filtro sobre datos reales, nunca
// reescribir ModernNewsPortal.tsx ni inventar contenido para llenarla.
// El único requisito real: la experiencia debe poder autoocultarse
// cuando no hay datos reales que mostrar (mismo patrón que Voces/Ciudad).

export interface HomeSectionConfig {
  id: string
  title: string
  editorialQuestion: string
  // Qué decide si la sección existe hoy -- documentación, no código
  // ejecutable: cada componente real implementa su propia condición de
  // visibilidad (ver el comentario de cabecera de cada uno).
  dataSource: string
  status: 'live' | 'planned'
}

export const HOME_SECTIONS: HomeSectionConfig[] = [
  { id: 'ahora', title: 'Ahora', editorialQuestion: '¿Qué está pasando?', dataSource: 'news reciente + scoreboard (LiveSlot)', status: 'live' },
  { id: 'sports-pulse', title: 'Sports Pulse', editorialQuestion: '¿Qué está pasando en el deporte?', dataSource: 'scoreboard + standings + news deportivas', status: 'live' },
  { id: 'actualidad', title: 'Actualidad', editorialQuestion: '¿Qué necesito saber?', dataSource: 'categorías reales por volumen (CategorySections)', status: 'live' },
  { id: 'historias', title: 'Historias', editorialQuestion: '¿Qué vale la pena profundizar?', dataSource: 'news.content_format (InContext)', status: 'live' },
  { id: 'ciudad', title: 'Ciudad', editorialQuestion: '¿Qué está pasando cerca?', dataSource: 'ubicación real por IP + coincidencia de texto (NearYou)', status: 'live' },
  { id: 'voces', title: 'Voces', editorialQuestion: '¿Qué están diciendo/analizando?', dataSource: 'posts con media.audioUrl real (VoicesRail) -- ninguno todavía', status: 'live' },
  { id: 'creadores', title: 'Creadores contando el día', editorialQuestion: '¿Quién lo está contando?', dataSource: 'news.author real (CreatorSpotlight)', status: 'live' },
  // Ejemplos de próximas experiencias -- ninguna implementada todavía
  // porque requieren una señal real que hoy no existe (país/región por
  // artículo, o volumen real suficiente en esa categoría específica).
  { id: 'pais', title: 'País', editorialQuestion: '¿Qué pasa a nivel nacional?', dataSource: 'requiere tag de país real por artículo (no existe hoy)', status: 'planned' },
  { id: 'mundo', title: 'Mundo', editorialQuestion: '¿Qué pasa afuera?', dataSource: 'requiere tag de región real por artículo (no existe hoy)', status: 'planned' },
  { id: 'economia', title: 'Economía', editorialQuestion: '¿Qué mueve el mercado?', dataSource: 'categoría real "Economía" con volumen suficiente', status: 'planned' },
  { id: 'cultura', title: 'Cultura', editorialQuestion: '¿Qué se está viendo/leyendo/escuchando?', dataSource: 'categoría real "Cultura" con volumen suficiente', status: 'planned' },
  { id: 'tecnologia', title: 'Tecnología', editorialQuestion: '¿Qué está cambiando?', dataSource: 'categoría real "Tecnología" con volumen suficiente', status: 'planned' },
]
