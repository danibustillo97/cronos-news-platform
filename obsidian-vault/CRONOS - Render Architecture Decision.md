---
title: CRONOS - Render Architecture Decision
tags:
  - arquitectura
  - decision
  - lab
---

# Render Architecture Decision (P5)

El spec de producto pedía evaluar Canvas 2D / Remotion / WebCodecs / FFmpeg
"desde cero" antes de extender el editor audiovisual. Al inspeccionar el
código encontré que **esa decisión ya está tomada e implementada** — no en
este repo, sino en LAB (`Desktop/RPA_NEWS_SCRIPT`, ver [[LAB - Local
Editorial Lab]]), y el backend de este workspace ya la consume. Documento
acá la ratificación de esa decisión y el conflicto real que sí hay que
resolver: dos motores de render compitiendo dentro de `cronos-news-platform`.

## Lo que ya existe (evaluado contra los criterios del spec)

**LAB usa FFmpeg real, server-side, con un split planner/executor:**
Editorial/Narrative/Audio Direction (razonamiento de Claude Code, declara
*intención*) → Sequence/Animation/Render/Assembly (Python determinístico +
FFmpeg, *ejecuta* — nunca vuelve a decidir). `backend/app/infrastructure/
lab/local/render_adapter.py` y `assembly_adapter.py` son **lectores** de los
artifacts que LAB ya produjo (`render_plan.json`, `assembly_plan.json`), no
re-implementan el render. `ProduceStory` (`backend/app/application/
use_cases/produce_story.py`) ya orquesta las 9 capabilities de LAB
(editorial→story→narrative→audio→media→sequence→animation→render→assembly),
cada una con su propio Port, fallando honestamente (`CapabilityUnavailableError`)
si LAB todavía no la resolvió — nunca fabrica un resultado.

| Criterio | FFmpeg (LAB, ya implementado) | Canvas2D+MediaRecorder (frontend, legado) |
|---|---|---|
| Deterministic rendering | Sí — mismo plan JSON, mismo output | No — depende del navegador/GC/tab visible |
| Server-side | Sí | No — 100% en el navegador del usuario |
| Performance | Más rápido que tiempo real | Atado a wall-clock (`useVideo.ts`: graba 5.5s fijos = tarda 5.5s) |
| Timeline/transiciones/audio/subtítulos | Vía filtergraph, ya diseñado (`assembly_plan.json` declara transición `declared` vs `applied`) | Composición manual por capas, sin modelo de timeline real |
| Preview interactivo | No (FFmpeg no previsualiza) | Sí — esto SÍ lo hace bien |
| Exportación | mp4 nativo | Solo `video/webm` (MediaRecorder), requiere transcodificar para algunos flujos |
| Mantenibilidad | Planner/executor ya testeado en LAB | Compositor de canvas hecho a mano, sin tests |

**Remotion/WebCodecs no se evaluaron a fondo porque no hay razón para
reemplazar algo que ya funciona, está testeado, y no migrar "por moda" es
una regla explícita del proyecto.** Remotion además requiere licencia
comercial a partir de cierta escala y Chromium headless en el server — costo
de infraestructura que hoy no está justificado frente a un pipeline FFmpeg
que ya produjo un video real (`render_shot_02.mp4`, ver LAB Fase 4.2).

## Decisión

**Se ratifica FFmpeg + planner/executor (LAB) como el motor de render de
CRONOS.** No se construye un motor de render nuevo en `cronos-news-platform`.
El trabajo de este workspace es *consumir* lo que LAB produce — ya lo hace
(`ProduceStory`, `LocalRenderAdapter`, `LocalAssemblyAdapter`).

## El conflicto real: dos rutas de render compitiendo

`frontend/src/studio/engines/video/` (`video.engine.ts` +
`useVideo.ts`) + `frontend/src/components/admin/SocialMedia/services/canvas/`
implementan una **segunda** ruta de render: capturan el `<canvas>` en vivo
con `canvas.captureStream()` + `MediaRecorder`, grabando un clip de duración
**fija (5500ms, hardcodeado)**, sin ningún concepto de timeline, y descargan
un `.webm`. Esta es la ruta que usa hoy el Studio legado (alcanzable desde
`CompositionWorkspace.tsx` vía el botón "Editar") para publicar a TikTok —
`lastRecordedBlob` es lo que sube `TikTokPublisher.tsx`.

**No se elimina ahora** — es la única ruta de publicación a TikTok que
funciona de punta a punta hoy, y `CompositionWorkspace.tsx` ya la trata
explícitamente como legada ("reused as-is, not rebuilt"). Pero:

- **No se construye Timeline core (P7) sobre esta base.** El Timeline de
  CRONOS debe modelar planes declarativos (como `sequence.json`/
  `animation_plan.json` de LAB), no estado de canvas en vivo.
  `Composition.content.shots` (agregado en P4, ver [[CRONOS - Domain
  Language Alignment]]) ya sigue ese patrón — es la base correcta para
  extender, no el compositor de canvas.
- **Se retira en cuanto la Distribution/Publish de este workspace pueda
  publicar directamente `final_asset_ref`** (el mp4 que LAB ya produce) sin
  pasar por una grabación en vivo del navegador. Eso depende de que LAB
  desbloquee Assembly (pausado, ver [[CRONOS - Assembly]]) y de que
  Distribution (P-siguiente, fuera de este pase) suba ese archivo
  directamente a TikTok/Meta/YouTube en vez de requerir un Blob grabado a
  mano.

## CURRENT / DESIGNED / FUTURE

- **CURRENT**: dos rutas de render viven en paralelo (FFmpeg/LAB para el
  pipeline narrativo completo; Canvas2D/MediaRecorder para publicar a TikTok
  manualmente hoy).
- **DECIDIDO**: FFmpeg/LAB es la arquitectura de render de CRONOS. Canvas2D
  es legado, congelado (no se extiende), no eliminado (todavía es la única
  vía de publicación real).
- **FUTURE**: retirar Canvas2D/MediaRecorder cuando Distribution pueda
  publicar `final_asset_ref` directamente — no antes, para no romper el
  único flujo de publicación que funciona hoy.
