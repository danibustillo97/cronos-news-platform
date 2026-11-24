"""Editorial board API -- what the Kanban screen calls.

GET  /api/editorial/board                  the 5 columns in one response
POST /api/editorial/items/{id}/write        "Redactar yo" / "Redactar con IA" in one click
POST /api/editorial/articles                "+ Nueva noticia" (blank draft)
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import Field

from app.application.use_cases.artifact import RunArtifactJobInput
from app.application.use_cases.editorial_board import BoardCard, CreateArticleInput, WriteItemInput
from app.container import Container, get_container
from app.presentation.api.artifacts import _resolve_asset_urls, _run_or_hand_off
from app.presentation.mappers import artifact_job_out, artifact_out
from app.presentation.schemas import ArtifactJobOut, ArtifactOut, CamelModel

router = APIRouter(prefix="/api/editorial", tags=["editorial"])


class BoardCardOut(CamelModel):
    kind: str
    id: str
    column: str
    title: str
    status: str
    story_id: str | None = None
    excerpt: str | None = None
    image_url: str | None = None
    source: str | None = None
    category_id: str | None = None
    at: datetime | None = None
    scheduled_at: datetime | None = None
    issue_count: int = 0
    job_status: str | None = None
    job_error: str | None = None
    slug: str | None = None
    topics: list[str] = []
    relevance: float | None = None
    heat: float | None = None
    signals: list[str] = []
    sources: list[str] = []
    cluster_ids: list[str] = []
    first_seen: datetime | None = None


class BoardOut(CamelModel):
    columns: dict[str, list[BoardCardOut]]
    counts: dict[str, int]


class WriteItemRequest(CamelModel):
    mode: str = Field(pattern="^(manual|ai)$")
    provider: str | None = None
    sibling_ids: list[str] = []


class DiscardRequest(CamelModel):
    ids: list[str] = Field(min_length=1, max_length=50)


class WriteItemOut(CamelModel):
    artifact: ArtifactOut | None = None
    job: ArtifactJobOut | None = None


class CreateArticleRequest(CamelModel):
    title: str = Field(min_length=1, max_length=300)
    content: str = ""
    category_id: str | None = None
    image_url: str | None = None


def _card(card: BoardCard) -> BoardCardOut:
    return BoardCardOut(**card.__dict__)


@router.get("/board", response_model=BoardOut)
def get_board(container: Container = Depends(get_container)) -> BoardOut:
    board = container.get_editorial_board.execute()
    columns = {name: [_card(c) for c in cards] for name, cards in board.columns.items()}
    return BoardOut(columns=columns, counts={name: len(cards) for name, cards in columns.items()})


@router.post("/items/{item_id}/write", response_model=WriteItemOut)
def write_item(
    item_id: str, body: WriteItemRequest, background_tasks: BackgroundTasks,
    container: Container = Depends(get_container),
) -> WriteItemOut:
    try:
        result = container.write_discovery_item.execute(
            WriteItemInput(item_id=item_id, mode=body.mode, provider=body.provider, sibling_ids=body.sibling_ids)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if result.job is not None:
        _run_or_hand_off(background_tasks, "artifact-processing.yml",
                         container.run_artifact_job.execute, RunArtifactJobInput(job_id=result.job.id))
        return WriteItemOut(job=artifact_job_out(result.job))
    artifact = result.artifact
    return WriteItemOut(artifact=artifact_out(artifact, _resolve_asset_urls(container, [artifact])))


@router.post("/items/discard")
def discard_story(body: DiscardRequest, container: Container = Depends(get_container)) -> dict:
    """Discard a whole story (every outlet's copy) in one call."""
    from app.application.use_cases.editorial_board import archive_siblings

    count = archive_siblings(container.discovery_repo, container.decide_discovery_item, body.ids, decision="IGNORE")
    return {"discarded": count}


@router.post("/articles", response_model=ArtifactOut)
def create_article(body: CreateArticleRequest, container: Container = Depends(get_container)) -> ArtifactOut:
    try:
        artifact = container.create_article.execute(CreateArticleInput(
            title=body.title, content=body.content, category_id=body.category_id, image_url=body.image_url,
        ))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return artifact_out(artifact, _resolve_asset_urls(container, [artifact]))


class FeatureImageRequest(CamelModel):
    url: str | None = None
    caption: str | None = None
    alt_text: str | None = None


class ImageUploadOut(CamelModel):
    url: str


@router.post("/articles/{artifact_id}/images", response_model=ImageUploadOut)
async def upload_article_image(
    artifact_id: str, file: UploadFile = File(...), container: Container = Depends(get_container),
) -> ImageUploadOut:
    """Block editor image upload -> public Supabase Storage URL (same URL
    the portal will render). The browser resizes before sending, so the
    body stays well under Vercel's 4.5 MB request limit."""
    content = await file.read()
    try:
        url = container.upload_article_image.execute(artifact_id, content, file.content_type or "")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ImageUploadOut(url=url)


@router.put("/articles/{artifact_id}/feature-image", response_model=ArtifactOut)
def set_feature_image(
    artifact_id: str, body: FeatureImageRequest, container: Container = Depends(get_container),
) -> ArtifactOut:
    try:
        artifact = container.set_feature_image.execute(artifact_id, body.url, body.caption, body.alt_text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return artifact_out(artifact, _resolve_asset_urls(container, [artifact]))


class OriginalityRequest(CamelModel):
    text: str | None = Field(default=None, max_length=60000)


class SourceOverlapOut(CamelModel):
    name: str
    url: str
    overlap: float


class CopiedPassageOut(CamelModel):
    text: str
    source: str
    ratio: float


class OriginalityOut(CamelModel):
    originality: float
    article_words: int
    compared_sources: int
    sources: list[SourceOverlapOut]
    copied: list[CopiedPassageOut]


@router.post("/articles/{artifact_id}/originality", response_model=OriginalityOut)
def check_originality(
    artifact_id: str, body: OriginalityRequest, container: Container = Depends(get_container),
) -> OriginalityOut:
    """Plagiarism check of the text currently in the editor (sent in the
    body, so unsaved edits count) against the article's sources and the
    same story from other outlets."""
    report = container.check_article_originality.execute(artifact_id, body.text)
    return OriginalityOut(
        originality=report.originality, article_words=report.article_words, compared_sources=report.compared_sources,
        sources=[SourceOverlapOut(name=s.name, url=s.url, overlap=s.overlap) for s in report.sources],
        copied=[CopiedPassageOut(text=c.text, source=c.source, ratio=c.ratio) for c in report.copied],
    )
