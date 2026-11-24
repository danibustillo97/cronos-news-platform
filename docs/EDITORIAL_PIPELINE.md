# Pipeline editorial (Vercel + GitHub Actions + Supabase)

## El tablero (Admin → Editorial)

Una sola pantalla, cinco columnas:

| Columna | Qué hay | Acción principal |
|---|---|---|
| **Entrantes** | Noticias nuevas del scraper | **Redactar** (abre el editor con el texto de la fuente) · **Con IA** · ✕ descartar |
| **Redactando** | Tus borradores y los que escribe la IA | Abrir · si la IA falló: Reintentar IA / Redactar yo |
| **Por revisar** | Con avisos, por aprobar y **listas para publicar** | Abrir → Aprobar → **Publicar** o **Programar** (en la misma barra) |
| **Programadas** | Se publican solas a su hora | Abrir → Cancelar programación |
| **Publicadas** | Últimas publicadas | Ver en el sitio |

**+ Nueva noticia** crea un borrador desde cero. **Buscar noticias** lanza el scraper al instante.
Endpoints: `GET /api/editorial/board`, `POST /api/editorial/items/{id}/write`, `POST /api/editorial/articles`.

## Dos modos, un interruptor

En el tablero: botón **"Manual / Automático (IA)"** (arriba a la derecha).

| | Manual (por defecto) | Automático (IA) |
|---|---|---|
| Trae noticias | ✅ cada 10 min | ✅ cada 10 min |
| Quién redacta | Tú, en el editor | La API de Anthropic, borradores |
| Publicar | Tú | Tú (nada se publica solo) |
| Costo | 0 | Tokens por borrador, con límite por pasada y por día |

Para encender el modo automático el backend verifica que `ANTHROPIC_API_KEY` funcione; si no, responde 409 con el motivo y el modo sigue apagado. Si la tabla `editorial_automation` no existe, el modo se considera **apagado** (nunca gasta por error).

## Flujo

```
scraper.yml (cada 10 min)
  1. automation/scraper.py ─────────► discovery_items (DISCOVERED)
       RSS/Atom → URL normalizada → dedupe → filtro de antigüedad
       → texto completo de la nota + og:image → categoría → scores
  2. automation/run_editorial_autopilot.py
       apagado  → no hace nada
       encendido→ mejores candidatas (frescas, completas, ≥ N caracteres, sin repetir historia)
                  → SELECT → SEND_TO_EDITORIAL → artículo IA → Revisión

Botón "Buscar"  → discovery_jobs (QUEUED) → discovery-processing.yml (mismo ingest, respeta "Detener")
Botón "Generar" → artifact_jobs (QUEUED)  → artifact-processing.yml (toma atómica, recupera jobs trabados)
Programar       → artifacts.scheduled_at  → scheduled-publications.yml → news (published)
```

## Configuración

### 1. Base de datos (una vez)
Supabase → SQL Editor → ejecutar `infrastructure/database/migrations/20261123_editorial_pipeline.sql`.

Después, pasar al tablero los borradores de la antigua pestaña "Noticias":
```bash
python automation/migrate_legacy_news.py          # simulación: muestra cuántos migraría
python automation/migrate_legacy_news.py --apply  # ejecuta (idempotente, no borra nada)
```

### 2. GitHub → Settings → Secrets and variables → Actions

**Secrets**

| Nombre | Para qué |
|---|---|
| `SUPABASE_URL` | Todos los workers |
| `SUPABASE_SECRET_KEY` | Todos los workers |
| `SCRAPER_SOURCES` | Feeds: `https://sitio/rss|Fútbol, https://otro/feed` |
| `ANTHROPIC_API_KEY` | Solo modo automático / botón "Generar" |

**Variables (opcionales)**

| Nombre | Defecto | Efecto |
|---|---|---|
| `SCRAPER_MAX_AGE_HOURS` | 48 | Descarta notas más viejas (0 = sin límite) |
| `SCRAPER_MAX_ITEMS_PER_SOURCE` | 15 | Notas nuevas máximas por feed y pasada |
| `SCRAPER_MAX_NEW_ITEMS` | 150 | Notas nuevas máximas por pasada |
| `SCRAPER_FETCH_FULL_TEXT` | 1 | 0 = solo el resumen del feed |
| `ANTHROPIC_MODEL` | el del adaptador | Modelo para redactar |

### 3. Vercel (backend)
`ANTHROPIC_API_KEY` también en el proyecto backend: lo usan la verificación al encender el modo y las sugerencias en vivo (SEO, claims). Ver `docs/DEPLOYMENT_BACKEND_VERCEL.md`.

## Comportamiento ante fallos

- Un feed caído **no** pone el run en rojo (queda como `::warning::`); solo falla si fallan **todos**.
- Si no se puede leer la página de la nota, se usa el texto del feed.
- Un artículo que falla no detiene a los demás; si el proveedor no está disponible, la pasada se detiene.
- Job de artículo en `RUNNING` > 15 min → `FAILED` con mensaje claro (no se re-cobra en silencio).
- El repo es público y sus logs también: los workers solo imprimen conteos y dominios.

## Verificar (antes y después de cada deploy)

```bash
python automation/verify_pipeline.py --backend https://<backend>.vercel.app --frontend https://<sitio>
```
Solo lectura. Revisa esquema, seguridad, frescura del scraper, feeds, backend (variables, rutas públicas, que admin exija login) y frontend (proxy `/api/*`, sitemap, login). En GitHub: **Actions → Verify Pipeline → Run workflow** (y corre solo cada día; variables `BACKEND_URL` y `FRONTEND_URL`).

## Probar el scraper sin escribir nada

```bash
python automation/scraper.py --dry-run --sources "https://feeds.bbci.co.uk/mundo/rss.xml|Internacional"
```
