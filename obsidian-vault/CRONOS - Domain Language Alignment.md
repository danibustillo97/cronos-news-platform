---
title: CRONOS - Domain Language Alignment
tags:
  - arquitectura
  - decision
---

# Domain Language Alignment (P1 / P2)

Decisión tomada al ejecutar el ciclo continuo de implementación de 2026-09-14.
Responde a dos preguntas del spec de producto: cómo mapear los estados
RAW/PROCESSING/READY/PUBLISHED/ARCHIVED, y si `POST` debe reemplazar a `News`
como concepto transversal.

## P1 — Mapeo de estados

El backend (`backend/app/domain/*/entities.py`) ya implementa **Domain State
Machines** reales (enums + métodos de transición que lanzan
`InvalidStateTransition`), no strings sueltos — esto es exactamente lo que
pide el spec ("Preferir Domain State Machines sobre simples strings"). No se
renombran los enums existentes; se documenta el mapeo conceptual:

| Spec (vocabulario producto) | Código (vocabulario DDD)                                    |
|---|---|
| RAW           | `News.status = INGESTED` |
| PROCESSING    | `News.status = NORMALIZED` **o** `Story.status = IN_PRODUCTION` |
| READY         | `Story.status = PRODUCED` (y, para una pieza concreta, `Composition.status = APPROVED`) |
| PUBLISHED     | `Story.status = PUBLISHED` |
| ARCHIVED      | `News.status = ARCHIVED` (Story no tiene ARCHIVED hoy — ver nota) |

**Nota:** `Story` no tiene un estado `ARCHIVED` propio; solo `News` lo tiene.
Si en el futuro se necesita archivar una Story ya producida (no solo una News
sin procesar), es una transición nueva a añadir a `StoryStatus`, no algo que
exista implícitamente hoy. No se agrega especulativamente — se deja anotado
aquí para cuando aparezca el caso de uso real.

## P2 — ¿`POST` reemplaza a `News`?

**Decisión: no hace falta un bounded context nuevo.** `Story`
(`backend/app/domain/story/entities.py`) ya es, conceptualmente, el `POST`
del spec:

- Ya es la "unidad editorial" (comentario en el código: *"the editorial unit
  CRONOS revolves around"*).
- Ya desacopla su origen de `News`: `Story.open_from_news` toma un
  `StorySource` con `label` libre (default `"news"`), no exige que el origen
  sea una News — cubre "una noticia, varias relacionadas, o selección
  editorial pura" tal como pide el spec.
- Ya soporta múltiples formatos de salida vía `Composition.kind` (REEL,
  ARTICLE, CAROUSEL, STORY, POST, YOUTUBE_LONG_FORM, etc.) — una Story puede
  tener varias Compositions.
- `News` ya está limitada a ingestión (`INGESTED`/`NORMALIZED`/`ARCHIVED`) y
  nunca se convierte en Story automáticamente (regla explícita en el
  docstring del módulo) — o sea, `News` ya es "una vista/canal", no la raíz
  del sistema.

**Gap real detectado (no resuelto todavía, a propósito):** el spec pide que
un POST pueda ser de tipo `news | history | documentary | opinion | data |
story | social | Noris Viral`. Hoy `Story` no tiene ese discriminador — solo
`category_ids` (libres) y `StorySource.label`. Añadir un campo
`content_type` a `Story` es sencillo, pero no hay todavía un caso de uso
concreto en el producto que lo necesite (nada en Production/Studio filtra o
se comporta distinto según ese tipo). Se deja pendiente para cuando exista
esa necesidad real, en vez de añadirlo especulativamente — YAGNI, ver reglas
de "no features sin necesidad" del propio proyecto.

## Consecuencia práctica

No se toca código de dominio en este paso. `News` y `Story` se quedan como
están; este documento es la referencia de vocabulario para cuando se
escriba UI, documentación de producto, o se hable de "un POST" — se refiere
a una `Story` con sus `Composition`s, no a una tabla nueva.
