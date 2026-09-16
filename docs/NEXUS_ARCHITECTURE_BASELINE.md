# NEXUS — Architecture Baseline

**Fecha:** 2026-09-15
**Alcance:** auditoría de código existente, sin cambios funcionales. Ningún archivo de `backend/`, `frontend/`, `automation/` o `infrastructure/` fue modificado para producir este documento.
**Método:** lectura directa de código + tests + documentación existente (`obsidian-vault/`, `automation/docs/`), no inferencia. Cuando algo no pudo verificarse en código, se marca explícitamente como tal.

---

## 1. Current Architecture

NEXUS hoy son **dos repos git nested, deliberadamente no fusionados**, físicamente consolidados el 2026-09-15 (ver `obsidian-vault/Roadmap.md` P0 y los commits de esa fecha):

```
Desktop/NEXUS/                    (repo git propio, .claude propio)
├── backend/     FastAPI + DDD, 8000, venv nativo
├── frontend/    Next.js 15 + React 19, 3000, npm nativo
├── infrastructure/
│   ├── database/   SQL de Supabase (schema + parches incrementales)
│   ├── docker/      docker-compose.yml — SOLO nginx (80)
│   └── scripts/     migrate-workspace.ps1 (deprecado, ya ejecutado)
├── obsidian-vault/  documentación (parcialmente desactualizada, ver §13)
├── nexus.ps1        CLI de orquestación (up/down/status/logs/doctor/ps)
└── automation/      (repo git propio, .claude propio — antes RPA_NEWS_SCRIPT)
    ├── src/, main.py, script.py    scraper legado, sin venv, corre por GH Actions cron
    ├── lab/                         LAB — planners determinísticos + CLI, sin daemon
    └── runtime/                     Local Runtime — FastAPI puente, 8801, venv nativo
```

Nada de esto está contenedorizado salvo nginx — decisión explícita (ver `infrastructure/docker/docker-compose.yml`: containerizar un dev server de Next.js o un uvicorn `--reload` en Windows/WSL2 cuesta velocidad de hot-reload sin beneficio real en local).

**Lo que funciona de punta a punta, verificado con `nexus.ps1 status` real (no supuesto):**

| Servicio | Estado real | Evidencia |
|---|---|---|
| Backend | ONLINE | `/health` responde, 79 tests pasan |
| Frontend | ONLINE | sirve contenido real, incluye tipos de contenido reales (ej. "Noirs Virals") |
| Local Runtime | ONLINE (CONNECTED) | `/status` reporta 14 capabilities reales |
| LAB | READY | `lab.cli status` corre y devuelve conteos reales (16 ingested / 4 ready for review) |
| Database (Supabase) | ONLINE | round-trip real vía `/api/categories` |
| Nginx | ONLINE | proxy real hacia los 3 servicios de arriba |

**Lo que NO funciona todavía (verificado, no supuesto):**

- El pipeline narrativo completo (`ProduceStory`, 9 capabilities de LAB orquestadas) produce `Composition.content.shots` reales, pero **nada en el frontend consume `Sequence`/`Timeline`/`Safe Area`** — cero UI de timeline hoy.
- La única publicación real a una red social (TikTok) pasa por el Studio legado Canvas2D+MediaRecorder (`frontend/src/studio/engines/video/`), no por LAB/Assembly.
- `lab/ingestion/` (nuevo, testeado) y `automation/src/main.py` (legado, en cron real) son **dos pipelines de ingestion que no se comunican entre sí** — el cron de producción sigue corriendo el viejo.

## 2. Target Architecture

La jerarquía objetivo, tal como la definió el usuario:

```
NEXUS
├── Automation   (RPA, Scrapers, Crawlers, Workers, Jobs, Ingestion, LAB)
├── Content      (News, History, Documentary, Story, Opinion, Data, Social)
├── Production   (Editorial Intelligence, Content Processing, Asset Resolution, Validation, Ready Pipeline)
├── Studio       (Timeline, Composition, Preview, Safe Area, Animation, Render, QA, Export)
└── Distribution (TikTok, Instagram, Facebook, YouTube)
```

Flujo: `AUTOMATION → RAW CONTENT → CONTENT → PRODUCTION → READY → STUDIO → COMPOSITION → DISTRIBUTION → PUBLISH → ANALYTICS`.

