from __future__ import annotations

from app.domain.composition.entities import (
    Composition, CompositionContent, CompositionKind, CompositionShot, CompositionStatus, ScriptLine,
)
from app.domain.shared.ids import CompositionId, ProductionId, StoryId
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseCompositionRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, composition_id: str) -> Composition | None:
        try:
            res = self._client.table("compositions").select("*").eq("id", composition_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "compositions")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def list_for_story(self, story_id: str) -> list[Composition]:
        try:
            res = (
                self._client.table("compositions").select("*").eq("story_id", story_id)
                .order("created_at", desc=True).execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "compositions")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    def save(self, composition: Composition) -> None:
        content = composition.content
        payload = {
            "id": str(composition.id),
            "story_id": str(composition.story_id),
            "production_id": str(composition.production_id),
            "kind": composition.kind.value,
            "status": composition.status.value,
            "content": {
                "angle": content.angle, "hook": content.hook,
                "script": [{"section": s.section, "text": s.text} for s in content.script],
                "narrative_summary": content.narrative_summary, "media_summary": content.media_summary,
                "asset_refs": content.asset_refs, "final_asset_ref": content.final_asset_ref,
                "shots": [
                    {
                        "shot_id": s.shot_id, "scene_id": s.scene_id, "disposition": s.disposition,
                        "duration_seconds": s.duration_seconds, "asset_refs": s.asset_refs,
                    }
                    for s in content.shots
                ],
            },
            "target_platforms": composition.target_platforms,
        }
        try:
            self._client.table("compositions").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "compositions")
            raise

    @staticmethod
    def _to_entity(row: dict) -> Composition:
        c = row.get("content") or {}
        content = CompositionContent(
            angle=c.get("angle"), hook=c.get("hook"),
            script=[ScriptLine(s["section"], s["text"]) for s in c.get("script", [])],
            narrative_summary=c.get("narrative_summary"), media_summary=c.get("media_summary"),
            asset_refs=c.get("asset_refs", []), final_asset_ref=c.get("final_asset_ref"),
            shots=[
                CompositionShot(
                    shot_id=s["shot_id"], scene_id=s["scene_id"], disposition=s["disposition"],
                    duration_seconds=s["duration_seconds"], asset_refs=s.get("asset_refs", []),
                )
                for s in c.get("shots", [])
            ],
        )
        return Composition(
            id=CompositionId.of(row["id"]), story_id=StoryId.of(row["story_id"]),
            production_id=ProductionId.of(row["production_id"]), kind=CompositionKind(row["kind"]),
            status=CompositionStatus(row["status"]), content=content,
            target_platforms=row.get("target_platforms") or [],
        )
