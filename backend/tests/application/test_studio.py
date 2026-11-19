"""Unit tests for NEXUS Studio's Phase 1 use cases, using in-memory test
doubles for the ports -- same pattern as test_artifact.py. The whole point
of these tests is proving CreateStudioProject builds a real, deterministic
scene/clip set straight from a real Artifact's own fields (title/subtitle/
excerpt/media_requirements/captions/content_html order) -- never inventing
narrative text, never guessing image order.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.domain.artifact.entities import Artifact, MediaKind, MediaRequirement, SeoMetadata
from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import ArtifactId, StoryId
from app.domain.studio.entities import CompositionFormat, StudioMode, TrackType
from app.domain.studio.templates import PREMIUM_EDITORIAL_ACCENTS, find_template
from app.application.use_cases.studio import (
    CreateStudioProject, CreateStudioProjectInput, DuplicateStudioProject, GetStudioProject,
    ListStudioProjectVersions, UpdateStudioProject, UpdateStudioProjectInput, get_studio_safe_area,
)


class InMemoryArtifactRepo:
    def __init__(self):
        self.items = {}

    def find_by_id(self, artifact_id):
        return self.items.get(artifact_id)

    def save(self, artifact):
        self.items[str(artifact.id)] = artifact


class InMemoryStudioProjectRepo:
    def __init__(self):
        self.items = {}

    def find_by_id(self, project_id):
        return self.items.get(project_id)

    def list_versions_for_source(self, source_artifact_id):
        matches = [p for p in self.items.values() if p.source_artifact_id == source_artifact_id]
        return sorted(matches, key=lambda p: p.version, reverse=True)

    def save(self, project):
        self.items[str(project.id)] = project


def _artifact(subtitle="El presidente confirmó...", excerpt="La Fuerza Aérea confirmó...", content_html_order=("BODY_IMAGE_02", "BODY_IMAGE_01")):
    """A real-shaped Artifact: one FEATURE_IMAGE + two BODY_IMAGEs declared
    in one order (01 then 02) but embedded in content_html in the OPPOSITE
    order -- proves CreateStudioProject follows real document order, not
    declaration order."""
    content_html = (
        f'<article><p>intro</p>'
        f'<figure data-placeholder-id="{content_html_order[0]}"><img/></figure>'
        f'<p>middle</p>'
        f'<figure data-placeholder-id="{content_html_order[1]}"><img/></figure>'
        f'</article>'
    )
    media_requirements = [
        MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="", asset_id="asset-feature"),
        MediaRequirement(
            placeholder_id="BODY_IMAGE_01", kind=MediaKind.BODY_IMAGE, prompt="", asset_id="asset-1",
            caption="Unidades de la Fuerza Aérea rastrearon la zona.",
        ),
        MediaRequirement(placeholder_id="BODY_IMAGE_02", kind=MediaKind.BODY_IMAGE, prompt="", asset_id="asset-2"),
    ]
    return Artifact.draft(
        artifact_id=ArtifactId.new(), story_id=StoryId.new(), version=1,
        title="Confirman muerte de los cinco ocupantes de avioneta desaparecida",
        subtitle=subtitle, excerpt=excerpt, summary="s", content_html=content_html, category_id="cat-sociedad",
        tags=["avioneta"], entities=[], seo=SeoMetadata(seo_title="t", seo_description="d", slug="confirman-muerte"),
        sources=[], claims=[], media_requirements=media_requirements, created_at=datetime.now(timezone.utc),
    )


def test_create_reel_project_orders_body_images_by_real_document_order_not_declaration_order():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact()
    artifacts.save(artifact)
    projects = InMemoryStudioProjectRepo()
    use_case = CreateStudioProject(artifacts, projects)

    project = use_case.execute(CreateStudioProjectInput(
        source_artifact_id=str(artifact.id), mode=StudioMode.REEL,
    ))

    image_scenes = [
        s for s in project.scenes
        if any(c.track == TrackType.IMAGE and c.source_placeholder_id and c.source_placeholder_id.startswith("BODY_IMAGE") for c in s.clips)
    ]
    assert [c.source_placeholder_id for s in image_scenes for c in s.clips if c.track == TrackType.IMAGE] == [
        "BODY_IMAGE_02", "BODY_IMAGE_01",
    ]
    # BODY_IMAGE_01 has a real caption -> gets a TEXT clip too; BODY_IMAGE_02 doesn't -> image-only scene.
    scene_02, scene_01 = image_scenes
    assert not any(c.track == TrackType.TEXT for c in scene_02.clips)
    text_clips = [c for c in scene_01.clips if c.track == TrackType.TEXT]
    assert len(text_clips) == 1
    assert text_clips[0].text == "Unidades de la Fuerza Aérea rastrearon la zona."


def test_create_reel_project_lead_scene_uses_real_feature_image_and_title():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact()
    artifacts.save(artifact)
    project = CreateStudioProject(artifacts, InMemoryStudioProjectRepo()).execute(
        CreateStudioProjectInput(source_artifact_id=str(artifact.id), mode=StudioMode.REEL)
    )
    lead = project.scenes[0]
    image_clip = next(c for c in lead.clips if c.track == TrackType.IMAGE)
    text_clip = next(c for c in lead.clips if c.track == TrackType.TEXT)
    assert image_clip.asset_id == "asset-feature"
    assert image_clip.source_placeholder_id == "FEATURE_IMAGE"
    assert text_clip.text == artifact.title


def test_create_reel_project_context_scene_prefers_subtitle_over_excerpt():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact(subtitle="El subtítulo real", excerpt="El excerpt real")
    artifacts.save(artifact)
    project = CreateStudioProject(artifacts, InMemoryStudioProjectRepo()).execute(
        CreateStudioProjectInput(source_artifact_id=str(artifact.id), mode=StudioMode.REEL)
    )
    assert project.template_id == "nexus_editorial"
    context_scene = project.scenes[1]
    assert context_scene.clips[0].text == "El subtítulo real"


def test_create_reel_project_omits_context_scene_when_no_subtitle_or_excerpt():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact(subtitle=None, excerpt="")
    artifacts.save(artifact)
    project = CreateStudioProject(artifacts, InMemoryStudioProjectRepo()).execute(
        CreateStudioProjectInput(source_artifact_id=str(artifact.id), mode=StudioMode.REEL)
    )
    # Lead scene, then straight to body-image scenes -- no fabricated context text.
    assert not any(
        c.track == TrackType.TEXT and c.text not in (artifact.title, "Unidades de la Fuerza Aérea rastrearon la zona.")
        for s in project.scenes for c in s.clips
    )


def test_create_reel_project_ends_with_branding_scene():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact()
    artifacts.save(artifact)
    project = CreateStudioProject(artifacts, InMemoryStudioProjectRepo()).execute(
        CreateStudioProjectInput(source_artifact_id=str(artifact.id), mode=StudioMode.REEL)
    )
    closing = project.scenes[-1]
    assert any(c.track == TrackType.BRANDING for c in closing.clips)


def test_create_image_project_has_one_scene_with_feature_image_and_title():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact()
    artifacts.save(artifact)
    project = CreateStudioProject(artifacts, InMemoryStudioProjectRepo()).execute(
        CreateStudioProjectInput(source_artifact_id=str(artifact.id), mode=StudioMode.IMAGE)
    )
    assert len(project.scenes) == 1
    assert project.template_id == "nexus_editorial_premium_red"
    assert any(c.track == TrackType.IMAGE and c.asset_id == "asset-feature" for c in project.scenes[0].clips)
    assert any(c.track == TrackType.TEXT and c.text == artifact.title for c in project.scenes[0].clips)


def test_premium_editorial_presets_use_the_configured_single_accent_tokens():
    variants = {
        "nexus_editorial_premium_red": "red",
        "nexus_editorial_premium_purple": "purple",
        "nexus_editorial_premium_green": "green",
    }

    for template_id, accent in variants.items():
        template = find_template(template_id)
        assert template is not None
        assert template.accent_color == PREMIUM_EDITORIAL_ACCENTS[accent]
        assert template.latest_version.elements


def test_create_project_unknown_artifact_raises_not_found():
    use_case = CreateStudioProject(InMemoryArtifactRepo(), InMemoryStudioProjectRepo())
    with pytest.raises(NotFoundError):
        use_case.execute(CreateStudioProjectInput(source_artifact_id="missing", mode=StudioMode.REEL))


def test_create_project_unknown_template_raises_not_found():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact()
    artifacts.save(artifact)
    use_case = CreateStudioProject(artifacts, InMemoryStudioProjectRepo())
    with pytest.raises(NotFoundError):
        use_case.execute(CreateStudioProjectInput(
            source_artifact_id=str(artifact.id), mode=StudioMode.REEL, template_id="does-not-exist",
        ))


def test_get_studio_project_not_found():
    with pytest.raises(NotFoundError):
        GetStudioProject(InMemoryStudioProjectRepo()).execute("missing")


def test_update_studio_project_patches_title_template_and_format():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact()
    artifacts.save(artifact)
    projects = InMemoryStudioProjectRepo()
    project = CreateStudioProject(artifacts, projects).execute(
        CreateStudioProjectInput(source_artifact_id=str(artifact.id), mode=StudioMode.IMAGE)
    )

    updated = UpdateStudioProject(projects).execute(UpdateStudioProjectInput(
        project_id=str(project.id), title="Nuevo título", template_id="nexus_breaking",
        format=CompositionFormat.SQUARE_1X1,
    ))

    assert updated.title == "Nuevo título"
    assert updated.template_id == "nexus_breaking"
    assert updated.format == CompositionFormat.SQUARE_1X1
    # Persisted, not just returned in memory.
    assert projects.find_by_id(str(project.id)).title == "Nuevo título"


def test_duplicate_studio_project_increments_version_and_preserves_original():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact()
    artifacts.save(artifact)
    projects = InMemoryStudioProjectRepo()
    v1 = CreateStudioProject(artifacts, projects).execute(
        CreateStudioProjectInput(source_artifact_id=str(artifact.id), mode=StudioMode.IMAGE)
    )

    v2 = DuplicateStudioProject(projects).execute(str(v1.id))

    assert v2.version == 2
    assert v2.parent_project_id == str(v1.id)
    assert projects.find_by_id(str(v1.id)).version == 1  # original untouched

    versions = ListStudioProjectVersions(projects).execute(str(artifact.id))
    assert [p.version for p in versions] == [2, 1]  # newest first


def test_get_studio_safe_area_reel_9x16_uses_tightest_common_area_across_real_profiles():
    result = get_studio_safe_area(CompositionFormat.REEL_9X16)
    assert (result.canvas_width, result.canvas_height) == (1080, 1920)
    # Real, sourced per-platform maxima (TikTok/Instagram/Facebook Reels + YouTube Shorts).
    assert result.insets.top == 288
    assert result.insets.right == 192
    assert result.insets.bottom == 672
    assert result.insets.left == 65


def test_get_studio_safe_area_landscape_16x9_is_full_bleed():
    result = get_studio_safe_area(CompositionFormat.LANDSCAPE_16X9)
    assert (result.canvas_width, result.canvas_height) == (1920, 1080)
    assert (result.insets.top, result.insets.right, result.insets.bottom, result.insets.left) == (0, 0, 0, 0)


def test_get_studio_safe_area_static_formats_use_generic_margin_not_invented_platform_data():
    for format in (CompositionFormat.FEED_4X5, CompositionFormat.SQUARE_1X1):
        result = get_studio_safe_area(format)
        width, height = result.canvas_width, result.canvas_height
        assert result.insets.top == pytest.approx(height * 0.08)
        assert result.insets.left == pytest.approx(width * 0.08)
        assert "generic" in result.source.lower() or "no platform" in result.source.lower()
