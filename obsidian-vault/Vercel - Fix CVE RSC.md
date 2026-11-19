---
title: vercel/react-server-components-cve-vu-*
tags:
  - rama
  - seguridad
  - bot
status: obsoleta
---

# 🟡 Ramas del bot de Vercel (CVE React Server Components)

Dos ramas casi idénticas, generadas automáticamente por la integración de seguridad de Vercel (autor del commit: `vercel[bot]`):

- `vercel/react-server-components-cve-vu-rvyb3v` (commit `be16a99`, 2025-12-30)
- `vercel/react-server-components-cve-vu-z7xhwa` (commit `568d487`, 2025-12-30)

> [!tip] No son maliciosas
> El nombre puede parecer sospechoso (campañas reales de malware usan nombres similares), pero el autor es `vercel[bot] <vercel[bot]@users.noreply.github.com>` — la integración oficial de GitHub↔Vercel que abre branches/PRs automáticos para parchear vulnerabilidades reportadas en el dashboard de Vercel.

## Por qué el diff contra `master` es enorme

Ambas ramas parten de `fd7919c` ("Recunstruccion", 2025-10-22) — **el commit previo a la gran reescritura del proyecto**. `master` avanzó mucho después de ese punto, así que comparar estas ramas contra `master` actual muestra cientos de líneas "eliminadas" que en realidad simplemente nunca existían en el punto donde el bot trabajó. Point de fusión común: `git merge-base master origin/vercel/react-server-components-cve-vu-rvyb3v` → `fd7919c`.

## Qué arreglan realmente

El cambio real (una vez descontado el ruido de la base desactualizada) es puntual:

- `package.json`: fija `next` a `15.3.8` (versión exacta, sin `^`) para parchear la CVE de Next.js/RSC.
- Quita dependencias no usadas en ese punto del código (`three`, `@react-three/*`, `edge-tts-universal`, etc.)
- Agrega `--turbopack` al script `dev`.

## Recomendación

**No fusionar tal cual** — revertiría toda la reescritura posterior. En su lugar:

1. Confirmar la versión de Next.js instalada en `master` (`^15.4.5`) ya incluye el fix de la CVE (15.4.5 > 15.3.8, así que probablemente sí).
2. Si se confirma, cerrar/borrar estas dos ramas automáticas — ya están obsoletas.
3. Si no, aplicar solo el pin de versión de `next` en `package.json` sobre `master`, no todo el branch.

Relacionado: [[Master (producción)]].
