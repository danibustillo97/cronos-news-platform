"""PORTAL LAYOUT -- what the public homepage shows, decided in the editor's
"Portada" tab.

  stage    the hero "escenario": the featured story (news), a live video
           transmission (video) or a live radio stream (radio).
  pinned   news ids forced to the top, in order; pinned[0] is the featured
           story on the stage.
  hidden   news ids removed from the homepage (still reachable by URL).

Shared contract with the portal: frontend/src/types/portal.ts.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urlparse

STAGE_MODES = ("news", "video", "radio")
MAX_PINNED = 12
MAX_HIDDEN = 300


def _is_http_url(value: str | None) -> bool:
    if not value:
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


@dataclass(frozen=True)
class StageMedia:
    url: str
    title: str
    image: str | None = None  # poster (video) / logo (radio)


@dataclass(frozen=True)
class PortalLayout:
    mode: str = "news"
    video: StageMedia | None = None
    radio: StageMedia | None = None
    pinned: tuple[str, ...] = ()
    hidden: tuple[str, ...] = ()
    updated_at: datetime | None = None
    updated_by: str | None = None

    def __post_init__(self) -> None:
        if self.mode not in STAGE_MODES:
            raise ValueError(f"modo de escenario desconocido: {self.mode!r}")
        for media, name in ((self.video, "video"), (self.radio, "radio")):
            if media is None:
                continue
            if not _is_http_url(media.url):
                raise ValueError(f"la URL del {name} debe empezar con http(s)://")
            if media.image and not _is_http_url(media.image):
                raise ValueError(f"la imagen del {name} debe ser una URL http(s)")
        if self.mode == "video" and self.video is None:
            raise ValueError("para transmitir video en la portada falta la URL del video")
        if self.mode == "radio" and self.radio is None:
            raise ValueError("para poner la radio en la portada falta la URL del stream")
        if len(self.pinned) > MAX_PINNED:
            raise ValueError(f"máximo {MAX_PINNED} noticias fijadas")
        if len(set(self.pinned)) != len(self.pinned):
            raise ValueError("una noticia está fijada dos veces")
        if len(self.hidden) > MAX_HIDDEN:
            raise ValueError(f"máximo {MAX_HIDDEN} noticias ocultas")
        if set(self.pinned) & set(self.hidden):
            raise ValueError("una noticia no puede estar fijada y oculta a la vez")
