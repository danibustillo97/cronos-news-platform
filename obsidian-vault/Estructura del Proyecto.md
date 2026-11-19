---
title: Estructura del Proyecto
tags:
  - arquitectura
---

# 📂 Estructura del Proyecto

Desde 2026-09-14 el repo está dividido en `frontend/` + `backend/` + `infrastructure/`
(ver [[Roadmap]] P0). `rpa/` se incorpora como módulo hermano cuando se corra
`infrastructure/scripts/migrate-workspace.ps1` (mueve el workspace completo a
`Desktop/creation-advanced/`, fuera de una sesión viva de Claude Code).

```
frontend/
  src/
    app/              # App Router de Next.js
      admin/           # Panel administrativo (editor, login, dashboard)
      api/             # Rutas API (news, tts, import-article, proxy-image)
      noticia/[slug]/  # Página pública de artículo
    components/
      admin/
        Production/    # Vista Production (pipeline editorial)
        Studio/        # Vista Studio (review/approve de Compositions)
        Distribution/  # Vista Publish/Distribución
        SocialMedia/   # Editor NLE legado (canvas/video/tiktok) — reutilizado detrás de "Editar"
      ads/             # Espacios publicitarios
      news/             # Feed y tarjetas de noticias
      ui/                # Navbar y UI genérica
      widgets/           # Marcador en vivo, tablas de posiciones
    lib/                # Utilidades (supabaseClient, cache, tags, texto, media)
    studio/             # Engines de audio/video/texto + lab/ (cliente del backend DDD)
    types/               # Tipos compartidos
  package.json, next.config.ts, tsconfig.json, eslint.config.mjs (flat config, ESLint 9)

backend/
  app/
    domain/            # Bounded contexts DDD: news, story, composition, distribution, intelligence, asset, category
    application/        # Use cases (produce_story, prepare_distribution, etc.)
    infrastructure/      # Adapters: Supabase persistence, LAB local/live readers, runtime
    presentation/         # FastAPI: rutas, schemas, mappers
  tests/                 # pytest — domain, application, infrastructure
  requirements.txt

infrastructure/
  database/            # supabase_setup.sql, supabase_schema_update.sql, supabase_setup/ (scripts incrementales)
  scripts/             # migrate-workspace.ps1 (migración Desktop/news → Desktop/creation-advanced)
```

Ver [[Stack Técnico]] y [[Supabase]] para más contexto de cada pieza.
