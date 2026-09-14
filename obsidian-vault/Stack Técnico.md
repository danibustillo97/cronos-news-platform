---
title: Stack Técnico
tags:
  - arquitectura
---

# 🏗️ Stack Técnico

## Frontend

- **Next.js** `^15.4.5` (App Router) + **React** `19`
- **TypeScript** `^5`
- **Tailwind CSS** `4`
- **Framer Motion** — animaciones
- **@react-three/fiber` + `three`** — elementos 3D
- **Tiptap** (`@tiptap/react`, `starter-kit`, `extension-image`) — editor de texto enriquecido del panel admin
- **react-slick** — carruseles

## Backend / datos

- **Supabase** (`@supabase/supabase-js`) — base de datos, auth y storage. Ver [[Supabase]].
- **Python + web scraping** (externo al repo Next.js) — automatización de ingesta de noticias, mencionado en el README pero no vive en este repo.
- **edge-tts-universal** — texto a voz para narración de noticias.

## Utilidades

- `date-fns`, `slugify`, `html-react-parser`, `isomorphic-dompurify` (sanitización de HTML), `sonner` (toasts), `lucide-react` (iconos).

## Scripts

```bash
npm run dev     # next dev
npm run build   # next build
npm run start   # next start
npm run lint    # next lint
```

Ver también [[Estructura del Proyecto]].
