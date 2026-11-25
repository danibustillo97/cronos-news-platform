"""Ad slots of the portal: where each one appears and its EXACT creative size
per device. Sizes are standard IAB units so advertisers can deliver without
custom work. This is the single source of truth: the public <AdSlot>, the
admin "Anuncios" manager and the advertiser spec sheet all read it.
"""
from __future__ import annotations

from dataclasses import dataclass

Size = tuple[int, int]


@dataclass(frozen=True)
class AdSlotSpec:
    placement: str
    name: str
    page: str            # "Portada" | "Artículo" | "Ventanas"
    where: str           # human description of the position
    mobile: Size | None
    tablet: Size | None
    desktop: Size | None


SLOTS: tuple[AdSlotSpec, ...] = (
    AdSlotSpec("home-top", "Portada · Superior", "Portada", "Bajo la noticia destacada, antes del debate del día",
               (320, 100), (728, 90), (970, 250)),
    AdSlotSpec("feed-1", "Pulso · Posición 1", "Portada", "Dentro del feed, después de la 4.ª pieza",
               (300, 250), (336, 280), (336, 280)),
    AdSlotSpec("feed-2", "Pulso · Posición 2", "Portada", "Dentro del feed, después de la 10.ª pieza",
               (300, 250), (336, 280), (336, 280)),
    AdSlotSpec("feed-3", "Pulso · Posición 3", "Portada", "Dentro del feed, después de la 16.ª pieza",
               (300, 250), (336, 280), (336, 280)),
    AdSlotSpec("sidebar", "Columna lateral", "Portada", "Columna derecha fija (solo pantallas grandes)",
               None, None, (300, 600)),
    AdSlotSpec("article-inline", "Artículo · Dentro del texto", "Artículo", "Después del tercer párrafo de cada noticia",
               (300, 250), (336, 280), (728, 90)),
    AdSlotSpec("article-bottom", "Artículo · Final", "Artículo", "Al terminar la noticia, antes de los comentarios",
               (320, 100), (728, 90), (728, 90)),
    AdSlotSpec("match-modal", "Ventana del partido", "Ventanas", "Al pie de la ventana flotante de cada partido",
               (320, 50), (320, 50), (468, 60)),
)

BY_PLACEMENT = {s.placement: s for s in SLOTS}
DEVICES = ("mobile", "tablet", "desktop")
MAX_CREATIVE_KB = 150  # what we ask advertisers for: JPG/PNG/WebP up to 150 KB


def size_of(spec: AdSlotSpec, device: str) -> Size | None:
    return getattr(spec, device)


def spec_out(spec: AdSlotSpec) -> dict:
    return {"placement": spec.placement, "name": spec.name, "page": spec.page, "where": spec.where,
            "sizes": {d: list(size_of(spec, d)) if size_of(spec, d) else None for d in DEVICES}}


def spec_sheet_rows() -> list[dict]:
    """Flat rows for the advertiser spec sheet (one per slot and device)."""
    rows = []
    for s in SLOTS:
        for d, label in (("mobile", "Móvil"), ("tablet", "Tablet"), ("desktop", "Computador")):
            size = size_of(s, d)
            if size:
                rows.append({"espacio": s.name, "ubicacion": s.where, "dispositivo": label, "medida": f"{size[0]}×{size[1]} px",
                             "formato": f"JPG, PNG o WebP · máx. {MAX_CREATIVE_KB} KB"})
    return rows
