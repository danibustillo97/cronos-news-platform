---
title: Roadmap
tags:
  - roadmap
---

# 🗺️ Roadmap

Del README del proyecto ("Próximas mejoras"), más lo observado en el historial de ramas:

## Del README

- [ ] Panel administrativo para edición, publicación y control editorial
- [ ] Clasificación por deportes, ligas o países
- [ ] Soporte multiidioma (i18n)
- [ ] Modo oscuro
- [ ] Control de estados: borrador, publicado, archivado
- [ ] Publicación programada y workflows de revisión

## En progreso (visible en ramas)

- [ ] **Social Media Studio v2** — editor NLE (timeline, motores de audio/video, integración TikTok con OAuth) — ver [[Feature - Social Media Studio v2]]
- [ ] Páginas legales (Privacidad / Términos) para cumplir requisitos de la API de TikTok

## CRONOS — Content Operating System (2026-09-14 en adelante)

Prioridades del ciclo continuo de implementación (INSPECT→PLAN→IMPLEMENT→TEST→FIX→CLEAN→DOCUMENT→CONTINUE), ver [[Estructura del Proyecto]] para el layout resultante:

- [x] **P0 — Workspace reorganization.** Repo dividido en `frontend/` + `backend/` + `infrastructure/` (commit interno completo, historial preservado vía rename detection). Movimiento físico `Desktop/news` → `Desktop/creation-advanced` + incorporación de `Desktop/RPA` como `rpa/` queda en `infrastructure/scripts/migrate-workspace.ps1`, pendiente de ejecución manual del usuario (no se puede hacer de forma segura desde una sesión de Claude Code viva anclada a esa misma ruta).
- [x] P1 — Architecture alignment. Mapeo documentado en [[CRONOS - Domain Language Alignment]] — los enums existentes ya son Domain State Machines reales, no strings; no se renombran.
- [x] P2 — Post / Production contract. Decisión: `Story` ya es conceptualmente `POST` (unidad editorial desacoplada de News, múltiples Compositions de salida) — no se crea un bounded context nuevo. Gap detectado y anotado (sin resolver a propósito, YAGNI): falta un discriminador de tipo de contenido (news/history/documentary/opinion/...) en `Story`, pendiente de caso de uso real.
- [~] P3 — Asset system, parcial. `AssetType` ampliado (IMAGE/VIDEO/AUDIO/VOICE/SUBTITLE/LOGO/GRAPHIC/FONT, ya soportado por la tabla `assets` que no restringe `type`) + `created_at` (la columna ya existía en Supabase pero el dominio la ignoraba). Prompt/dimensiones/duración quedan en `metadata` (jsonb) — no se les da columna propia porque nada los lee todavía (regenerar/buscar por prompt no está implementado). **No implementado aún:** `AssetRepository` (`backend/app/domain/ports.py:63`) no tiene adaptor Supabase — a diferencia de News/Story/Composition/Distribution, no hay forma real de guardar o listar Assets hoy. `presentation/api/assets.py` solo sirve archivos de LAB por path, no es un Asset Manager. Construir el adapter + endpoints reales es su propia tarea, no un side-effect de este pase.
- [x] P4 — Composition model. Agregado `CompositionShot` (shot_id/scene_id/disposition/duration_seconds/asset_refs) a `CompositionContent`, poblado en `ProduceStory` uniendo `AssemblyResult.shots` con `MediaPlan.scenes` por `scene_id` (mismo join que ya documentaba la arquitectura de LAB). De paso corregido un bug real: `asset_refs` quedaba hardcodeado en `[]` aunque Media Planning ya supiera qué assets tiene cada escena. Persistido en Supabase (jsonb, sin migración) y expuesto en la API (`CompositionShotOut`) + tipos TS (`CompositionShotDTO`). Test de regresión: `test_produce_story_joins_media_assets_into_composition_shots_by_scene_id`.
- [x] P5 — Render architecture decision. La decisión ya estaba tomada e implementada en LAB (FFmpeg real, server-side, planner/executor) — ratificada, no reinventada. Conflicto real detectado y documentado: el Studio legado (`frontend/src/studio/engines/video/`, Canvas2D + `MediaRecorder`, clip de 5.5s hardcodeado) es una segunda ruta de render que compite con LAB — se congela (no se extiende, no se construye Timeline core sobre ella) pero no se elimina todavía porque es la única vía de publicación a TikTok que funciona hoy. Ver [[CRONOS - Render Architecture Decision]].
- [x] P6 — Safe Area engine. `DistributionProfile` (canvas/insets/ui_zones por `(platform, format)`) + `validate_elements` puro, en `backend/app/domain/distribution/safe_area.py`. Corregido un mismatch real al escribir el módulo: las claves de `DEFAULT_PROFILES` usaban `Format.SHORT` para TikTok, pero `PrepareDistribution._PLATFORM_FORMAT` ya mapea TIKTOK→`Format.REEL` — con la clave vieja, `get_profile()` habría devuelto `None` para todo plan de distribución real de TikTok. Insets de Instagram (right-rail) y YouTube (safe zone oficial de Google) también corregidos tras research — el right-rail de Instagram estaba subestimado (65px vs ~120px reales), lo que habría dejado pasar CTAs tapados. Fuentes y razonamiento en [[CRONOS - Safe Area Engine]]. **Gap anotado a propósito (YAGNI, mismo patrón que P3):** nadie llama a `validate_elements` todavía — no hay Timeline (P7) ni compositor que produzca los rects de elementos, así que no hay export gate real que bloquear. Construir ese caller es su propia tarea.
- [x] P7 — Timeline core. `Sequence`→`Track`→`TimelineShot`→`Timing`/`Transform`/`Transition` en `backend/app/domain/timeline/`, bounded context propio (no un método de `Composition`) porque Quick Reel (P8) y Story Reel (P9) van a construir un `Sequence` sin pasar por `ProduceStory`. Único builder real hoy: `build_timeline_from_composition()`, deriva de `Composition.content.shots` (P4) — solo shots `INCLUDED` avanzan el cursor de tiempo, igual que la distinción declared/included de `AssemblyResult`. `Transform` es identidad por defecto y `Transition` fuerza estructuralmente el vocabulario declared/applied/downgraded de Assembly (`CUT` no aplicado es inválido) porque ninguno de los dos tiene todavía una fuente de datos real — Assembly sigue con el diseño de Ken Burns pausado. Detalle y CURRENT/DESIGNED/FUTURE en [[CRONOS - Timeline Core]]. **Gap anotado a propósito:** nada llama a `build_timeline_from_composition` todavía (ni `ProduceStory` ni ningún endpoint) — mismo patrón que P3/P6.
- [x] P8 — Quick Reel. `app/application/use_cases/quick_reel.py` — primer caller real del builder de Timeline (P7): toma una Composition `APPROVED` de una Story `PRODUCED` (mapeo READY de P1/P2) con al menos un shot `INCLUDED` y arma un `Sequence` con `build_timeline_from_composition`, sin tocar LAB ni pedirle nada a la IA. Elegibilidad = tres reglas deterministas sobre estado ya existente (story/composition/shots), nunca juicio editorial — de ahí "sin IA". Error nuevo `QuickReelNotEligible` (mismo patrón `reason` que `CapabilityUnavailableError`: `story_not_ready`/`composition_not_approved`/`no_includable_shots`). Tests con dobles en memoria en `tests/application/test_quick_reel.py`. Detalle en [[CRONOS - Quick Reel]]. **Gap anotado a propósito:** no enchufado a `container.py` ni expuesto por API todavía — no hay UI real que lo consuma hoy (mismo patrón que P3/P6/P7).
- [x] P9 — Story Reel. `app/domain/timeline/story_reel.py` — `ManualShotSpec` + `build_timeline_from_manual_shots`, el segundo builder real de Timeline (P7) y el contraparte manual de Quick Reel (P8): arma un `Sequence` directo de shots curados a mano, sin LAB, sin estado de Story/Composition que verificar (nada que derivar, un humano ya decidió el orden). Valida solo lo estructural (`shot_id` no vacío, duración positiva, `asset_refs` no vacío — nunca un `EXCLUDED_NO_ASSET` manual, si no hay asset el editor simplemente no agrega el shot); no puede validar que los `asset_refs` existan de verdad porque el gap de `AssetRepository` de P3 sigue abierto. "Noris Viral" es un valor de la enumeración `content_type` del spec (gap de P2) sin spec estructural propia — este pase implementa "secuencia manual" tal cual, sin inventar reglas Noris-específicas. Tests en `tests/domain/test_story_reel.py`. Detalle en [[CRONOS - Story Reel]]. **Gap anotado a propósito:** sin caller todavía, mismo patrón que P3/P6/P7/P8.
- [ ] P10 — Platform preview (consume la misma Composition + DistributionProfile que el render)
- [ ] Después: Skins, Templates, Voices, Subtitles, Publish Center, Analytics, integraciones sociales, Live Assistant

