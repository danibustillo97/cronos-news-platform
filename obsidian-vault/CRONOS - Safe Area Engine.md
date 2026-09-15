---
title: CRONOS - Safe Area Engine
tags:
  - arquitectura
  - decision
  - distribution
---

# Safe Area Engine (P6)

Safe Area vive en `backend/app/domain/distribution/safe_area.py`, dentro del
bounded context DISTRIBUTION — a propósito, no como un chequeo cosmético
pegado al export. Es una capa de **reglas puras**: `DistributionProfile`
describe, para un `(platform, format)`, dónde puede legalmente pisar el
chrome propio de esa plataforma sobre un canvas de tamaño dado; `validate_elements`
compara rects contra esa área sin renderizar nada ni tocar I/O. El
compositor/QA layer (todavía no existe — depende de Timeline, P7) es quien
llama a esto; Safe Area nunca se valida a sí mismo después del hecho.

## Por qué no hay spec oficial

Ninguna de las cuatro plataformas publica un contrato pixel-perfect,
versionado y machine-readable de su safe zone — todas dan guía orientativa
para creadores y recomiendan previsualizar el resultado real antes de
publicar. Los márgenes de abajo son una agregación de guías de creador y,
para YouTube, la plantilla oficial de safe zone que Google sí publica como
PNG (no como números, pero es la fuente más autorizada que hay). Se tratan
como **piso conservador** para validar, no como garantía — Platform Preview
(P10) es el chequeo visual real una vez que exista.

Regla al elegir un margen cuando las fuentes no coinciden: **preferir el
inset más grande** (safe area más chica). Un inset de más solo rechaza de
más (molesto pero seguro); un inset de menos deja pasar contenido que en
verdad queda tapado por el chrome de la plataforma (falso negativo, el
error que este engine existe para prevenir).

## Márgenes por plataforma (canvas 1080x1920 salvo YouTube long-form)

- **TikTok** (`Format.REEL` — así lo mapea `PrepareDistribution._PLATFORM_FORMAT`,
  no `Format.SHORT`) — top=220, right=140, bottom=400, left=44. Fuentes
  agregadas de guías de creador reportan rangos de top 130-140px, bottom
  400-484px, right 140-180px, left 44-60px; se tomó el extremo conservador
  de cada rango (top más alto que el reportado porque no hay razón para
  confiar en el mínimo, bottom en el piso del rango encontrado).
- **Instagram Reels** (`Format.REEL`) — top=269, right=120, bottom=384,
  left=65. El right-rail (like/comment/share/menú) mide ~120px según las
  mismas guías — un valor anterior de este engine tenía 65px acá, que
  subestimaba esa columna y habría dejado pasar CTAs tapados por los
  íconos; corregido.
- **Facebook Reels** (`Format.REEL`) — top=200, right=90, bottom=320,
  left=32. Facebook no publica márgenes propios para Reels; se reutiliza
  una versión ajustada de Instagram (misma empresa, chrome similar pero con
  menos botones en el right-rail y sin barra de atribución de audio) en vez
  de inventar números sin fuente.
- **YouTube Shorts** (`Format.SHORT`) — top=288, right=192, bottom=672,
  left=48. Estos son los números de la plantilla oficial de Google
  (safe area 840x960 empezando en x=48,y=288 sobre un canvas 1080x1920),
  preferida sobre estimados de terceros que daban bottoms bien más chicos
  (300-380px) porque Google es la única fuente semi-oficial del set. El
  bottom es el más profundo de las cuatro plataformas porque el panel de
  descripción y la barra de progreso pueden expandirse mucho más allá del
  estado colapsado.
- **YouTube long-form** (`Format.LONG_FORM`, 1920x1080) — sin insets. El
  video horizontal no tiene chrome de plataforma superpuesto sobre el
  contenido (a diferencia de las apps verticales), así que el safe area es
  el canvas completo.

No hay perfil para `Platform.WEB` (`Format.ARTICLE`) — un artículo no tiene
noción de safe area de video.

## CURRENT / DESIGNED / FUTURE

- **CURRENT**: el engine existe, es puro, está testeado, pero **no lo llama
  nadie todavía**. No hay compositor ni Timeline (P7) que produzca los
  rects de elementos que `validate_elements` necesita, ni un export gate
  real en el backend — el render de video hoy vive en LAB (ver
  [[CRONOS - Render Architecture Decision]]) y este workspace solo lee sus
  artifacts. Igual que el gap de `AssetRepository` documentado en P3, este
  es un gap real anotado a propósito (YAGNI): construir el caller es su
  propia tarea, no un side-effect de este pase.
- **DESIGNED**: cuando exista Timeline (P7) y un compositor que sepa dónde
  cae cada elemento (texto, CTA, logo, subtítulo) en el canvas final, ese
  compositor llama a `validate_elements(elements, get_profile(platform, format))`
  antes de dar luz verde al export — bloqueante, no advisory.
- **FUTURE**: Platform Preview (P10) reemplaza la necesidad de confiar
  ciegamente en estos márgenes agregados — al consumir la misma
  `Composition` + `DistributionProfile` que el render, puede mostrar el
  resultado real superpuesto al chrome real de cada plataforma.
