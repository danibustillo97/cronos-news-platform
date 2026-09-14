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

## Deuda técnica detectada

- [ ] Mover credenciales de Supabase a variables de entorno — ver [[Supabase#⚠️ Seguridad]]
- [ ] Revisar políticas RLS del bucket `media` (actualmente escritura pública)
- [ ] Decidir qué hacer con las ramas automáticas del bot de Vercel — ver [[Vercel - Fix CVE RSC]]
- [ ] Añadir `.env.example` para que el setup local (`npm install && npm run dev`) funcione sin credenciales hardcodeadas
