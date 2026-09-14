---
title: master (producción)
tags:
  - rama
  - produccion
status: estable
---

# 🟢 `master`

Rama estable, desplegada en [nexusnews.info](https://nexusnews.info). HEAD actual: `9ccb162` — "Change live demo link in README".

- **33 commits** en total.
- Es la rama por defecto del repo (`origin/HEAD -> origin/master`).
- Contiene el módulo `SocialMediaGenerator.tsx` (monolítico, ~2750 líneas) para generar contenido de redes sociales — este componente está siendo **reemplazado** en [[Feature - Social Media Studio v2]].

## Historial reciente (resumen)

- `9ccb162` Change live demo link in README
- `8ae917b` Fix: Update Turbopack, update Next
- `5e60ba9` / `7429692` update: changes in todo
- `e5e702b` feat: upgrade social generator with premium layouts and watermark

## Relación con otras ramas

- [[Feature - Social Media Studio v2]] parte de `master` y le lleva **15 commits de ventaja** (48 vs 33) reescribiendo el módulo de redes sociales.
- [[Vercel - Fix CVE RSC]] **no** parte de `master` actual — parte de un commit mucho más antiguo (`fd7919c`, "Reconstruccion", 2025-10-22), de antes de la gran reescritura. Por eso su diff contra `master` se ve enorme y borra archivos que sí existen hoy.

## Notas técnicas

- Next.js `^15.4.5`, React `19`, Tailwind 4.
- Cliente de Supabase hardcodeado (no usa `.env`) — ver [[Supabase#⚠️ Seguridad]].
