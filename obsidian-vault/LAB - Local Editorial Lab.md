---
title: LAB (Local Editorial & Creative Lab)
tags:
  - proyecto
  - lab
  - en-diseño
status: Fase 4.2 implementada — Assembly en diseño/pausado
---

# 🧪 LAB — Local Editorial & Creative Lab

Infraestructura **local** de preparación editorial (scraping → research/story/script con Claude Code → imágenes con Gemini → revisión humana → export JSON → import manual a [[Supabase|News]]). No es una sección pública, no se despliega en Vercel, no reemplaza [[Feature - Social Media Studio v2|Content Studio]].

> [!info] Vive en otro repo
> LAB se construye sobre **[RPA_NEWS_SCRIPT](https://github.com/danibustillo97/RPA_NEWS_SCRIPT)**, el repo del scraper — clonado localmente en `C:\Users\User\Desktop\RPA_NEWS_SCRIPT`. Es un repo Python separado de `cronos-news-platform`, por eso queda automáticamente fuera de cualquier build de Vercel.

## Documento fuente

La auditoría completa (qué existe hoy en el scraper, qué está roto/huérfano, arquitectura propuesta, plan por fases) vive en ese otro repo, no acá, para no duplicar contenido entre vaults:

`RPA_NEWS_SCRIPT/docs/LAB_ARCHITECTURE_AUDIT.md`

## Lo esencial en una línea

> [!success] Pipeline real hoy (producción, sin tocar)
> `main.py` en `RPA_NEWS_SCRIPT` corre cada 15 min vía GitHub Actions, scrapea ~54 fuentes, y escribe en la **misma tabla `news` de Supabase** que lee [[Supabase|cronos-news-platform]] (`mxvdnf...supabase.co`), con `status: draft`. Sigue así, sin cambios.

> [!important] LAB es 100% local-first, sin Supabase (corrección v2 de la auditoría)
> LAB **no lee ni escribe** en Supabase en ningún punto — ni siquiera para tomar las noticias `draft` de producción como materia prima (eso se descartó explícitamente, ver `LAB_ARCHITECTURE_AUDIT.md` sección N.3). LAB tiene su propia capacidad de ingestión local (extraída de `main.py`, pero corriendo aparte). El único puente con producción es el JSON de exportación + import manual.

> [!warning] Hallazgo de seguridad (fuera del alcance de LAB)
> `RPA_NEWS_SCRIPT` tiene un `.env` con credenciales reales (Supabase + OpenRouter) **commiteado y público** en GitHub. Pendiente de rotar — decisión del usuario, no se tocó sin confirmación.

## Fase 1 (implementada)

`lab/` en `RPA_NEWS_SCRIPT`: ingestión local real y probada (fetch → extract → quality gate → dedupe local → `workspace/incoming/`), sistema de jobs (`lab/core/job.py`), máquina de estados con guardia en código contra saltarse la revisión humana, logging diario, comandos de Claude Code (`/lab-run-scraper`, `/lab-status`). Cero credenciales, cero dependencia de Supabase — confirmado por grep. Documentación completa en `RPA_NEWS_SCRIPT/docs/LAB_*.md`.

## Fase 2 (implementada)

Capa de Inteligencia Editorial: 3 skills de Claude Code (`lab-editorial-understanding`, `lab-editorial-storycraft`, `lab-editorial-narrative`) convierten un item `INGESTED` en un paquete editorial (entendimiento, investigación, fact-check, ángulo, historia, formato, y — si corresponde — hooks/guion/plan de escenas), con taxonomía obligatoria "NO INVENTAR" (`SOURCE_FACT`/`VERIFIED_CONTEXT`/`INFERENCE`/`CREATIVE_FRAMING`/`UNVERIFIED`) en cada afirmación. "No hay historia" es una salida válida, no un error. El item queda en `READY_FOR_REVIEW` — sigue sin saltarse nunca la revisión humana. Detalle completo en `RPA_NEWS_SCRIPT/docs/LAB_EDITORIAL_INTELLIGENCE.md` y `docs/LAB_ARTIFACTS.md`.

## Fase 3 (implementada)

Media Intelligence: una skill (`lab-media-planning`) decide, escena por escena, qué recurso visual hace falta (`REAL_IMAGE`/`GENERATED_IMAGE`/`EDITED_IMAGE`/.../`NO_MEDIA`, con criterio propio — puede anular la etiqueta que dejó Fase 2 si no hay foto real disponible, como pasó de verdad con el caso de prueba) y arma el `media_plan`/`generation_requests`; `lab/media/` (Python determinístico) ejecuta la generación real y guarda el asset físico con su `provenance`/lineage en `asset_registry.json`. El item sigue en `READY_FOR_REVIEW` — Fase 3 no agrega un estado nuevo.

**Dos providers de imagen, seleccionables por configuración, sin fallback automático entre ellos** (`lab.media.providers.resolver`, Media Agent nunca conoce cuál está activo):
- **Gemini** (`gemini-3.1-flash-image`, SDK oficial `google-genai`) — probado hasta la llamada real inclusive: **bloqueado por un 429 de cuota** (el proyecto de Google Cloud del usuario necesita billing habilitado para modelos de imagen).
- **Cloudflare Workers AI / FLUX.1 schnell** (REST API directa, agregado como segundo provider sin tocar Gemini) — primer intento con `flux-2-dev` terminó en timeouts reales del lado de Cloudflare (4 intentos, `HTTP 408`); se descartó ese modelo, se corrigió el provider al formato real de `flux-1-schnell` (JSON plano, no multipart — payloads no son intercambiables entre modelos), y **generó exitosamente el primer asset real de todo el LAB**: `793ff158b714 / scene_02 / img_001`, JPEG 1024×1024, `provenance: AI_GENERATED`, con lineage y continuidad de personaje funcionando.

El resto del pipeline (decision engine, cost-control dry-run, manejo de fallos sin corromper nada, retry, 32/32 tests unitarios con mocks) se validó de punta a punta con datos reales (Jonathan Sia, Fase 2). Detalle completo en `RPA_NEWS_SCRIPT/docs/LAB_MEDIA_INTELLIGENCE.md` y `docs/LAB_MEDIA_ASSETS.md`.

## Fase 4.1 — Sequence (implementada)

`lab/sequence/`: convierte los artifacts narrativos/visuales ya aprobados (Fase 2/3) en `sequence.json` — orden, duración, movimiento y transición declarativos por shot, con `derive_transform_requirement()` (determinístico, decide *si* hace falta transformar el aspect ratio, nunca *cómo*). El archivo lo escribe la skill `lab-sequence-planning` (razonamiento de Claude Code, no Python determinístico); el CLI (`sequence-record`, `sequence-review`, `sequence-status`) valida (`validate_sequence()`), registra el job y hace la transición `DRAFT → READY_FOR_REVIEW`. Testeado (`test_sequence_planner.py`, `test_cli_sequence.py`).

Pendiente (fases futuras, no implementado): Assembly (diseñado, ver más abajo — pausado hasta resolver Narrative/Audio Direction), Fase 5 (export a producción), audio real, movimiento tipo Ken Burns real, `AI_VIDEO`, automatización sin supervisión.

## Fase 4.2 (implementada) — Animation/Render

Las 5 etapas de Fase 4.2 (Animation Planning, skill+CLI, Render Planning, skill+CLI, Renderer FFmpeg real) están implementadas y testeadas — primer video real generado (`render_shot_02.mp4`). Detalle en `RPA_NEWS_SCRIPT/docs/LAB_SEQUENCE_ENGINE.md`, `LAB_ANIMATION_ENGINE.md`, `LAB_RENDER_ENGINE.md`.

> [!warning] Assembly — diseño pausado
> La siguiente etapa (Assembly: concatenar los shots renderizados en un video final) quedó diseñada pero **pausada** — necesita antes una capa de dirección narrativa/emocional y de audio para no producir un slideshow sin criterio. Ver [[CRONOS - Assembly]] y [[CRONOS - Narrative & Audio Direction]].
