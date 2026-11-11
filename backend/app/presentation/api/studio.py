from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.container import Container, get_container
from app.application.use_cases.studio import (
    CreateStudioProjectInput, UpdateStudioProjectInput, get_studio_safe_area,
)
from app.domain.shared.errors import InvalidStateTransition, NotFoundError
from app.domain.studio.entities import (
    ClipTransform, CompositionFormat, StudioClip, StudioMode, StudioProjectStatus, StudioScene, TrackType,
)
from app.domain.studio.templates import SEED_TEMPLATES
from app.presentation.schemas import (
    CreateStudioProjectRequest, SafeAreaOut, StudioProjectOut, StudioProjectVersionsResponse,
    TemplatesResponse, UpdateStudioProjectRequest,
)
from app.presentation.mappers import safe_area_out, studio_project_out, template_out

router = APIRouter(prefix="/api/studio", tags=["studio"])


def _resolve_asset_urls(container: Container, project) -> dict[str, str]:
    """Same real, no-fabrication pattern as artifacts.py's own
    _resolve_asset_urls -- a clip's asset_id resolves to a URL only if a
    real Asset row exists for it."""
    urls: dict[str, str] = {}
    asset_ids = {c.asset_id for s in project.scenes for c in s.clips if c.asset_id}
    for asset_id in asset_ids:
        asset = container.asset_repo.find_by_id(asset_id)
        if asset is not None:
            urls[asset_id] = container.storage.resolve_url(asset.storage_ref)
    return urls


def _scenes_from_request(scenes_in) -> list[StudioScene]:
    return [
        StudioScene(
            id=s.id, order=s.order, duration_ms=s.duration_ms,
            clips=[
                StudioClip(
                    id=c.id, track=TrackType(c.track), start_ms=c.start_ms, duration_ms=c.duration_ms,
                    source_placeholder_id=c.source_placeholder_id, asset_id=c.asset_id, text=c.text,
                    transform=ClipTransform(
                        x=c.transform.x, y=c.transform.y, scale=c.transform.scale, rotation=c.transform.rotation,
                        opacity=c.transform.opacity, focal_x=c.transform.focal_x, focal_y=c.transform.focal_y,
                    ),
                    locked=c.locked, muted=c.muted, hidden=c.hidden,
                )
                for c in s.clips
            ],
        )
        for s in scenes_in
    ]


@router.post("/projects", response_model=StudioProjectOut)
def create_studio_project(
    body: CreateStudioProjectRequest, container: Container = Depends(get_container),
) -> StudioProjectOut:
    try:
        project = container.create_studio_project.execute(CreateStudioProjectInput(
            source_artifact_id=body.source_artifact_id, mode=StudioMode(body.mode),
            template_id=body.template_id, format=CompositionFormat(body.format),
        ))
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return studio_project_out(project, _resolve_asset_urls(container, project))


@router.get("/projects/{project_id}", response_model=StudioProjectOut)
def get_studio_project(project_id: str, container: Container = Depends(get_container)) -> StudioProjectOut:
    try:
        project = container.get_studio_project.execute(project_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return studio_project_out(project, _resolve_asset_urls(container, project))


@router.patch("/projects/{project_id}", response_model=StudioProjectOut)
def update_studio_project(
    project_id: str, body: UpdateStudioProjectRequest, container: Container = Depends(get_container),
) -> StudioProjectOut:
    try:
        project = container.update_studio_project.execute(UpdateStudioProjectInput(
            project_id=project_id, title=body.title, template_id=body.template_id,
            format=CompositionFormat(body.format) if body.format is not None else None,
            status=StudioProjectStatus(body.status) if body.status is not None else None,
            scenes=_scenes_from_request(body.scenes) if body.scenes is not None else None,
        ))
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (ValueError, InvalidStateTransition) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return studio_project_out(project, _resolve_asset_urls(container, project))


@router.post("/projects/{project_id}/versions", response_model=StudioProjectOut)
def duplicate_studio_project(project_id: str, container: Container = Depends(get_container)) -> StudioProjectOut:
    try:
        project = container.duplicate_studio_project.execute(project_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return studio_project_out(project, _resolve_asset_urls(container, project))


@router.get("/projects/by-source/{artifact_id}", response_model=StudioProjectVersionsResponse)
def list_studio_project_versions(
    artifact_id: str, container: Container = Depends(get_container),
) -> StudioProjectVersionsResponse:
    versions = container.list_studio_project_versions.execute(artifact_id)
    return StudioProjectVersionsResponse(
        versions=[studio_project_out(p, _resolve_asset_urls(container, p)) for p in versions],
    )


@router.get("/templates", response_model=TemplatesResponse)
def list_studio_templates() -> TemplatesResponse:
    return TemplatesResponse(templates=[template_out(t) for t in SEED_TEMPLATES])


@router.get("/safe-areas", response_model=SafeAreaOut)
def get_safe_area(format: str = Query(...)) -> SafeAreaOut:
    try:
        composition_format = CompositionFormat(format)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"unsupported format: {format!r}") from exc
    return safe_area_out(get_studio_safe_area(composition_format))
