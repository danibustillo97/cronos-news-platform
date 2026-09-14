---
title: Estructura del Proyecto
tags:
  - arquitectura
---

# 📂 Estructura del Proyecto

```
src/
  app/              # App Router de Next.js
    admin/           # Panel administrativo (editor, login, dashboard)
    api/             # Rutas API (news, tts, import-article, proxy-image)
    noticia/[slug]/  # Página pública de artículo
  components/
    admin/            # Componentes del panel admin
      SocialMedia/     # (en feature/social-media-studio-v2) servicios de canvas/video/tiktok
    ads/               # Espacios publicitarios
    common/            # Compartidos (RadioBar, etc.)
    news/              # Feed y tarjetas de noticias
    social/            # Embeds sociales (TikTok)
    ui/                # Navbar y UI genérica
    widgets/           # Marcador en vivo, tablas de posiciones
  context/            # Contextos de React (workspace del editor)
  lib/                # Utilidades (supabaseClient, cache, tags, texto)
  studio/             # (solo en feature/social-media-studio-v2) editor NLE — engines de audio/video/texto
  types/               # Tipos compartidos

supabase_setup.sql              # bucket de storage 'media' + políticas
supabase_schema_update.sql      # cambios de esquema
supabase_setup/                 # scripts SQL incrementales (subtítulos, fixes de columnas)
```

Ver [[Stack Técnico]] y [[Supabase]] para más contexto de cada pieza.
