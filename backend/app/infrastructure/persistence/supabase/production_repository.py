from __future__ import annotations

from datetime import datetime

from app.domain.production.entities import Production, ProductionStage, ProductionStatus
from app.domain.shared.ids import ProductionId, StoryId
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseProductionRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, production_id: str) -> Production | None:
        try:
            res = self._client.table("productions").select("*").eq("id", production_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "productions")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def find_latest_for_story(self, story_id: str) -> Production | None:
        try:
            res = (
                self._client.table("productions").select("*").eq("story_id", story_id)
                .order("started_at", desc=True).limit(1).maybe_single().execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "productions")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def list_active(self, limit: int = 50) -> list[Production]:
        try:
            running = (
                self._client.table("productions").select("*")
                .in_("status", ["RUNNING", "PENDING"]).order("started_at", desc=True).limit(limit).execute()
            )
            rest_limit = max(limit - len(running.data or []), 0)
            recent_done: list[dict] = []
            if rest_limit:
                done = (
                    self._client.table("productions").select("*")
                    .in_("status", ["COMPLETED", "FAILED"]).order("started_at", desc=True).limit(rest_limit).execute()
                )
                recent_done = done.data or []
        except Exception as exc:
            raise_if_schema_missing(exc, "productions")
            raise
        return [self._to_entity(row) for row in (running.data or []) + recent_done]

    def has_runtime_jobs(self, production_id: str) -> bool:
        """True si el Local Runtime alguna vez corrió una etapa de esta
        Production (fila real en production_jobs) -- la señal real de
        "esto lo maneja el Runtime", nunca inferida de lab_item_id (que
        siempre está seteado, también en el flujo legacy)."""
        try:
            res = (
                self._client.table("production_jobs").select("id")
                .eq("production_id", production_id).limit(1).execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "production_jobs")
            raise
        return bool(res.data)

    def save(self, production: Production) -> None:
        payload = {
            "id": str(production.id),
            "story_id": str(production.story_id),
            "status": production.status.value,
            "stages": [
                {"id": s.id, "label": s.label, "done": s.done, "detail": s.detail} for s in production.stages
            ],
            "errors": production.errors,
            "started_at": production.started_at.isoformat(),
            "completed_at": production.completed_at.isoformat() if production.completed_at else None,
            "lab_item_id": production.resolved_lab_item_id,
        }
        try:
            self._client.table("productions").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "productions")
            raise

    @staticmethod
    def _to_entity(row: dict) -> Production:
        stages = [ProductionStage(s["id"], s["label"], s["done"], s.get("detail")) for s in (row.get("stages") or [])]
        return Production(
            id=ProductionId.of(row["id"]), story_id=StoryId.of(row["story_id"]),
            status=ProductionStatus(row["status"]), stages=stages, errors=row.get("errors") or [],
            started_at=datetime.fromisoformat(row["started_at"]),
            completed_at=datetime.fromisoformat(row["completed_at"]) if row.get("completed_at") else None,
            lab_item_id=row.get("lab_item_id"),  # None en filas legacy -- Production.resolved_lab_item_id hace fallback
        )
