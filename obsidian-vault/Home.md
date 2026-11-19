---
title: Cronos News Platform
tags:
  - proyecto
  - vault-home
aliases:
  - Home
  - Índice
---

# 📰 Cronos News Platform

Vault de documentación para **[cronos-news-platform](https://github.com/danibustillo97/cronos-news-platform)**, plataforma de noticias deportivas en Next.js + Supabase. Demo en vivo: [nexusnews.info](https://nexusnews.info).

> [!info] Repo local
> Este repo fue clonado en `C:\Users\User\Desktop\news`. Esta carpeta `obsidian-vault/` vive dentro del propio repo — ábrela en Obsidian como vault (`Abrir carpeta como vault`).

## Mapa del proyecto

- 🌿 [[Ramas.canvas|Comparación visual de ramas]] — canvas
- 🌿 Ramas
  - [[Master (producción)]]
  - [[Feature - Social Media Studio v2]]
  - [[Vercel - Fix CVE RSC]]
- 🏗️ Arquitectura
  - [[Stack Técnico]]
  - [[Estructura del Proyecto]]
- 🗄️ [[Supabase]]
- 🗺️ [[Roadmap]]
- 🧪 [[LAB - Local Editorial Lab]] — infraestructura local nueva, en otro repo (`RPA_NEWS_SCRIPT`)
- 🌌 [[CRONOS - Tres Universos]] — Architecture / Learning / Production, cómo encajan (diseño)

## Estado en una línea

> [!success] Rama activa
> `master` es la rama estable (deploy en producción). `feature/social-media-studio-v2` es la rama de desarrollo activo — reescribe el generador de contenido para redes sociales como un editor tipo NLE (timeline, canvas, motores de audio/video).

> [!warning] Ramas del bot de Vercel
> `vercel/react-server-components-cve-vu-*` son branches automáticas creadas por el bot de seguridad de Vercel para parchear una CVE de Next.js RSC. Están basadas en un commit muy anterior a la reescritura grande del proyecto — **no fusionar directamente**, ver [[Vercel - Fix CVE RSC]].
