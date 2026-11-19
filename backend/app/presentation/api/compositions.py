from __future__ import annotations

from fastapi import APIRouter, Depends

from app.container import Container, get_container
from app.application.use_cases.review_composition import ReviewCompositionInput
from app.application.use_cases.prepare_distribution import PrepareDistributionInput
from app.domain.distribution.entities import Platform
from app.presentation.schemas import ReviewCompositionRequest, PrepareDistributionRequest, CompositionOut, DistributionPlanOut
from app.presentation.mappers import composition_out, distribution_plan_out
from pydantic import BaseModel

router = APIRouter(prefix="/api/compositions", tags=["compositions"])


@router.post("/{composition_id}/review", response_model=CompositionOut)
def review_composition(composition_id: str, body: ReviewCompositionRequest, container: Container = Depends(get_container)) -> CompositionOut:
    composition = container.review_composition.execute(
        ReviewCompositionInput(composition_id=composition_id, decision=body.decision, reason=body.reason)
    )
    return composition_out(composition, container.storage)


class PrepareDistributionResponse(BaseModel):
    distribution_plans: list[DistributionPlanOut]


@router.post("/{composition_id}/prepare-distribution", response_model=PrepareDistributionResponse)
def prepare_distribution(composition_id: str, body: PrepareDistributionRequest, container: Container = Depends(get_container)) -> PrepareDistributionResponse:
    plans = container.prepare_distribution.execute(
        PrepareDistributionInput(composition_id=composition_id, platforms=[Platform(p) for p in body.platforms], copy=body.copy)
    )
    return PrepareDistributionResponse(distribution_plans=[distribution_plan_out(p) for p in plans])
