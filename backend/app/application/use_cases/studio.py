"""NEXUS STUDIO -- Phase 1 use cases: turn a real PUBLISHED Artifact into
an editable graphic/reel project, read/patch/version it. No AI storyboard,
no voice, no render/export here -- that's Phase 2+ (see the approved
Studio plan). CreateStudioProject's auto-seed is entirely deterministic,
built only from real Artifact fields (title/subtitle/excerpt/category/
media requirements/captions) -- it never invents narrative text.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.artifact.entities import MediaKind
from app.domain.artifact.validation import ordered_placeholder_ids
from app.domain.distribution.entities import Format as DistributionFormat, Platform
from app.domain.distribution.safe_area import DEFAULT_PROFILES, EdgeInsets
from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import StudioProjectId
from app.domain.studio.entities import (
    CANVAS_SIZE, ClipTransform, CompositionFormat, StudioClip, StudioMode, StudioProject, StudioProjectStatus,
    StudioScene, TrackType,
)
from app.domain.studio.templates import find_template
from app.domain.ports import ArtifactRepository, StudioProjectRepository

_DEFAULT_TEMPLATE_ID = "nexus_editorial"
_DEFAULT_IMAGE_TEMPLATE_ID = "nexus_editorial_premium_red"

# Section 10/39: every real (platform, format) pair whose canvas is 9:16 --
# used to compute a "safe for any of these" default (see GetStudioSafeArea).
_REEL_9X16_PROFILE_KEYS = [
    (Platform.TIKTOK, DistributionFormat.REEL), (Platform.INSTAGRAM, DistributionFormat.REEL),
    (Platform.FACEBOOK, DistributionFormat.REEL), (Platform.YOUTUBE, DistributionFormat.SHORT),
]
_LANDSCAPE_16X9_PROFILE_KEY = (Platform.YOUTUBE, DistributionFormat.LONG_FORM)

# Section 11: no platform publishes a real UI-chrome spec for a STATIC feed
# post the way it does for a Reel/Short (no scrolling caption bar overlaps
# a still image) -- inventing per-platform numbers here would violate "no
# mock data". A conservative, generic typographic margin is used instead,
# and callers are told so explicitly (see GetStudioSafeArea's `source`).
_GENERIC_STATIC_MARGIN_RATIO = 0.08

_SCENE_MS_LEAD = 3000
_SCENE_MS_BODY = 4000
_SCENE_MS_CLOSING = 2000


def _new_id() -> str:
    return str(uuid.uuid4())


def _image_clip(track: TrackType, placeholder_id: str, asset_id: str | None, duration_ms: int, start_ms: int) -> StudioClip:
    return StudioClip(
        id=_new_id(), track=track, start_ms=start_ms, duration_ms=duration_ms,
        source_placeholder_id=placeholder_id, asset_id=asset_id, transform=ClipTransform(),
    )


def _text_clip(text: str, duration_ms: int, start_ms: int) -> StudioClip:
    return StudioClip(id=_new_id(), track=TrackType.TEXT, start_ms=start_ms, duration_ms=duration_ms, text=text)


def _build_image_scenes(artifact) -> list[StudioScene]:
    feature = next((m for m in artifact.media_requirements if m.kind == MediaKind.FEATURE_IMAGE), None)
    clips: list[StudioClip] = []
    if feature is not None:
        clips.append(_image_clip(TrackType.IMAGE, feature.placeholder_id, feature.asset_id, _SCENE_MS_LEAD, 0))
    clips.append(_text_clip(artifact.title, _SCENE_MS_LEAD, 0))
    return [StudioScene(id=_new_id(), order=0, duration_ms=_SCENE_MS_LEAD, clips=clips)]


def _build_reel_scenes(artifact) -> list[StudioScene]:
    scenes: list[StudioScene] = []
    order = 0

    feature = next((m for m in artifact.media_requirements if m.kind == MediaKind.FEATURE_IMAGE), None)
    lead_clips: list[StudioClip] = []
    if feature is not None:
        lead_clips.append(_image_clip(TrackType.IMAGE, feature.placeholder_id, feature.asset_id, _SCENE_MS_LEAD, 0))
    lead_clips.append(_text_clip(artifact.title, _SCENE_MS_LEAD, 0))
    scenes.append(StudioScene(id=_new_id(), order=order, duration_ms=_SCENE_MS_LEAD, clips=lead_clips))
    order += 1

    context_text = artifact.subtitle or artifact.excerpt
    if context_text:
        scenes.append(StudioScene(
            id=_new_id(), order=order, duration_ms=_SCENE_MS_LEAD,
            clips=[_text_clip(context_text, _SCENE_MS_LEAD, 0)],
        ))
        order += 1

    body_by_placeholder = {
        m.placeholder_id: m for m in artifact.media_requirements if m.kind == MediaKind.BODY_IMAGE
    }
    # Section 29/4: real narrative order -- the same order the article
    # itself renders body images in, never a second guess at ordering.
    for placeholder_id in ordered_placeholder_ids(artifact.content_html):
        requirement = body_by_placeholder.get(placeholder_id)
        if requirement is None:
            continue
        clips = [_image_clip(TrackType.IMAGE, requirement.placeholder_id, requirement.asset_id, _SCENE_MS_BODY, 0)]
        if requirement.caption:
            clips.append(_text_clip(requirement.caption, _SCENE_MS_BODY, 0))
        scenes.append(StudioScene(id=_new_id(), order=order, duration_ms=_SCENE_MS_BODY, clips=clips))
        order += 1

    scenes.append(StudioScene(
        id=_new_id(), order=order, duration_ms=_SCENE_MS_CLOSING,
        clips=[StudioClip(id=_new_id(), track=TrackType.BRANDING, start_ms=0, duration_ms=_SCENE_MS_CLOSING)],
    ))
    return scenes


@dataclass
class CreateStudioProjectInput:
    source_artifact_id: str
    mode: StudioMode
    template_id: str | None = None
    format: CompositionFormat = CompositionFormat.REEL_9X16


class CreateStudioProject:
    """Section 1/3/28: the real "seleccionar noticia -> abrir Studio"
    entry point. Reads one real, already-PUBLISHED-or-later Artifact and
    maps its real fields into a first, fully editable scene/clip set --
    deterministic, no LLM call (section 15/16's AI Storyboard/Script is
    Phase 2). Never mutates the source Artifact."""

    def __init__(self, artifacts: ArtifactRepository, projects: StudioProjectRepository) -> None:
        self._artifacts = artifacts
        self._projects = projects

    def execute(self, input: CreateStudioProjectInput) -> StudioProject:
        artifact = self._artifacts.find_by_id(input.source_artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.source_artifact_id)

        template_id = input.template_id or (
            _DEFAULT_IMAGE_TEMPLATE_ID if input.mode == StudioMode.IMAGE else _DEFAULT_TEMPLATE_ID
        )
        if find_template(template_id) is None:
            raise NotFoundError("Template", template_id)

        if input.mode == StudioMode.IMAGE:
            scenes = _build_image_scenes(artifact)
        elif input.mode == StudioMode.REEL:
            scenes = _build_reel_scenes(artifact)
        else:
            scenes = []  # LIVE (Phase 4) -- no scene auto-seed exists yet

        now = datetime.now(timezone.utc)
        project = StudioProject(
            id=StudioProjectId.new(), source_artifact_id=input.source_artifact_id, mode=input.mode,
            template_id=template_id, format=input.format, status=StudioProjectStatus.DRAFT, version=1,
            scenes=scenes, created_at=now, updated_at=now, title=artifact.title,
        )
        self._projects.save(project)
        return project


class GetStudioProject:
    def __init__(self, projects: StudioProjectRepository) -> None:
        self._projects = projects

    def execute(self, project_id: str) -> StudioProject:
        project = self._projects.find_by_id(project_id)
        if project is None:
            raise NotFoundError("StudioProject", project_id)
        return project


@dataclass
class UpdateStudioProjectInput:
    project_id: str
    title: str | None = None
    template_id: str | None = None
    format: CompositionFormat | None = None
    status: StudioProjectStatus | None = None
    scenes: list[StudioScene] | None = None


class UpdateStudioProject:
    """The real autosave/edit path (Timeline drag/resize/trim/split,
    Inspector edits, TemplatePicker, FormatSwitcher all funnel here) --
    same "plain field patch, persisted immediately" precedent as
    UpdateArtifact."""

    def __init__(self, projects: StudioProjectRepository) -> None:
        self._projects = projects

    def execute(self, input: UpdateStudioProjectInput) -> StudioProject:
        project = self._projects.find_by_id(input.project_id)
        if project is None:
            raise NotFoundError("StudioProject", input.project_id)

        now = datetime.now(timezone.utc)
        if input.title is not None:
            project.title = input.title
        if input.template_id is not None:
            if find_template(input.template_id) is None:
                raise NotFoundError("Template", input.template_id)
            project.set_template(input.template_id, now)
        if input.format is not None:
            project.set_format(input.format, now)
        if input.status is not None:
            project.status = input.status
            project.updated_at = now
        if input.scenes is not None:
            project.replace_scenes(input.scenes, now)

        self._projects.save(project)
        return project


class ListStudioProjectVersions:
    def __init__(self, projects: StudioProjectRepository) -> None:
        self._projects = projects

    def execute(self, source_artifact_id: str) -> list[StudioProject]:
        return self._projects.list_versions_for_source(source_artifact_id)


class DuplicateStudioProject:
    """Section 21: "Guardar / Duplicar / Crear versión" -- never mutates
    or destroys the version it's duplicating from."""

    def __init__(self, projects: StudioProjectRepository) -> None:
        self._projects = projects

    def execute(self, project_id: str) -> StudioProject:
        source = self._projects.find_by_id(project_id)
        if source is None:
            raise NotFoundError("StudioProject", project_id)
        siblings = self._projects.list_versions_for_source(source.source_artifact_id)
        next_version = max((p.version for p in siblings), default=source.version) + 1
        now = datetime.now(timezone.utc)
        new_project = source.duplicate(StudioProjectId.new(), next_version, now)
        self._projects.save(new_project)
        return new_project


