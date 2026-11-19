from __future__ import annotations

from datetime import datetime

from app.domain.ads.entities import AdBanner
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseAdBannerRepository:
    def __init__(self, client) -> None:
        self._client = client

    def list_all(self) -> list[AdBanner]:
        try:
            res = self._client.table("ad_banners").select("*").order("created_at", desc=True).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "ad_banners")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    def list_active_for_position(self, position: str) -> list[AdBanner]:
        try:
            res = (
                self._client.table("ad_banners").select("*")
                .eq("position", position).eq("active", True)
                .order("created_at", desc=True).execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "ad_banners")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    def find_by_id(self, banner_id: str) -> AdBanner | None:
        try:
            res = self._client.table("ad_banners").select("*").eq("id", banner_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "ad_banners")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def save(self, banner: AdBanner) -> None:
        payload = {
            "id": banner.id,
            "position": banner.position,
            "image_url": banner.image_url,
            "link_url": banner.link_url,
            "alt_text": banner.alt_text,
            "width": banner.width,
            "height": banner.height,
            "active": banner.active,
            "created_at": banner.created_at.isoformat(),
        }
        try:
            self._client.table("ad_banners").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "ad_banners")
            raise

    def delete(self, banner_id: str) -> None:
        try:
            self._client.table("ad_banners").delete().eq("id", banner_id).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "ad_banners")
            raise

    @staticmethod
    def _to_entity(row: dict) -> AdBanner:
        return AdBanner(
            id=row["id"],
            position=row["position"],
            image_url=row["image_url"],
            link_url=row["link_url"],
            alt_text=row.get("alt_text") or "",
            width=row["width"],
            height=row["height"],
            active=row["active"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )
