# NEXUS — Roadmap hacia la arquitectura objetivo

**Fecha:** 2026-09-15
**Estado:** propuesta, nada de esto está implementado todavía. Ver `docs/NEXUS_ARCHITECTURE_BASELINE.md` para la evidencia detrás de cada fase — este documento no repite el análisis, solo lo secuencia.
**Regla de todas las fases:** ninguna fase construye mocks, estados falsos, ni funcionalidad simulada. Si una fase no puede completarse con datos reales, la fase queda incompleta y documentada como tal — no se rellena con un placeholder.

---

## Por qué este orden

Tres restricciones reales, no arbitrarias, determinan la secuencia:

1. **No se puede construir Studio (editor visual) sin decidir primero qué pasa con Content/News**, porque el frontend legado tiene `NewsItem` como tipo raíz de ~9 engines — construir UI nueva sobre un tipo que se va a reemplazar duplica trabajo.
2. **No se puede construir Studio sin un caller real de Timeline/Safe Area**, porque hoy son piezas de dominio puras sin ningún endpoint — hay que probarlas contra HTTP real antes de construir una UI encima.
3. **Automation no se puede "limpiar" (deprecar el scraper viejo) hasta que exista una decisión de producto sobre ingestion** — es la única fase de esta lista que no la resuelve el código, la resuelve una decisión humana.

## Fase R1 — Decisión de ingestion (Automation)

**Qué resuelve:** el gap de §4/§6/§12 del baseline — dos pipelines de ingestion reales (`automation/main.py` en cron vs `lab/ingestion/run.py` testeado pero sin cron) sin ninguno reemplazando al otro.

**No es una fase de código.** Es una decisión: ¿se migra el cron de GitHub Actions a invocar `lab.ingestion.run` en vez de `main.py`? Antes de decidir, verificar en paralelo (sin apagar nada):

- Correr `lab.ingestion.run` contra las mismas ~54 fuentes que usa `main.py` durante un período de prueba, comparando cobertura/calidad real (no asumida).
- Confirmar que `lab/ingestion` cubre todos los casos que hoy cubre `src/scraper/sites/` (revisar caso por caso, no en bloque).

**Salida de la fase:** un ADR (Architecture Decision Record) corto en `automation/docs/` documentando la decisión y por qué — no se toca el cron todavía en esta fase, solo se decide.

**Gobierna:** `automation/.claude` — NEXUS no participa de esta decisión salvo como observador.

## Fase R2 — Cerrar el loop Timeline → Safe Area → Preview

**Qué resuelve:** §8/§10/§15.2 del baseline — el dominio Studio existe (`timeline/`, `safe_area.py`, `platform_preview.py`) pero cero llamadores.

Pasos concretos, en orden:

1. Wirear `GetPlatformPreview` y `QuickReel` a `container.py` (ya escritos, ya testeados — falta una línea de wiring cada uno).
2. Exponer `GET /api/compositions/{id}/platform-preview?platform=&format=` — el primer endpoint HTTP real de todo el dominio Timeline.
3. Diseñar el DTO de respuesta (`SequenceOut`/`TrackOut`/`TimelineShotOut`/`DistributionProfileOut`) recién en este punto — no antes, porque hasta ahora no había un consumidor real que dictara la forma correcta.
4. Construir la primera pantalla mínima de preview en el frontend: canvas del tamaño real del `DistributionProfile`, con las guías de `safe_area`/`ui_zones` dibujadas, reproduciendo los shots del `Sequence` en su timing real. Sin edición todavía — solo lectura/preview.

**Explícitamente fuera de esta fase:** cualquier capacidad de editar el Sequence desde la UI (eso es R4). Esta fase es "ver lo que ya existe", no "cambiarlo".

**Criterio de éxito real (no simulado):** abrir la pantalla de preview para una Composition ya `APPROVED` real (hay al menos una: story `ef8f48bdf9fd`) y ver su timeline real reproducido, con las guías de safe area del perfil real de TikTok o Instagram superpuestas.

## Fase R3 — Asset Resolution real

**Qué resuelve:** §7/§13.2 del baseline — `AssetRepository` es un puerto sin adaptor.

1. Adaptor Supabase real para `AssetRepository` (`list_for_story`, `save`) — mismo patrón que ya existe para `CategoryRepository`/`SiteSettingsRepository`.
2. Endpoint real de listado de assets por story (`GET /api/stories/{id}/assets`) — hoy `presentation/api/assets.py` solo sirve archivos de LAB por path, no es un Asset Manager real.
3. Recién con esto real, la UI de Studio (R4) puede ofrecer "elegir un asset existente" en vez de solo mostrar los que ya vinieron del pipeline automático.

**No incluye en esta fase:** regenerar assets, buscar por prompt, ni ningún flujo de creación — eso es una capacidad nueva de producto, no parte de cerrar este gap de infraestructura.

