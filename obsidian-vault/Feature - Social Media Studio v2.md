---
title: feature/social-media-studio-v2
tags:
  - rama
  - desarrollo-activo
status: en progreso
---

# 🔵 `feature/social-media-studio-v2`

Rama de desarrollo activo. HEAD: `d0558f9` — "fix: restore original TikTok Studio editor layout".

- **48 commits** (15 por delante de `master`).
- Reescribe por completo la generación de contenido para redes sociales: pasa de un componente monolítico (`SocialMediaGenerator.tsx`, -2747 líneas) a una arquitectura modular tipo editor de video (NLE).

## Qué cambia respecto a `master`

67 archivos, +10635 / -4111 líneas. Piezas nuevas principales:

- `src/studio/` — nuevo módulo "Studio":
  - `engines/audio/` — `audio.engine.ts`, `audio.providers.ts`, `useAudio.ts`
  - `engines/video/` — `video.engine.ts`, `useVideo.ts`
  - `engines/text/` — `script.engine.ts`, `useScript.ts`
  - `orchestration/useStudio.ts` (729 líneas — hook central del editor)
  - `ui/Canvas`, `ui/Sidebar`, `ui/Toolbar`
- `src/components/admin/SocialMedia/services/canvas/` — capas de composición (texto, logo, sponsor, splits) y timeline de video (`intro.ts`, `outro.ts`, `renderVideoFrame.ts`, `renderVideoTimeline.ts`, `buildVideoTimeline.ts`)
- `src/components/admin/SocialMedia/services/tiktok.ts` — integración con TikTok Developer API (OAuth + PKCE)
- `src/components/admin/SocialNetworksManager.tsx` — reemplaza a `SocialMediaGenerator.tsx`

## Historial reciente (resumen)

- Integración TikTok: OAuth con PKCE, manejo de `client_key`, modo demo, diagnóstico de configuración
- Páginas legales (Privacidad / Términos) para cumplir requisitos de TikTok, branding "Nexus News"
- Ajustes de layout: sidebar hover-expand, timeline fijo, editor a pantalla completa sin scroll

## Estado

En progreso activo — el último commit es literalmente "restore original TikTok Studio editor layout", señal de que el layout todavía se está afinando. Antes de mergear a `master` conviene:

1. Probar el flujo completo del Studio (grabar/editar/exportar) en local.
2. Revisar que las credenciales de TikTok (`client_key`, etc.) estén en variables de entorno, no hardcodeadas — ver [[Supabase#⚠️ Seguridad]] para el patrón que ya existe en el repo.
