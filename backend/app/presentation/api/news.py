from __future__ import annotations

from fastapi import APIRouter, Depends

from app.container import Container, get_container
from app.application.use_cases.prepare_content import PrepareContentInput
from app.presentation.schemas import NewsWorkspaceOut, StoryOut, ConvertToContentOut
from app.presentation.mappers import news_workspace_out, story_out

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("", response_model=NewsWorkspaceOut)
def list_news(container: Container = Depends(get_container)) -> NewsWorkspaceOut:
    workspace = container.list_news.execute(limit=50)
    return news_workspace_out(workspace)


@router.post("/{news_id}/prepare-content", response_model=StoryOut)
def prepare_content(news_id: str, container: Container = Depends(get_container)) -> StoryOut:
    story = container.prepare_content.execute(PrepareContentInput(news_id=news_id))
    return story_out(story)


@router.post("/{news_id}/convert-to-content", response_model=ConvertToContentOut)
def convert_to_content(news_id: str, container: Container = Depends(get_container)) -> ConvertToContentOut:
    """"Convertir en contenido": resuelve/crea la Story, crea la
    Production, y le pide al Local Runtime que arranque LAB de verdad.
    Nunca pide ni devuelve un story_id manual al usuario — el frontend
    solo usa el que viene en la respuesta para navegar a Production."""
    result = container.convert_news_to_content.execute(news_id)
    return ConvertToContentOut(
        story_id=result.story_id, production_id=result.production_id, already_existed=result.already_existed,
    )