## Fase R4 — Studio UI progresivo (editor real)

**Depende de:** R2 (preview funcionando) y R3 (assets reales listables). No empezar antes.

Orden interno, cada paso usable independientemente (no un big-bang):

1. **Timeline de solo-lectura** con scrubber real (extensión directa de R2, ya con los datos reales en pantalla).
2. **Reordenar/recortar shots existentes** (usa `Story Reel`'s `ManualShotSpec`/`build_timeline_from_manual_shots`, ya implementado y testeado en el backend, sin caller) — la primera edición real, sin generar nada nuevo.
3. **QA real**: conectar `validate_elements` (Safe Area) contra las posiciones reales de overlays una vez que el editor las tenga — bloqueante antes de exportar, como pedía el roadmap original de P6.
4. **Export real**: publicar `final_asset_ref` directo a Distribution, sin pasar por grabación en vivo del navegador — esta es la condición que ya fijó `CRONOS - Render Architecture Decision.md` para poder retirar el Studio legado.

**Regla dura para toda la fase:** ningún paso de este editor genera contenido con IA en tiempo de edición — eso es responsabilidad de Production/LAB, corrido antes. Studio ensambla y ajusta lo que ya existe (mismo principio que ya sigue `QuickReel`: "sin IA" significa reglas deterministas sobre datos que ya están ahí).

## Fase R5 — Migración `NewsItem` → `Post`/`Content`

**Depende de:** R4 en curso o completo — no antes, para no reescribir el engine viejo dos veces (una para agregar el tipo genérico, otra para reemplazarlo por Studio nuevo).

1. Introducir `Post`/`ContentItem` como tipo genérico en el frontend (el backend ya tiene el mapeo conceptual documentado en `CRONOS - Domain Language Alignment.md` P2 — falta el discriminador `content_type`, que se agrega recién cuando exista el primer caso de uso real que lo necesite, ej. un tipo de POST con reglas de Studio distintas).
2. Migrar los ~9 engines/hooks identificados en el audit de frontend (§10 del baseline) de `NewsItem` a `Post`, empezando por los que ya se van a reescribir en R4 (evita tocar dos veces lo mismo).
3. `AdminNewsManager.tsx`/`AdminStoriesManager.tsx` (hablan directo a Supabase, bypasean el backend) — migrar a usar el backend real recién cuando se toquen por otra razón, no como trabajo aislado.

## Fase R6 — Retirar el Studio legado

**Condición de entrada (ya fijada, no inventada acá):** Distribution puede publicar `final_asset_ref` directo, y R4/R5 están completas.

1. Confirmar que ninguna publicación real depende ya de `frontend/src/studio/engines/{video,canvas,news}/`.
2. DEPRECATE → REMOVE recién con esa confirmación (no antes) — con evidencia real de que no rompe el único flujo de publicación que hoy funciona.

## Fase R7 — Distribution real multi-plataforma

**Depende de:** R4 (hay algo real que publicar) — puede empezar en paralelo a R5/R6 si hay capacidad.

1. Instagram/Facebook/YouTube: hoy solo tienen modelo de dominio (`Platform`, `Format`, perfiles de Safe Area ya sourced en P6) — cero integración de publicación real. Construir una por vez, empezando por la que tenga cuenta/credenciales reales disponibles para probar.
2. Cerrar el loop `DistributionPlan.mark_published` con la publicación real (hoy TikTok publica sin pasar por este método — corregir para que el estado del dominio refleje la realidad).

## Lo que este roadmap NO incluye a propósito

- **CRONOS Learning** (`obsidian-vault/CRONOS Learning.md`) — 100% diseño conceptual, cero código, sin caso de uso real todavía. No entra en ninguna fase hasta que exista uno.
- **Analytics** (última etapa del flujo objetivo) — depende de que Distribution real (R7) esté produciendo datos reales que analizar; no hay nada que construir antes de eso.
- **Rotación de credenciales expuestas** (`automation/.env` público en GitHub, riesgo #1 del baseline) — es una acción de seguridad urgente pero independiente de este roadmap de arquitectura; no bloquea ni depende de ninguna fase de arriba, debería resolverse en paralelo, ni bien el usuario lo priorice.

## Resumen de dependencias

```
R1 (decisión ingestion) ───────────────────────────────────────────→ [limpieza futura de Automation, fuera de este roadmap]

R2 (preview real) → R3 (assets reales) → R4 (Studio editor) ──┬──→ R5 (Post genérico) → R6 (retirar legado)
                                                                 └──→ R7 (multi-plataforma, paralelo posible)
```

R1 es independiente del resto (vive enteramente en Automation). R2→R3→R4 es la cadena crítica del objetivo "Studio como editor visual". R5/R6/R7 no pueden empezar en serio antes de que R4 tenga algo real funcionando.
