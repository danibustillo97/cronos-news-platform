"""Persists each LAB capability's typed result as its own
`story_intelligence` row (story_id, kind, payload jsonb) — never a single
blob. `kind` is the capability name; `payload` is that capability's own
serialized value object.
"""
from __future__ import annotations

from dataclasses import asdict

from app.domain.intelligence.entities import (
    EditorialIntelligence, RecommendedFormat, StoryIntelligence, StoryConcept, Hook, ScriptSection,
    NarrativeDirection, NarrativeBeat, AudioDirection, AudioTrack, SilenceWindow, MediaPlan, SceneMediaDecision,
)
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseIntelligenceRepository:
    def __init__(self, client) -> None:
        self._client = client

    def save_editorial(self, story_id: str, result: EditorialIntelligence) -> None:
        self._upsert(story_id, "editorial", asdict(result))

    def save_story_intelligence(self, story_id: str, result: StoryIntelligence) -> None:
        self._upsert(story_id, "story_intelligence", asdict(result))

    def save_narrative(self, story_id: str, result: NarrativeDirection) -> None:
        self._upsert(story_id, "narrative", asdict(result))

    def save_audio(self, story_id: str, result: AudioDirection) -> None:
        self._upsert(story_id, "audio", asdict(result))

    def save_media_plan(self, story_id: str, result: MediaPlan) -> None:
        self._upsert(story_id, "media_plan", asdict(result))

    def get_editorial(self, story_id: str) -> EditorialIntelligence | None:
        payload = self._fetch(story_id, "editorial")
        if payload is None:
            return None
        return EditorialIntelligence(
            headline=payload.get("headline"), what_happened=payload.get("what_happened"),
            angle=payload.get("angle"), narrative_strength=payload.get("narrative_strength"),
            why_it_matters=payload.get("why_it_matters"),
            recommended_formats=[RecommendedFormat(**f) for f in payload.get("recommended_formats", [])],
        )

    def get_story_intelligence(self, story_id: str) -> StoryIntelligence | None:
        payload = self._fetch(story_id, "story_intelligence")
        if payload is None:
            return None
        return StoryIntelligence(
            has_story=payload.get("has_story", False), reason_if_not=payload.get("reason_if_not"),
            concepts=[StoryConcept(**c) for c in payload.get("concepts", [])],
            hooks=[Hook(**h) for h in payload.get("hooks", [])],
            script=[ScriptSection(**s) for s in payload.get("script", [])],
        )

    def get_narrative(self, story_id: str) -> NarrativeDirection | None:
        payload = self._fetch(story_id, "narrative")
        if payload is None:
            return None
        return NarrativeDirection(beats=[NarrativeBeat(**b) for b in payload.get("beats", [])])

    def get_audio(self, story_id: str) -> AudioDirection | None:
        payload = self._fetch(story_id, "audio")
        if payload is None:
            return None
        return AudioDirection(
            tracks=[AudioTrack(**t) for t in payload.get("tracks", [])],
            silence_windows=[SilenceWindow(**s) for s in payload.get("silence_windows", [])],
            ducking_priority=payload.get("ducking_priority", []),
        )

    def get_media_plan(self, story_id: str) -> MediaPlan | None:
        payload = self._fetch(story_id, "media_plan")
        if payload is None:
            return None
        return MediaPlan(scenes=[SceneMediaDecision(**s) for s in payload.get("scenes", [])])

    def _upsert(self, story_id: str, kind: str, payload: dict) -> None:
        try:
            self._client.table("story_intelligence").upsert(
                {"story_id": story_id, "kind": kind, "payload": payload}, on_conflict="story_id,kind"
            ).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "story_intelligence")
            raise

    def _fetch(self, story_id: str, kind: str) -> dict | None:
        try:
            res = (
                self._client.table("story_intelligence").select("payload")
                .eq("story_id", story_id).eq("kind", kind).maybe_single().execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "story_intelligence")
            raise
        return res.data["payload"] if res and res.data else None