**Traducción honesta a lo que existe hoy** (ver §3 para el detalle bounded-context por bounded-context):

| Capa objetivo | Dónde vive hoy | Completitud |
|---|---|---|
| Automation | `automation/` (repo separado, correcto) | Ingestion duplicada sin resolver (§10) |
| Content | `backend/app/domain/news/` + `story/` | Acoplado a "noticia deportiva", sin discriminador de tipo (§6) |
| Production | `backend/app/application/use_cases/produce_story.py` + `backend/app/domain/intelligence/` | Real, orquesta LAB, pero sin Asset Resolution real (§10) |
| Studio | `backend/app/domain/timeline/` + `distribution/safe_area.py` (dominio) — **sin UI** | Dominio completo y testeado, cero consumidor visual |
| Distribution | `backend/app/domain/distribution/` + Studio legado (Canvas2D→TikTok) | Dos rutas paralelas sin unificar (ver `CRONOS - Render Architecture Decision.md`) |

## 3. Bounded Contexts

Backend (`backend/app/domain/`), 11 contextos reales (no aspiracionales — todos con entidades + al menos un test):

| Contexto | Responsabilidad | Máquina de estados |
|---|---|---|
| `news` | Ingestión editorial cruda | `NewsStatus`: INGESTED → NORMALIZED → ARCHIVED |
| `story` | Unidad editorial (= "POST" conceptualmente, ver `CRONOS - Domain Language Alignment.md`) | `StoryStatus`: DISCOVERED → IN_PRODUCTION → PRODUCED → PUBLISHED |
| `production` | Ejecución del pipeline LAB para una Story | estado propio en `Production` entity |
| `composition` | Pieza de salida concreta (un Reel, un Artículo...) | `CompositionStatus`: DRAFT → READY_FOR_REVIEW → APPROVED / REJECTED |
| `distribution` | Un intento de publicación (composition × platform) | `DistributionStatus`: NOT_CONNECTED → READY → PENDING → PUBLISHED / FAILED |
| `intelligence` | Value objects de solo-lectura de cada capability de LAB | sin estado propio (espejo de LAB) |
| `asset` | Recurso multimedia | `AssetType` ampliado, **sin repositorio real** (§13) |
| `category` | Taxonomía (grupos→categorías→topics) | sin estado, es un árbol |
| `timeline` | Sequence/Track/TimelineShot/Transform/Transition | sin estado, es un modelo declarativo puro |
| `settings` | Config global singleton (SEO) | sin estado |
| `shared` | IDs, errores de dominio | — |

Automation/LAB (`automation/lab/`), organizado por capability, no por contexto DDD clásico — cada carpeta (`editorial/`, `narrative/`, `audio/`, `media/`, `sequence/`, `animation/`, `render/`, `assembly/`, `export/`, `ingestion/`) es un planner (a veces +executor) con su propio artifact JSON de salida. `lab/core/` tiene su propia máquina de estados de workspace: `INGESTED → PROCESSING → READY_FOR_REVIEW → APPROVED → EXPORTED` (rama `REJECTED`) — **paralela y NO sincronizada** con `StoryStatus`/`CompositionStatus` del backend (dos máquinas de estado para conceptos relacionados, unidas solo por convención de nombre de campo, nunca por código compartido — correcto por el aislamiento Automation/NEXUS, pero hay que tenerlo presente al debuggear).

## 4. Data Flow

Dos flujos reales y distintos, no uno solo:

**Flujo A — Producción narrativa completa (`ProduceStory`):**
```
Story (PRODUCED trigger) → Local Runtime (:8801) → LAB (9 capabilities vía skills/CLI)
  → story_intelligence (Supabase, en vivo) + lab/workspace/exports/<id>/ (disco, al final)
  → backend lee vía CompositeLabReader (Supabase primero, disco como fallback)
  → Composition.content.shots (join AssemblyResult × MediaPlan por scene_id)
  → [SIN CONSUMIDOR] Timeline.Sequence / Safe Area / Platform Preview
```

**Flujo B — Publicación manual real (el único que llega a una red social hoy):**
```
Story → Composition (aprobada) → botón "Editar" en CompositionWorkspace.tsx
  → Studio legado (Canvas2D + MediaRecorder, useStudio.ts, NewsItem-typed)
  → grabación .webm de duración fija (5.5s)
  → TikTok OAuth+PKCE (frontend/src/studio/engines/tiktok/) → publicado
```

