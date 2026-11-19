---
title: CRONOS — Assembly
tags:
  - arquitectura
  - cronos
  - lab
  - diseño
status: diseño pausado — esperando aprobación de Narrative & Audio Direction
---

# 🎬 CRONOS — Assembly

Última etapa propuesta de Fase 4.2 en [[LAB - Local Editorial Lab]]: convierte los shots ya renderizados individualmente (`videos/rendered/*.mp4`, ver `docs/LAB_RENDER_ENGINE.md` en `RPA_NEWS_SCRIPT`) en un único `final_reel.mp4`.

> [!warning] Pausado
> El diseño quedó completo pero **pausado deliberadamente**: dependía de una constante de magnitud de Ken Burns inventada sin respaldo editorial, y de un modelo de audio como pista única plana. Ambos puntos se resuelven con [[CRONOS - Narrative & Audio Direction]] — Assembly se retoma después de aprobar esa capa.

## Responsabilidad

Ejecuta/compone decisiones ya tomadas por etapas anteriores — **no vuelve a tomar decisiones editoriales**. Lee `render_plan.json` + `animation_plan.json` (transiciones — `render_plan.json` no las propaga) + `narrative_direction.json`/`audio_plan.json` (una vez existan) — todo solo lectura.

## Artifact nuevo: `assembly_plan.json`

Por shot: `disposition` (`INCLUDED` / `EXCLUDED_NO_ASSET` / `BLOCKED_NOT_RENDERED`), filtro de motion, transición `declared` vs `applied` (con flag `downgraded` — v1 solo ejecuta `CUT`, `FADE`/`DISSOLVE` quedan declarados pero no aplicados, nunca en silencio).

## Decisión más delicada: shots sin asset (texto-only)

`renderer.py` ya sentó el precedente: generar un fondo sólido para un shot sin imagen sería "inventar un tratamiento visual" — viola la disciplina NO INVENTAR del proyecto. Assembly sigue el mismo criterio: **excluye** esos shots del video físico (`EXCLUDED_NO_ASSET`), documentando la duración declarada vs la duración realmente incluida — nunca fabrica contenido para rellenar el hueco. Con los datos reales de `793ff158b714`: de 17s declarados, hoy solo 4s (`shot_02`) tienen asset real.

## Qué NO toca

`sequence.json`, `animation_plan.json`, `asset_registry.json`, `media_blueprint.json`, `lab/sequence/`, `lab/animation/`, `lab/render/`, Production/Supabase/Vercel/GitHub Actions, ningún provider (Gemini/Cloudflare). Output: `videos/final/final_reel.mp4`, un solo archivo vigente por historia.

## CURRENT / DESIGNED / FUTURE

- **CURRENT**: no existe código.
- **DESIGNED**: arquitectura completa (planner puro + assembler con FFmpeg real + CLI `assembly-plan`/`assembly-execute`, sin skill de ejecución — mismo criterio que `render-execute`).
- **FUTURE**: implementación real, una vez aprobada [[CRONOS - Narrative & Audio Direction]]; `DISSOLVE` real (requiere `xfade`, no el demuxer `concat`).
