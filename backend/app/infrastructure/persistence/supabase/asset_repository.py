from __future__ import annotations

from datetime import datetime

from app.domain.asset.entities import (
    Asset, AssetType, MediaGenerationJob, MediaGenerationJobStatus,
)
from app.domain.shared.ids import ArtifactId, AssetId, CompositionId, StoryId
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseAssetRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, asset_id: str) -> Asset | None:
        try:
            res = self._client.table("assets").select("*").eq("id", asset_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "assets")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def list_for_story(self, story_id: str) -> list[Asset]:
        try:
            res = self._client.table("assets").select("*").eq("story_id", story_id).order("created_at", desc=True).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "assets")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    def save(self, asset: Asset) -> None:
        payload = {
            "id": str(asset.id),
            "story_id": str(asset.story_id),
            "composition_id": str(asset.composition_id) if asset.composition_id else None,
            "type": asset.type.value,
            "provenance": asset.provenance,
            "storage_ref": asset.storage_ref,
            "created_at": asset.created_at.isoformat(),
            "metadata": asset.metadata,
        }
        try:
            self._client.table("assets").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "assets")
            raise

    @staticmethod
    def _to_entity(row: dict) -> Asset:
        return Asset(
            id=AssetId.of(row["id"]), story_id=StoryId.of(row["story_id"]),
            composition_id=CompositionId.of(row["composition_id"]) if row.get("composition_id") else None,
            type=AssetType(row["type"]), provenance=row.get("provenance"), storage_ref=row["storage_ref"],
            created_at=datetime.fromisoformat(row["created_at"]), metadata=row.get("metadata") or {},
        )


class SupabaseMediaGenerationJobRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, job_id: str) -> MediaGenerationJob | None:
        try:
            res = self._client.table("media_generation_jobs").select("*").eq("id", job_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "media_generation_jobs")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def list_recent(self, limit: int = 20) -> list[MediaGenerationJob]:
        try:
            res = (
                self._client.table("media_generation_jobs").select("*")
                .order("created_at", desc=True).limit(limit).execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "media_generation_jobs")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    def save(self, job: MediaGenerationJob) -> None:
        payload = {
            "id": job.id,
            "artifact_id": str(job.artifact_id),
            "placeholder_id": job.placeholder_id,
            "status": job.status.value,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "finished_at": job.finished_at.isoformat() if job.finished_at else None,
            "asset_id": job.asset_id,
            "error": job.error,
        }
        try:
            self._client.table("media_generation_jobs").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "media_generation_jobs")
            raise

    @staticmethod
    def _to_entity(row: dict) -> MediaGenerationJob:
        return MediaGenerationJob(
            id=row["id"], artifact_id=ArtifactId.of(row["artifact_id"]), placeholder_id=row["placeholder_id"],
            status=MediaGenerationJobStatus(row["status"]), created_at=datetime.fromisoformat(row["created_at"]),
            started_at=datetime.fromisoformat(row["started_at"]) if row.get("started_at") else None,
            finished_at=datetime.fromisoformat(row["finished_at"]) if row.get("finished_at") else None,
            asset_id=row.get("asset_id"), error=row.get("error"),
        )