## Deuda técnica detectada

- [x] `eslint-config-next` (16.1.1) desalineado de `next` (15.5.16) rompía `next lint` con "circular structure to JSON" — fijado a `eslint-config-next@15.5.16` + migrado `.eslintrc.json` → `eslint.config.mjs` (flat config, requerido por ESLint 9)
- [x] Componentes huérfanos sin ningún import (`MainLayout.tsx`, `Navbar.tsx`, `RevolutionaryLayout.tsx`, superados por `AppLayoutClient.tsx` + `ui/ModernNavbar.tsx`) — eliminados
- [ ] Mover credenciales de Supabase a variables de entorno — ver [[Supabase#⚠️ Seguridad]]
- [ ] Revisar políticas RLS del bucket `media` (actualmente escritura pública)
- [ ] Decidir qué hacer con las ramas automáticas del bot de Vercel — ver [[Vercel - Fix CVE RSC]]
- [ ] Añadir `.env.example` para que el setup local (`npm install && npm run dev`) funcione sin credenciales hardcodeadas
- [ ] `ARCHITECTURE.md` y `REFACTORING_SUMMARY.md` (movidos a `frontend/`) describen un refactor de `SocialMedia.tsx` ya superado por la arquitectura `studio/` actual — revisar si siguen siendo útiles o deprecarlos
- [ ] Warnings de pydantic en `backend/app/presentation/schemas.py` (`Field name "copy"` shadows atributo de `CamelModel` en `DistributionPlanOut` y `PrepareDistributionRequest`)
- [ ] 39-42 vulnerabilidades reportadas por `npm audit` en `frontend/` (heredadas, no introducidas por la reorganización) — revisar antes de exponer a producción
