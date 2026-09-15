from __future__ import annotations

from datetime import datetime, timezone

from app.domain.discovery.entities import (
    DiscoveryFilters, DiscoveryItem, DiscoveryJob, DiscoveryJobStatus, DiscoveryScores,
    DiscoveryStatus, MaterialKind, MaterialReference,
)
from app.domain.shared.ids import DiscoveryItemId, StoryId
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing

_SORTABLE_FIELDS = {"discovered_at", "published_at"}  # jsonb score fields can't be ordered server-side by postgrest


class SupabaseDiscoveryRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, item_id: str) -> DiscoveryItem | None:
        try:
            res = self._client.table("discovery_items").select("*").eq("id", item_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "discovery_items")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def list(self, filters: DiscoveryFilters) -> list[DiscoveryItem]:
        try:
            query = self._client.table("discovery_items").select("*")
            if filters.category_id:
                query = query.eq("category_id", filters.category_id)
            if filters.status:
                query = query.eq("status", filters.status.value)
            if filters.source_domain:
                query = query.eq("source_domain", filters.source_domain)
            if filters.since:
                query = query.gte("discovered_at", filters.since.isoformat())
            if filters.until:
                query = query.lte("discovered_at", filters.until.isoformat())

            sort_field = filters.sort_by if filters.sort_by in _SORTABLE_FIELDS else "discovered_at"
            query = query.order(sort_field, desc=(filters.sort_dir != "asc"))
            query = query.range(filters.offset, filters.offset + filters.limit - 1)
            res = query.execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "discovery_items")
            raise

        items = [self._to_entity(row) for row in (res.data or [])]
        # Score-based sorts happen in-process: postgrest can't order by a
        # key inside a jsonb column portably across score fields, and
        # these lists are already page-bounded by `filters.limit` above.
        if filters.sort_by in {"impact_score", "relevance_score", "freshness_score"}:
            key = filters.sort_by
            items.sort(key=lambda i: getattr(i.scores, key) if getattr(i.scores, key) is not None else -1,
                       reverse=(filters.sort_dir != "asc"))
        return items

    def exists_by_source_url(self, source_url: str) -> bool:
        try:
            res = self._client.table("discovery_items").select("id").eq("source_url", source_url).limit(1).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "discovery_items")
            raise
        return bool(res.data)

    def save(self, item: DiscoveryItem) -> None:
        payload = {
            "id": str(item.id),
            "source_url": item.source_url,
            "original_url": item.original_url,
            "original_title": item.original_title,
            "raw_text": item.raw_text,
            "source_name": item.source_name,
            "source_domain": item.source_domain,
            "author": item.author,
            "language": item.language,
            "category_id": item.category_id,
            "topics": item.topics,
            "published_at": item.published_at.isoformat() if item.published_at else None,
            "discovered_at": item.discovered_at.isoformat(),
            "materials": [
                {
                    "kind": m.kind.value, "url": m.url,
                    "usable_as_final_asset": m.usable_as_final_asset, "editorial_prompt": m.editorial_prompt,
                }
                for m in item.materials
            ],
            "scores": {
                "freshness_score": item.scores.freshness_score,
                "relevance_score": item.scores.relevance_score,
                "impact_score": item.scores.impact_score,
                "source_quality_score": item.scores.source_quality_score,
                "completeness_score": item.scores.completeness_score,
                "material_score": item.scores.material_score,
                "duplicate_of": item.scores.duplicate_of,
            },
            "status": item.status.value,
            "story_id": str(item.story_id) if item.story_id else None,
        }
        try:
            self._client.table("discovery_items").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "discovery_items")
            raise

    @staticmethod
    def _to_entity(row: dict) -> DiscoveryItem:
        scores_row = row.get("scores") or {}
        return DiscoveryItem(
            id=DiscoveryItemId.of(row["id"]),
            source_url=row["source_url"], original_url=row["original_url"], original_title=row["original_title"],
            raw_text=row["raw_text"], source_name=row.get("source_name"), source_domain=row["source_domain"],
            author=row.get("author"), language=row.get("language"), category_id=row.get("category_id"),
            topics=row.get("topics") or [],
            published_at=datetime.fromisoformat(row["published_at"]) if row.get("published_at") else None,
            discovered_at=datetime.fromisoformat(row["discovered_at"]),
            materials=[
                MaterialReference(
                    kind=MaterialKind(m["kind"]), url=m["url"],
                    usable_as_final_asset=m.get("usable_as_final_asset"), editorial_prompt=m.get("editorial_prompt"),
                )
                for m in (row.get("materials") or [])
            ],
            scores=DiscoveryScores(
                freshness_score=scores_row.get("freshness_score"), relevance_score=scores_row.get("relevance_score"),
                impact_score=scores_row.get("impact_score"), source_quality_score=scores_row.get("source_quality_score"),
                completeness_score=scores_row.get("completeness_score"), material_score=scores_row.get("material_score"),
                duplicate_of=scores_row.get("duplicate_of"),
            ),
            status=DiscoveryStatus(row["status"]),
            story_id=StoryId.of(row["story_id"]) if row.get("story_id") else None,
        )


class SupabaseDiscoveryJobRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, job_id: str) -> DiscoveryJob | None:
        try:
            res = self._client.table("discovery_jobs").select("*").eq("id", job_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "discovery_jobs")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def list_recent(self, limit: int = 20) -> list[DiscoveryJob]:
        try:
            res = self._client.table("discovery_jobs").select("*").order("created_at", desc=True).limit(limit).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "discovery_jobs")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    def save(self, job: DiscoveryJob) -> None:
        payload = {
            "id": job.id,
            "status": job.status.value,
            "params": job.params,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "finished_at": job.finished_at.isoformat() if job.finished_at else None,
            "items_found": job.items_found,
            "error": job.error,
        }
        try:
            self._client.table("discovery_jobs").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "discovery_jobs")
            raise

    @staticmethod
    def _to_entity(row: dict) -> DiscoveryJob:
        return DiscoveryJob(
            id=row["id"], status=DiscoveryJobStatus(row["status"]), params=row.get("params") or {},
            created_at=datetime.fromisoformat(row["created_at"]),
            started_at=datetime.fromisoformat(row["started_at"]) if row.get("started_at") else None,
            finished_at=datetime.fromisoformat(row["finished_at"]) if row.get("finished_at") else None,
            items_found=row.get("items_found"), error=row.get("error"),
        )
