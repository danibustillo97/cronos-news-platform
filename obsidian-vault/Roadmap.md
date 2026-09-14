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
- [ ] P1 — Architecture alignment (mapear `NewsStatus`/`StoryStatus`/`CompositionStatus` existentes al lenguaje POST/RAW/PROCESSING/READY sin romper los bounded contexts DDD actuales)
- [ ] P2 — Post / Production contract (evaluar si `POST` reemplaza/envuelve a `News` como concepto transversal, o si `News` sigue siendo una vista/canal)
- [ ] P3 — Asset system (ciudadano de primera clase: id/type/source/metadata/dimensions/duration/version/prompt)
- [ ] P4 — Composition model (extender `backend/app/domain/composition/entities.py` — hoy `ScriptLine`/`asset_refs` planos — hacia un modelo con tracks/timing si se decide construir el Timeline sobre esta base)
- [ ] P5 — Render architecture decision (Canvas 2D actual vs Remotion/WebCodecs/FFmpeg — documentar decisión, no migrar por moda)
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