Estos dos flujos **no convergen**. El Flujo A produce datos ricos (shots, timing, assets) que el Flujo B ignora por completo.

**Flujo C — Ingestion (dos rutas paralelas, ninguna reemplaza a la otra):**
```
C1 (producción real, cron cada 15 min): automation/main.py → scrapea ~54 fuentes → tabla `news` (Supabase)
C2 (nuevo, testeado, NO conectado a ningún cron): lab/ingestion/run.py → workspace local LAB (INGESTED)
```

## 5. Service Boundaries

| Servicio | Puerto | Runtime | Cruza el boundary Automation/NEXUS vía |
|---|---|---|---|
| Frontend | 3000 | nativo (npm) | `apiUrl()` → backend (parcial, ver §8) |
| Backend | 8000 | nativo (venv) | HTTP a Local Runtime (8801); lectura de disco a `automation/lab/workspace/exports/` |
| Local Runtime | 8801 | nativo (venv, en `automation/`) | único puente autorizado hacia LAB — el backend nunca ejecuta LAB directamente |
| LAB | — (sin daemon) | CLI invocado por skills de Claude Code o por el Runtime | ninguno — solo lee/escribe sus propios artifacts |
| Nginx | 80 | Docker | reverse proxy — no cruza boundaries de dominio, solo de red |

Regla real ya respetada en código (no aspiracional): **el backend nunca importa nada de `automation/`** — todo el acceso es HTTP (Runtime) o lectura de archivos JSON planos (`export_reader.py`). Esto es exactamente el aislamiento que pedía `CRONOS - Tres Universos.md` ("Architecture no depende conceptualmente de Learning" generalizado a "NEXUS no depende de código interno de Automation").

### Los dos `.claude` (verificado, ambos existen)

| | `NEXUS/.claude/` | `NEXUS/automation/.claude/` |
|---|---|---|
| Contenido real hoy | solo `scheduled_tasks.lock` — sin comandos/skills propios todavía | 8 comandos + 12 skills reales, todas sobre LAB (`lab-assembly`, `lab-audio-direction`, `lab-narrative-direction`, `lab-production-export`, `lab-render-planning`, `lab-sequence-planning`, `lab-animation-planning`, `lab-editorial-*`) |
| Responsabilidad | arquitectura global, backend, frontend, Production, Studio, Distribution — la plataforma completa | RPA, scraping, crawling, ingestion, workers, jobs, LAB — nunca decide nada de Composition/Distribution |
| Regla | nunca asume que gobierna `automation/` — cruza el boundary solo vía HTTP (Runtime) | nunca asume que gobierna NEXUS — no tiene ninguna skill que toque `backend/`/`frontend/` |

Ninguno de los dos se fusiona. `NEXUS/.claude` está notablemente menos desarrollado que su contraparte de Automation — no es un problema de arquitectura, pero vale la pena que el equipo de plataforma le dé el mismo tratamiento de skills/comandos que ya tiene Automation, si el flujo de trabajo lo justifica.

## 6. Automation Boundary

**Responsabilidad real hoy:** traer y preparar información de entrada — coincide con lo pedido ("su responsabilidad termina principalmente en traer/procesar información de entrada"). Automation NO conoce Composition, Distribution, ni Timeline — correcto.

**Violación real encontrada:** ninguna. Automation no intenta ser editor visual ni tomar decisiones de publicación — se mantiene en su carril.

**Deuda real:** dos pipelines de ingestion (§4, Flujo C) sin decisión tomada sobre cuál es la fuente de verdad. Esto no es un problema de boundary (ambos viven correctamente dentro de Automation) sino de **falta de decisión de producto** — no es algo que el código resuelva solo.

## 7. Production Boundary

**Responsabilidad real hoy:** `ProduceStory` orquesta 9 capabilities de LAB (editorial→narrative→audio→media→sequence→animation→render→assembly) y las persiste como value objects tipados — coincide con "Editorial Intelligence, Content Processing" del target.

