"""Real ArtifactPublishingPort implementation: writes an APPROVED
Artifact into the pre-existing `news` table the public site
(nexusnews.info) reads directly via its own Supabase client -- the same
table SupabaseNewsRepository (CRONOS' NEWS/ingestion context) already
writes to, see that module's docstring. The upsert is keyed by
`artifact_id`, making a retry of the same scheduled publication
idempotent without overwriting an unrelated ingestion row.

Column names below were confirmed against the LIVE table (`select *
limit 1` against the real Supabase project), not guessed from the
repo's older schema.sql files, which have drifted from what is
actually deployed.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.domain.artifact.entities import Artifact
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing

# Not a fabricated person -- the same organizational byline the public
# site itself already falls back to when no per-article author exists
# (see ArticleContent.tsx / the NewsArticle JSON-LD: `author || 'Nexus News'`).
_DEFAULT_AUTHOR = "Nexus News"


class SupabaseLegacyNewsPublisher:
    def __init__(self, client) -> None:
        self._client = client

    def publish(self, artifact: Artifact, category_name: str | None, image_url: str | None, content_html: str) -> str:
        primary_source = artifact.sources[0] if artifact.sources else None
        payload = {
            "artifact_id": str(artifact.id),
            "title": artifact.title,
            "subtitle": artifact.subtitle,
            "slug": artifact.seo.slug,
            # Real structured HTML (body images already resolved by
            # PublishArtifact._resolve_content_html) -- the public site
            # renders this as real HTML now, never plain text.
            "content": content_html,
            "excerpt": artifact.excerpt,
            "summary": artifact.summary,
            "category": category_name,
            "tags": artifact.tags,
            "seo_title": artifact.seo.seo_title,
            "seo_description": artifact.seo.seo_description,
            "author": _DEFAULT_AUTHOR,
            "source": primary_source.source_name if primary_source else None,
            "source_url": primary_source.source_url if primary_source else None,
            "image_url": image_url,
            "status": "published",
            "published_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            res = self._client.table("news").upsert(payload, on_conflict="artifact_id").execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "news")
            raise
        return str(res.data[0]["id"])
