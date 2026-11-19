from __future__ import annotations

from datetime import datetime

from app.domain.studio.entities import (
    ClipTransform, CompositionFormat, StudioClip, StudioProject, StudioProjectStatus, StudioScene, StudioMode,
    TrackType,
)
from app.domain.shared.ids import StudioProjectId
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseStudioProjectRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, project_id: str) -> StudioProject | None:
        try:
            res = self._client.table("studio_projects").select("*").eq("id", project_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "studio_projects")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def list_versions_for_source(self, source_artifact_id: str) -> list[StudioProject]:
        try:
            res = (
                self._client.table("studio_projects").select("*").eq("source_artifact_id", source_artifact_id)
                .order("version", desc=True).execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "studio_projects")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    def save(self, project: StudioProject) -> None:
        payload = {
            "id": str(project.id),
            "source_artifact_id": project.source_artifact_id,
            "mode": project.mode.value,
            "template_id": project.template_id,
            "format": project.format.value,
            "status": project.status.value,
            "version": project.version,
            "parent_project_id": project.parent_project_id,
            "title": project.title,
            "content": {
                "scenes": [
                    {
                        "id": scene.id, "order": scene.order, "duration_ms": scene.duration_ms,
                        "clips": [
                            {
                                "id": clip.id, "track": clip.track.value, "start_ms": clip.start_ms,
                                "duration_ms": clip.duration_ms, "source_placeholder_id": clip.source_placeholder_id,
                                "asset_id": clip.asset_id, "text": clip.text,
                                "transform": {
                                    "x": clip.transform.x, "y": clip.transform.y, "scale": clip.transform.scale,
                                    "rotation": clip.transform.rotation, "opacity": clip.transform.opacity,
                                    "focal_x": clip.transform.focal_x, "focal_y": clip.transform.focal_y,
                                },
                                "locked": clip.locked, "muted": clip.muted, "hidden": clip.hidden,
                            }
                            for clip in scene.clips
                        ],
                    }
                    for scene in project.scenes
                ],
            },
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
        }
        try:
            self._client.table("studio_projects").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "studio_projects")
            raise

    @staticmethod
    def _to_entity(row: dict) -> StudioProject:
        content = row.get("content") or {}
        scenes = [
            StudioScene(
                id=s["id"], order=s["order"], duration_ms=s["duration_ms"],
                clips=[
                    StudioClip(
                        id=c["id"], track=TrackType(c["track"]), start_ms=c["start_ms"], duration_ms=c["duration_ms"],
                        source_placeholder_id=c.get("source_placeholder_id"), asset_id=c.get("asset_id"),
                        text=c.get("text"),
                        transform=ClipTransform(**(c.get("transform") or {})),
                        locked=c.get("locked", False), muted=c.get("muted", False), hidden=c.get("hidden", False),
                    )
                    for c in s.get("clips", [])
                ],
            )
            for s in content.get("scenes", [])
        ]
        return StudioProject(
            id=StudioProjectId.of(row["id"]), source_artifact_id=row["source_artifact_id"],
            mode=StudioMode(row["mode"]), template_id=row["template_id"], format=CompositionFormat(row["format"]),
            status=StudioProjectStatus(row["status"]), version=row["version"], scenes=scenes,
            created_at=datetime.fromisoformat(row["created_at"]), updated_at=datetime.fromisoformat(row["updated_at"]),
            parent_project_id=row.get("parent_project_id"), title=row.get("title") or "",
        )
