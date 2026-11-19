from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.container import Container, get_container
from app.application.use_cases.produce_story import ProduceStoryInput
from app.presentation.schemas import (
    StoryWorkspaceOut, ProduceStoryRequest, StoryOut, ProductionOut, CompositionOut, ActiveProductionsOut,
)
from app.presentation.mappers import story_workspace_out, story_out, production_out, composition_out, active_production_item_out
from pydantic import BaseModel

router = APIRouter(prefix="/api/stories", tags=["stories"])
productions_router = APIRouter(prefix="/api/productions", tags=["productions"])


@productions_router.get("", response_model=ActiveProductionsOut)
def list_active_productions(container: Container = Depends(get_container)) -> ActiveProductionsOut:
    """El feed del tablero de Production -- todo lo RUNNING/PENDING primero,
    más un puñado de COMPLETED/FAILED recientes. Ver ProductionWorkspace.tsx."""
    items = container.list_active_productions.execute()
    return ActiveProductionsOut(items=[active_production_item_out(i) for i in items])


class ProduceStoryResponse(BaseModel):
    story: StoryOut
    production: ProductionOut
    compositions: list[CompositionOut]


@router.post("/{story_id}/produce", response_model=ProduceStoryResponse)
def produce_story(story_id: str, body: ProduceStoryRequest, container: Container = Depends(get_container)) -> ProduceStoryResponse:
    result = container.produce_story.execute(ProduceStoryInput(story_id=story_id, news_id=body.news_id))
    return ProduceStoryResponse(
        story=story_out(result.story), production=production_out(result.production),
        compositions=[composition_out(c, container.storage) for c in result.compositions],
    )


@router.get("/{story_id}/workspace", response_model=StoryWorkspaceOut)
def get_story_workspace(story_id: str, container: Container = Depends(get_container)) -> StoryWorkspaceOut:
    workspace = container.get_story_workspace.execute(story_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail={"error": "STORY_NOT_FOUND"})
    return story_workspace_out(workspace, container.storage)