**Falta real (no un boundary violado, un componente faltante):** "Asset Resolution" del target no existe como pieza real — `AssetRepository` (puerto) no tiene adaptor Supabase (confirmado: cero implementación en `infrastructure/persistence/supabase/`). Hoy los assets llegan ya resueltos dentro de `CompositionShot.asset_refs` (vía el join de P4), pero no hay forma de **consultar o gestionar** Assets como entidad propia.

**"Validation"** existe parcialmente: Safe Area (`backend/app/domain/distribution/safe_area.py`) es una validación real, pura, testeada — pero sin caller (§10).

**Regla respetada:** Production no es un editor visual — `CompositionWorkspace.tsx` es literalmente un card de aprobar/rechazar, con el comentario propio en el código *"No permanent toolbar, no timeline"*. Correcto, no violar esto al construir Studio.

## 8. Studio Boundary

**Esto es lo menos maduro de las 5 capas del target.** Dos "Studios" coexisten sin relación:

1. **Studio-dominio** (backend, nuevo): `Sequence`/`Track`/`TimelineShot`/`Transform`/`Transition` (`timeline/`), `DistributionProfile`/`validate_elements` (Safe Area), `GetPlatformPreview`. Completo conceptualmente, testeado (18 tests entre los tres), **sin ningún endpoint expuesto ni consumidor**.
2. **Studio-legado** (frontend): Canvas2D + `MediaRecorder`, tipado 100% sobre `NewsItem` (no `Post`/`Content` genérico), congelado por decisión ya documentada (`CRONOS - Render Architecture Decision.md`) — es la única vía de publicación que funciona, no se puede apagar todavía.

**Cero overlap entre los dos** — no hay ningún punto del código donde el Studio legado lea o escriba algo del dominio Timeline nuevo. Construir el Studio nuevo significa, en la práctica, escribir una UI de cero que consuma el dominio ya real, sin heredar nada del Canvas2D salvo quizás `engines/audio/` (TTS genérico, sin acoplamiento a `NewsItem`, reusable tal cual según el audit de frontend).

**Frontera Editorial → Published Content → Studio (establecida, no consumida todavía):** el flujo editorial (Discovery → Artifact → Ready → Publish) es un dominio completamente separado de Studio y no debe integrarse con él — Studio empieza DESPUÉS de Publish, nunca antes. `PublishArtifact` ya escribe filas reales en la tabla `news` pre-existente (la misma que el scraper legado); ese estado publicado ahora tiene un contrato de lectura formal y explícito: `app/domain/publication/entities.py::PublishedContent` + `GET /api/published-content`, `GET /api/published-content/{id}`, `GET /api/published-content/by-slug/{slug}` (read-only, sin escritura propia). Es la identidad estable (`news.id`) que un futuro consumidor (Studio, o cualquier proceso audiovisual/derivado sobre contenido ya publicado) puede usar sin conocer Story/Artifact/DiscoveryItem. El Studio legado sigue leyendo `news` directo de Supabase (`studio/engines/news/news.engine.ts`) — deliberadamente NO migrado a este contrato en esta fase, para no acoplar ni reconstruir Studio prematuramente; migrarlo a `/api/published-content` es trabajo futuro, no de esta fase.

## 9. Distribution Boundary

`backend/app/domain/distribution/` es real: `Platform` (WEB/TIKTOK/INSTAGRAM/FACEBOOK/YOUTUBE), `Format`, `DistributionPlan` con máquina de estados, `PrepareDistribution` use case ya wireado y con endpoint. Safe Area vive correctamente en este contexto (`distribution/safe_area.py`), no en Studio — decisión ya documentada y correcta (el perfil de safe area es una propiedad de la plataforma destino, no del editor).

**Gap real:** `PrepareDistribution` prepara el plan pero la publicación efectiva a TikTok ocurre por un camino completamente distinto (frontend, OAuth directo, sin pasar por `DistributionPlan.mark_published`). Instagram/Facebook/YouTube no tienen ninguna integración real todavía — solo el modelo de dominio.

## 10. Existing Components

Inventario de lo que existe y corre de verdad hoy (no diseño, no aspiracional):

