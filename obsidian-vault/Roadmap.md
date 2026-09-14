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
- [ ] P6 — Safe Area engine (`DistributionProfile` con canvas/aspect_ratio/safe_area/ui_zones, validación bloqueante antes de export)
- [ ] P7 — Timeline core (Sequence→Tracks→Shots→Assets→Timing→Transforms)
- [ ] P8 — Quick Reel (POST READY + assets existentes + reglas deterministas, sin IA)
- [ ] P9 — Story Reel (secuencia manual tipo Noris Viral)
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
