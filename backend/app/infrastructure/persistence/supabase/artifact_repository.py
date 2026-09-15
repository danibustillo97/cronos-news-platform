from __future__ import annotations

from datetime import datetime

from app.domain.artifact.entities import (
    Artifact, ArtifactJob, ArtifactJobStatus, ArtifactStatus, Claim, EvidenceLabel, MediaKind,
    MediaRequirement, SeoMetadata, SourceReference, ValidationIssue, ValidationResult,
)
from app.domain.shared.ids import ArtifactId, StoryId
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseArtifactRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, artifact_id: str) -> Artifact | None:
        try:
            res = self._client.table("artifacts").select("*").eq("id", artifact_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "artifacts")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def find_latest_for_story(self, story_id: str) -> Artifact | None:
        try:
            res = (
                self._client.table("artifacts").select("*").eq("story_id", story_id)
                .order("version", desc=True).limit(1).execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "artifacts")
            raise
        rows = res.data or []
        return self._to_entity(rows[0]) if rows else None

    def list_by_status(self, status: str, limit: int = 50) -> list[Artifact]:
        try:
            res = (
                self._client.table("artifacts").select("*").eq("status", status)
                .order("created_at", desc=True).limit(limit).execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "artifacts")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    def save(self, artifact: Artifact) -> None:
        payload = {
            "id": str(artifact.id),
            "story_id": str(artifact.story_id),
            "version": artifact.version,
            "status": artifact.status.value,
            "title": artifact.title,
            "subtitle": artifact.subtitle,
            "excerpt": artifact.excerpt,
            "summary": artifact.summary,
            "content_html": artifact.content_html,
            "category_id": artifact.category_id,
            "tags": artifact.tags,
            "entities": artifact.entities,
            "seo": {
                "seo_title": artifact.seo.seo_title, "seo_description": artifact.seo.seo_description,
                "slug": artifact.seo.slug, "canonical_url": artifact.seo.canonical_url,
            },
            "sources": [
                {
                    "source_url": s.source_url, "source_name": s.source_name, "source_domain": s.source_domain,
                    "author": s.author, "published_at": s.published_at.isoformat() if s.published_at else None,
                    "retrieved_at": s.retrieved_at.isoformat(), "license_info": s.license_info,
                }
                for s in artifact.sources
            ],
            "claims": [
                {"text": c.text, "label": c.label.value, "source_urls": c.source_urls} for c in artifact.claims
            ],
            "media_requirements": [
                {"placeholder_id": m.placeholder_id, "kind": m.kind.value, "prompt": m.prompt, "asset_id": m.asset_id}
                for m in artifact.media_requirements
            ],
            "validation_issues": [{"check": i.check, "detail": i.detail} for i in artifact.validation.issues],
            "editorial_notes": artifact.editorial_notes,
            "created_at": artifact.created_at.isoformat(),
        }
        try:
            self._client.table("artifacts").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "artifacts")
            raise

    @staticmethod
    def _to_entity(row: dict) -> Artifact:
        seo_row = row.get("seo") or {}
        return Artifact(
            id=ArtifactId.of(row["id"]), story_id=StoryId.of(row["story_id"]), version=row["version"],
            status=ArtifactStatus(row["status"]), title=row["title"], subtitle=row.get("subtitle"),
            excerpt=row["excerpt"], summary=row["summary"], content_html=row["content_html"],
            category_id=row.get("category_id"), tags=row.get("tags") or [], entities=row.get("entities") or [],
            seo=SeoMetadata(
                seo_title=seo_row.get("seo_title", ""), seo_description=seo_row.get("seo_description", ""),
                slug=seo_row.get("slug", ""), canonical_url=seo_row.get("canonical_url"),
            ),
            sources=[
                SourceReference(
                    source_url=s["source_url"], source_name=s.get("source_name"), source_domain=s["source_domain"],
                    author=s.get("author"),
                    published_at=datetime.fromisoformat(s["published_at"]) if s.get("published_at") else None,
                    retrieved_at=datetime.fromisoformat(s["retrieved_at"]), license_info=s.get("license_info"),
                )
                for s in (row.get("sources") or [])
            ],
            claims=[
                Claim(text=c["text"], label=EvidenceLabel(c["label"]), source_urls=c.get("source_urls", []))
                for c in (row.get("claims") or [])
            ],
            media_requirements=[
                MediaRequirement(
                    placeholder_id=m["placeholder_id"], kind=MediaKind(m["kind"]), prompt=m["prompt"],
                    asset_id=m.get("asset_id"),
                )
                for m in (row.get("media_requirements") or [])
            ],
            validation=ValidationResult(
                issues=[ValidationIssue(i["check"], i["detail"]) for i in (row.get("validation_issues") or [])]
            ),
            created_at=datetime.fromisoformat(row["created_at"]),
            editorial_notes=row.get("editorial_notes"),
        )


class SupabaseArtifactJobRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, job_id: str) -> ArtifactJob | None:
        try:
            res = self._client.table("artifact_jobs").select("*").eq("id", job_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "artifact_jobs")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def list_recent(self, limit: int = 20) -> list[ArtifactJob]:
        try:
            res = self._client.table("artifact_jobs").select("*").order("created_at", desc=True).limit(limit).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "artifact_jobs")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    def save(self, job: ArtifactJob) -> None:
        payload = {
            "id": job.id,
            "story_id": str(job.story_id),
            "status": job.status.value,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "finished_at": job.finished_at.isoformat() if job.finished_at else None,
            "artifact_id": job.artifact_id,
            "error": job.error,
        }
        try:
            self._client.table("artifact_jobs").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "artifact_jobs")
            raise

    @staticmethod
    def _to_entity(row: dict) -> ArtifactJob:
        return ArtifactJob(
            id=row["id"], story_id=StoryId.of(row["story_id"]), status=ArtifactJobStatus(row["status"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            started_at=datetime.fromisoformat(row["started_at"]) if row.get("started_at") else None,
            finished_at=datetime.fromisoformat(row["finished_at"]) if row.get("finished_at") else None,
            artifact_id=row.get("artifact_id"), error=row.get("error"),
        )