- **Backend**: 11 bounded contexts, 13 use cases (`application/use_cases/`), 8 routers API, 79 tests. Persistencia real en Supabase para news/story/production/composition/distribution/category/settings; LAB se lee, nunca se escribe.
- **Automation/LAB**: 14 capabilities reales (confirmado vía `/status` del Runtime), 325 tests en `lab/tests/` con asserts reales (no placeholders — verificado leyendo `assembler.py`/`motion.py` línea por línea), CLI funcional (`lab.cli`), 12 skills de Claude Code + 8 comandos en `automation/.claude/`.
- **Local Runtime**: puente HTTP real, con venv propio (creado en esta consolidación), heartbeat real a `runtime_registrations` en Supabase.
- **Frontend**: portal público + admin con 5 tabs reales (Command Center, News, Producción, Studio, Distribución, SEO), Studio legado funcional para TikTok, `ProductionContext.tsx` ya alineado con el backend real.
- **Infraestructura**: `nexus.ps1` (CLI de un comando, real, con health checks reales), nginx en Docker (único contenedor), schema SQL de Supabase con RLS.

## 11. Reusable Components

Piezas que se pueden usar tal cual (o casi) para construir el Studio/Content objetivo, sin reescribir:

- `backend/app/domain/timeline/` completo — ya es el modelo de Timeline del target, solo le falta un consumidor.
- `backend/app/domain/distribution/safe_area.py` — Safe Area del target, ya con perfiles sourced por plataforma.
- `backend/app/application/use_cases/{quick_reel,platform_preview}.py` — ya resuelven "Composition→Ready Pipeline" y "Preview" del target, solo falta wireado a `container.py` + endpoint.
- `automation/lab/{sequence,animation,narrative,audio,export}` — planners puros, reales, testeados, listos para que el backend los lea el día que haga falta (mismo patrón que ya existe con editorial/media/render/assembly).
- `frontend/src/studio/lab/{ProductionContext.tsx,api-client.ts,api-types.ts}` — única capa del frontend ya alineada con el backend real; base correcta para cualquier UI nueva de Studio.
- `frontend/src/studio/engines/audio/` — TTS genérico, sin acoplamiento a `NewsItem`.
- `nexus.ps1` + `infrastructure/docker/` — infraestructura ya reusable para lo que venga (no necesita rehacerse al construir Studio).

## 12. Deprecated Components

Candidatos a DEPRECATE (no REMOVE — sin evidencia suficiente de que no se usen, según la propia regla del proyecto):

- `frontend/src/studio/engines/{video,canvas,news}/` + `orchestration/useStudio.ts` — Studio legado Canvas2D, tipado a `NewsItem`. Se apaga cuando exista una vía real de publicar `final_asset_ref` sin pasar por grabación en vivo (condición ya documentada en `CRONOS - Render Architecture Decision.md`, sigue sin cumplirse).
- `automation/main.py` / `automation/script.py` / `automation/src/` — scraper legado. Es lo único que corre en producción hoy (GH Actions cron) — no apagar hasta que `lab/ingestion/` tenga un cron real reemplazándolo Y se verifique paridad de fuentes/calidad.
- `infrastructure/scripts/migrate-workspace.ps1` — ya marcado DEPRECATED en el propio archivo (apuntaba a un layout `Desktop/creation-advanced` que nunca se usó; la migración real ya ocurrió por otro método).
- `automation/docs/LAB_ANIMATION_ENGINE.md` — desactualizado respecto al código real (dice "sin CLI todavía", el CLI ya existe).

Nada de esto se elimina en esta auditoría.

## 13. Technical Debt

En orden de "cuánto bloquea construir Studio":

1. **Cero UI consume el dominio Timeline/Safe Area/Platform Preview.** Es la deuda #1 para el objetivo declarado ("Studio debe convertirse progresivamente en el editor visual").
2. **`AssetRepository` sin adaptor real** (`backend/app/domain/ports.py`) — sin esto, "Asset Resolution" del target de Production no puede ser una pieza real, solo un campo derivado.
3. **Dos pipelines de ingestion sin resolver** (§4, §6) — deuda de decisión, no de código.
4. **`NewsItem` como tipo raíz de ~9 engines del frontend** — migrar a `Post`/`Content` genérico (pedido explícito del usuario) requiere tocar todo `useStudio.ts` y sus sub-hooks, no es un cambio de un archivo.
5. **Cero tests de frontend** — ningún `*.test.ts(x)`, ni Jest ni Playwright configurados, en todo el proyecto.
6. **Documentación desincronizada entre los dos `.claude`**: `obsidian-vault/CRONOS - Assembly.md` en NEXUS dice "diseño pausado, no existe código" mientras que en `automation/docs/LAB_ASSEMBLY.md` dice "implementada" — son verdades de distintos momentos, y nada las sincroniza automáticamente. Mismo problema con Narrative/Audio Direction.
7. **`Estructura del Proyecto.md` y `Stack Técnico.md`** (obsidian-vault) describen el layout pre-consolidación (`rpa/` como plan futuro, sin mencionar `timeline`/`settings` bounded contexts ni `automation/` real).
8. **`automation/.env` trackeado en git** desde el commit inicial del repo — ya documentado como pendiente de limpieza en el propio `.gitignore` del repo.

