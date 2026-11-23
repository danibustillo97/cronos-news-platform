# Editorial: rapidez para publicar y buscar información

Análisis de la experiencia del editorial (admin → Editorial) con un objetivo: que publicar
y encontrar información cueste los menos pasos y la menor espera posible.

## 1. Publicar una noticia propia (pestaña Noticias)

| | Antes | Ahora |
| --- | --- | --- |
| Empezar | Noticias → "Nueva" | `N`, o `Ctrl/⌘+K` → "Nueva noticia" desde cualquier pestaña |
| Escribir | Sin autoguardado; salir, cambiar de pestaña o de sección borraba el texto | Copia local continua con "Restaurar"; los borradores se autoguardan; aviso al salir |
| Imágenes | Base64 permitido (filas de megas); fotos de móvil de 5–12 MB | Pegar o arrastrar sube al storage; compresión en el navegador (≤ 2400 px, ~1 MB) |
| Documentarse | Fuera del editor | Panel **Buscar información**: enlazar noticias publicadas, citar fuentes descubiertas en el cursor |
| Enlace | Error crudo de Postgres si el slug existía | Aviso en vivo con alternativa libre (`/slug-2`) |
| Publicar | Botón | `Ctrl/⌘+Enter` (con confirmación), `Ctrl/⌘+S` guarda |
| Corregir después | Sin despublicar ni archivar; "Eliminar" borraba publicadas | Despublicar, archivar, restaurar; las publicadas no se borran |

## 2. Publicar con IA (Descubrir → Revisión → Publicar)

Antes, unos 10 pasos en 4 pestañas y una espera a ciegas:
Descubrir → seleccionar → "Procesar" → elegir proveedor → **esperar el cron (10–30 min) sin
aviso** → pestaña Editor → abrir el artículo → "Detalles y revisión" → Aprobar → Cola IA →
Publicar.

Ahora, unos 5:

1. "Procesar": con el proveedor recordado, un clic.
2. El worker de GitHub Actions arranca en segundos (`workflow_dispatch`), no en el próximo cron.
3. El aviso "Listo para revisar · Abrir" llega aunque estés en otra pestaña (contadores en vivo).
4. Revisar con autoguardado fiable (sin pérdidas, sin aprobar versiones viejas).
5. **"Aprobar y publicar ahora"**, con confirmación y enlace "Ver" a la noticia publicada.

Corregir un aprobado ya no exige publicarlo: "Revisión" lo devuelve a la bandeja.

## 3. Buscar información

| Dónde | Antes | Ahora |
| --- | --- | --- |
| Todo el editorial | -- | `Ctrl/⌘+K`: noticias (búsqueda en la base, sin tope), artículos en revisión o listos, noticias descubiertas (Enter abre el editor manual) y acciones |
| Lista de Noticias | Filtros en el navegador sobre 200 filas (los borradores podían desaparecer) | Filtros, búsqueda y paginación en la base de datos; contadores reales por estado; `/` enfoca la búsqueda |
| Descubrir | Sin buscador | Filtro por título, fuente o texto en Nuevas y Seleccionadas |
| Dentro del editor | -- | Panel "Buscar información" (Noticias y Revisión) |

Las pestañas se llaman ahora como las etapas: **Noticias · Descubrir · Revisión · Publicar**
(antes mezclaban "Editor", "Cola IA" y "Artifact").

## 4. Pendiente (no hecho en esta pasada)

- **Legibilidad**: buena parte de la interfaz usa textos de 8–10 px (`text-[9px]`,
  `text-[10px]`); conviene un mínimo de 12 px para trabajo prolongado.
- **Dos editores**: Noticias y Revisión resuelven lo mismo con pantallas distintas; a medio
  plazo, una sola pantalla de edición con el inspector de IA como panel opcional.
- **Pruebas en navegador**: los flujos se verificaron con tests de lógica; falta una batería
  E2E (Playwright) con una cuenta de prueba de Supabase.
