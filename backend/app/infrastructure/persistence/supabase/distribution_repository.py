from __future__ import annotations

from app.domain.distribution.entities import DistributionPlan, DistributionStatus, Platform, Format
from app.domain.shared.ids import CompositionId, DistributionPlanId
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseDistributionRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, plan_id: str) -> DistributionPlan | None:
        try:
            res = self._client.table("distribution_plans").select("*").eq("id", plan_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "distribution_plans")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def list_for_composition(self, composition_id: str) -> list[DistributionPlan]:
        try:
            res = self._client.table("distribution_plans").select("*").eq("composition_id", composition_id).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "distribution_plans")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    def save(self, plan: DistributionPlan) -> None:
        payload = {
            "id": str(plan.id), "composition_id": str(plan.composition_id),
            "platform": plan.platform.value, "format": plan.format.value, "status": plan.status.value,
            "copy": plan.copy, "publication_url": plan.publication_url, "failure_reason": plan.failure_reason,
        }
        try:
            self._client.table("distribution_plans").upsert(payload, on_conflict="composition_id,platform").execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "distribution_plans")
            raise

    @staticmethod
    def _to_entity(row: dict) -> DistributionPlan:
        return DistributionPlan(
            id=DistributionPlanId.of(row["id"]), composition_id=CompositionId.of(row["composition_id"]),
            platform=Platform(row["platform"]), format=Format(row["format"]), status=DistributionStatus(row["status"]),
            copy=row.get("copy"), publication_url=row.get("publication_url"), failure_reason=row.get("failure_reason"),
        )