## 14. Architectural Risks

De mayor a menor severidad:

1. **CRÍTICO — credenciales reales expuestas públicamente en GitHub.** `obsidian-vault/LAB - Local Editorial Lab.md` documenta: *"RPA_NEWS_SCRIPT tiene un .env con credenciales reales (Supabase + OpenRouter) commiteado y público en GitHub. Pendiente de rotar."* Esto sigue siendo cierto post-consolidación (`automation/.env` sigue trackeado). Es una decisión que requiere al usuario (rotar las keys), no algo que este documento resuelve.
2. **ALTO — políticas de storage de Supabase completamente públicas.** `supabase_setup.sql` otorga INSERT/UPDATE/DELETE públicos (sin auth) sobre el bucket `media`. Cualquiera con la URL puede escribir o borrar archivos.
3. **MEDIO — anon key de Supabase hardcodeada en frontend** (`frontend/src/lib/supabaseClient.ts`). Menos grave que 1/2 (la anon key está pensada para ser pública) pero impide rotar o usar proyectos distintos por ambiente.
4. **MEDIO — dos máquinas de estado paralelas sin sincronización** (`StoryStatus`/`CompositionStatus` en backend vs `WorkflowState` en `lab/core/workspace.py`) — un cambio en una no se refleja automáticamente en la otra; cualquier feature que cruce el boundary necesita mapear explícitamente entre las dos (ya se hizo bien en `LocalRuntimeAdapter`, pero es un riesgo si se repite sin cuidado).
5. **BAJO-MEDIO — riesgo de que Automation retome PRO-activamente la vieja arquitectura RPA_NEWS_SCRIPT** — mitigado por el hecho de que `automation/.claude` ya tiene skills propias enfocadas en LAB (no en el scraper viejo), pero el scraper viejo sigue siendo lo único en producción real (cron), lo cual invita a seguir tocándolo en vez de terminar `lab/ingestion`.
6. **BAJO — el PID huérfano en el puerto 8000** documentado en la sesión de infraestructura anterior (proceso que ningún tool de Windows puede identificar) — cosmético, no bloquea nada, pero es un recordatorio de que el entorno de desarrollo local tiene fragilidad real de procesos en Windows.

## 15. Recommended Implementation Order

No implementar todavía — orden recomendado quirúrgico, cada paso depende solo de evidencia ya reunida acá, ver `docs/NEXUS_ROADMAP.md` para el detalle por fase:

1. Decidir y documentar la fuente de verdad de ingestion (`lab/ingestion` vs scraper legado) — bloquea cualquier limpieza de Automation, es la única decisión puramente de negocio de esta lista.
2. Cerrar el loop Timeline→Safe Area→Preview con un primer consumidor real (probablemente `GetPlatformPreview` expuesto vía API + una pantalla mínima de preview), antes de construir un editor completo — valida el modelo de dominio contra una UI real antes de invertir en Timeline UI completo.
3. Construir `AssetRepository` real (adaptor Supabase) — desbloquea Asset Resolution real en Production y cualquier UI de Studio que necesite listar/elegir assets.
4. Recién ahí, Studio UI progresivo: Preview → Timeline (edición) → export real vía `final_asset_ref`, siguiendo el orden que ya trazó `CRONOS - Render Architecture Decision.md` para poder retirar el Studio legado.
5. Migrar `NewsItem` → `Post`/`Content` genérico en el frontend — después de Studio nuevo, no antes (evita reescribir el engine viejo dos veces).
6. Recién con Studio nuevo funcionando, evaluar apagar el Studio legado (condición ya fijada: publicar `final_asset_ref` directo, sin grabación en vivo).