@dataclass(frozen=True)
class SafeAreaResult:
    format: CompositionFormat
    canvas_width: int
    canvas_height: int
    insets: EdgeInsets
    source: str  # human-readable, honest provenance of these numbers


def get_studio_safe_area(format: CompositionFormat) -> SafeAreaResult:
    """Section 11: real per-platform data where it exists (REEL_9X16 --
    the most conservative/largest inset per edge across every real 9:16
    profile already in distribution/safe_area.py, so content stays clear
    of ANY of those platforms' chrome, not just one; LANDSCAPE_16X9 --
    the real YouTube long-form profile, which is a full-bleed canvas).
    A generic, explicitly-labeled typographic margin for the two static
    formats that have no real published platform-chrome spec to read."""
    width, height = CANVAS_SIZE[format]

    if format == CompositionFormat.REEL_9X16:
        profiles = [DEFAULT_PROFILES[key] for key in _REEL_9X16_PROFILE_KEYS]
        insets = EdgeInsets(
            top=max(p.safe_area_insets.top for p in profiles),
            right=max(p.safe_area_insets.right for p in profiles),
            bottom=max(p.safe_area_insets.bottom for p in profiles),
            left=max(p.safe_area_insets.left for p in profiles),
        )
        source = "Real, sourced per-platform safe zones (TikTok/Instagram/Facebook Reels + YouTube Shorts) -- tightest common area across all four."
    elif format == CompositionFormat.LANDSCAPE_16X9:
        insets = DEFAULT_PROFILES[_LANDSCAPE_16X9_PROFILE_KEY].safe_area_insets
        source = "Real YouTube long-form profile -- no platform chrome overlays horizontal video."
    else:
        insets = EdgeInsets(
            top=height * _GENERIC_STATIC_MARGIN_RATIO, right=width * _GENERIC_STATIC_MARGIN_RATIO,
            bottom=height * _GENERIC_STATIC_MARGIN_RATIO, left=width * _GENERIC_STATIC_MARGIN_RATIO,
        )
        source = "Generic typographic margin (8% per edge) -- no platform publishes real UI-chrome data for a static feed post, so none is invented here."

    return SafeAreaResult(format=format, canvas_width=width, canvas_height=height, insets=insets, source=source)
