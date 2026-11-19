"""ADS -- admin-managed sponsor banners (house ads). One AdBanner per
creative, keyed to a fixed AdPosition slot. A position's pixel size is a
business rule (IAB standard ad sizes), not a per-upload choice -- every
banner in a slot renders at exactly the same size, so the layout around it
never shifts. Deliberately separate from the editorial bounded contexts:
a sponsor banner isn't produced by the editorial pipeline, it's uploaded
once and toggled on/off.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

# Must match frontend/src/components/ads/AdSlot.tsx's AdPosition exactly --
# the frontend is the source of truth for WHERE slots exist on the page,
# this is the source of truth for WHAT SIZE each one is. Only the 5
# positions an <AdSlot> actually renders on a real page are listed here
# (grep frontend/src for `AdSlot position=` before adding one back) --
# a position nothing renders would be a slot the admin can "manage" that
# can never actually be seen, which is worse than not offering it.
POSITION_SIZES: dict[str, tuple[int, int]] = {
    "HOME_TOP": (728, 90),
    "HOME_FEED": (300, 250),
    "ARTICLE_TOP": (728, 90),
    "ARTICLE_END": (300, 250),
    "SIDEBAR_DESKTOP": (300, 600),
}


@dataclass(frozen=True)
class AdBanner:
    id: str
    position: str
    image_url: str
    link_url: str
    alt_text: str
    width: int
    height: int
    active: bool
    created_at: datetime

    def __post_init__(self) -> None:
        if self.position not in POSITION_SIZES:
            raise ValueError(f"unknown ad position: {self.position!r}")
        if not self.image_url.strip():
            raise ValueError("image_url cannot be empty")
        if not self.link_url.strip():
            raise ValueError("link_url cannot be empty")
        expected_w, expected_h = POSITION_SIZES[self.position]
        if self.width != expected_w or self.height != expected_h:
            raise ValueError(
                f"{self.position} banners must be {expected_w}x{expected_h}, got {self.width}x{self.height}"
            )
