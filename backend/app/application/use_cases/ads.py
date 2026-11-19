from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.ads.entities import POSITION_SIZES, AdBanner
from app.domain.ports import AdBannerRepository, AdBannerStoragePort


class ListAdBanners:
    """Every banner, every position -- the admin management list."""

    def __init__(self, ads: AdBannerRepository) -> None:
        self._ads = ads

    def execute(self) -> list[AdBanner]:
        return self._ads.list_all()


class ListActiveAdBannersForPosition:
    """What the public site's <AdSlot position="X"> actually renders."""

    def __init__(self, ads: AdBannerRepository) -> None:
        self._ads = ads

    def execute(self, position: str) -> list[AdBanner]:
        return self._ads.list_active_for_position(position)


@dataclass
class CreateAdBannerInput:
    position: str
    link_url: str
    alt_text: str
    filename: str
    content: bytes
    content_type: str


class CreateAdBanner:
    """Uploads the creative and creates the row in one step -- there is no
    real intermediate state where a banner row exists without its image
    (unlike editorial media, which can be requested before it's produced)."""

    def __init__(self, ads: AdBannerRepository, storage: AdBannerStoragePort) -> None:
        self._ads = ads
        self._storage = storage

    def execute(self, input: CreateAdBannerInput) -> AdBanner:
        if input.position not in POSITION_SIZES:
            raise ValueError(f"unknown ad position: {input.position!r}")
        width, height = POSITION_SIZES[input.position]

        image_url = self._storage.upload(input.filename, input.content, input.content_type)
        banner = AdBanner(
            id=str(uuid.uuid4()),
            position=input.position,
            image_url=image_url,
            link_url=input.link_url.strip(),
            alt_text=input.alt_text.strip(),
            width=width,
            height=height,
            active=True,
            created_at=datetime.now(timezone.utc),
        )
        self._ads.save(banner)
        return banner


@dataclass
class UpdateAdBannerInput:
    banner_id: str
    link_url: str | None = None
    alt_text: str | None = None
    active: bool | None = None


class UpdateAdBanner:
    def __init__(self, ads: AdBannerRepository) -> None:
        self._ads = ads

    def execute(self, input: UpdateAdBannerInput) -> AdBanner:
        banner = self._ads.find_by_id(input.banner_id)
        if banner is None:
            raise LookupError(f"AdBanner {input.banner_id} not found")

        updated = AdBanner(
            id=banner.id,
            position=banner.position,
            image_url=banner.image_url,
            link_url=(input.link_url.strip() if input.link_url is not None else banner.link_url),
            alt_text=(input.alt_text.strip() if input.alt_text is not None else banner.alt_text),
            width=banner.width,
            height=banner.height,
            active=(input.active if input.active is not None else banner.active),
            created_at=banner.created_at,
        )
        self._ads.save(updated)
        return updated


class DeleteAdBanner:
    def __init__(self, ads: AdBannerRepository) -> None:
        self._ads = ads

    def execute(self, banner_id: str) -> None:
        self._ads.delete(banner_id)
