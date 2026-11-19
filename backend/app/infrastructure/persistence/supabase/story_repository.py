"""Persists to `cronos_stories` (NOT `stories`) — a real, pre-existing
`stories` table already belongs to an unrelated legacy "video stories"
feature (VideoStories.tsx / AdminStoriesManager.tsx), confirmed by direct
inspection of the live Supabase project. Reusing that name would have
silently corrupted a real, in-use table.
"""
from __future__ import annotations

from app.domain.story.entities import Story, StorySource, StoryStatus
from app.domain.shared.ids import NewsId, StoryId
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseStoryRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, story_id: str) -> Story | None:
        try:
            res = self._client.table("cronos_stories").select("*").eq("id", story_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "cronos_stories")
            raise
        if not res or not res.data:
            return None
        sources = self._sources_for(story_id)
        return self._to_entity(res.data, sources)

    def find_by_source_news_id(self, news_id: str) -> Story | None:
        try:
            res = (
                self._client.table("story_sources").select("story_id")
                .eq("source_news_id", news_id).maybe_single().execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "story_sources")
            raise
        if not res or not res.data:
            return None
        return self.find_by_id(res.data["story_id"])

    def list_recent(self, limit: int) -> list[Story]:
        try:
            res = (
                self._client.table("cronos_stories").select("*")
                .order("updated_at", desc=True).limit(limit).execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "cronos_stories")
            raise
        return [self._to_entity(row, self._sources_for(row["id"])) for row in (res.data or [])]

    def save(self, story: Story) -> None:
        payload = {
            "id": str(story.id),
            "headline": story.headline,
            "summary": story.summary,
            "status": story.status.value,
            "category_ids": story.category_ids,
        }
        try:
            self._client.table("cronos_stories").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "cronos_stories")
            raise

        if story.sources:
            try:
                self._client.table("story_sources").delete().eq("story_id", str(story.id)).execute()
                self._client.table("story_sources").insert([
                    {
                        "story_id": str(story.id),
                        "source_news_id": str(s.news_id) if s.news_id else None,
                        "source_url": s.source_url,
                        "label": s.label,
                    }
                    for s in story.sources
                ]).execute()
            except Exception as exc:
                raise_if_schema_missing(exc, "story_sources")
                raise

    def _sources_for(self, story_id: str) -> list[dict]:
        try:
            res = self._client.table("story_sources").select("*").eq("story_id", story_id).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "story_sources")
            raise
        return res.data or []

    @staticmethod
    def _to_entity(row: dict, source_rows: list[dict]) -> Story:
        sources = [
            StorySource(
                news_id=NewsId.of(s["source_news_id"]) if s.get("source_news_id") else None,
                source_url=s.get("source_url"), label=s.get("label", "news"),
            )
            for s in source_rows
        ]
        return Story(
            id=StoryId.of(row["id"]), headline=row["headline"], summary=row.get("summary"),
            category_ids=row.get("category_ids") or [], sources=sources,
            status=StoryStatus(row.get("status", "DISCOVERED")),
        )
