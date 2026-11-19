"""Pydantic response/request DTOs. Domain entities never cross the HTTP
boundary directly — every response is built through one of these."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Every response DTO serializes as camelCase over the wire (the
    frontend's existing convention) while staying snake_case in Python."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class NewsOut(CamelModel):
    id: str
    headline: str
    summary: str | None
    category: str | None
    source: str | None
    source_url: str | None
    ingested_at: str
    legacy_web_status: str | None


class DiscoveryReasonOut(CamelModel):
    factor: str
    weight: float
    explanation: str


class NewsRankingItemOut(CamelModel):
    """The Command Center's simple recency+category re-ranking over
    existing `news` rows (GET /api/discovery/today) -- kept distinct from
    DiscoveryItemOut (the real Discovery bounded context) on purpose,
    see app/application/use_cases/get_discovery_today.py's own docstring."""
    news_id: str
    headline: str
    category: str | None
    score: float
    reasons: list[DiscoveryReasonOut]


class StoryOut(CamelModel):
    id: str
    headline: str
    summary: str | None
    status: str
    category_ids: list[str]
    source_count: int


class ProductionStageOut(CamelModel):
    id: str
    label: str
    done: bool
    detail: str | None


class ProductionOut(CamelModel):
    id: str
    story_id: str
    status: str
    stages: list[ProductionStageOut]
    progress: float
    errors: list[str]
    started_at: str
    completed_at: str | None


class ActiveProductionItemOut(CamelModel):
    production: ProductionOut
    story_headline: str | None


class ActiveProductionsOut(CamelModel):
    items: list[ActiveProductionItemOut]


class CompositionShotOut(CamelModel):
    shot_id: str
    scene_id: str
    disposition: str
    duration_seconds: float
    asset_refs: list[str]


class CompositionContentOut(CamelModel):
    angle: str | None
    hook: str | None
    script: list[dict]
    narrative_summary: str | None
    media_summary: str | None
    asset_refs: list[str]
    final_asset_url: str | None
    shots: list[CompositionShotOut]


class CompositionOut(CamelModel):
    id: str
    story_id: str
    production_id: str
    kind: str
    status: str
    content: CompositionContentOut
    target_platforms: list[str]


class DistributionPlanOut(CamelModel):
    id: str
    composition_id: str
    platform: str
    format: str
    status: str
    copy: str | None
    publication_url: str | None
    failure_reason: str | None


class StoryWorkspaceOut(CamelModel):
    story: StoryOut
    production: ProductionOut | None
    compositions: list[CompositionOut]
    distribution_plans: dict[str, list[DistributionPlanOut]]


class ProduceStoryRequest(CamelModel):
    news_id: str | None = None


class ReviewCompositionRequest(CamelModel):
    decision: str
    reason: str | None = None


class PrepareDistributionRequest(CamelModel):
    platforms: list[str]
    copy: str | None = None


class TopicOut(CamelModel):
    id: str
    name: str
    slug: str


class CategoryOut(CamelModel):
    id: str
    name: str
    slug: str
    sort_order: int
    active: bool
    topics: list[TopicOut]


class CategoryGroupOut(CamelModel):
    id: str
    name: str
    slug: str
    sort_order: int
    active: bool
    categories: list[CategoryOut]


class SeoSettingsOut(CamelModel):
    site_title: str
    meta_description: str
    keywords: list[str]


class UpdateSeoSettingsRequest(CamelModel):
    site_title: str
    meta_description: str
    keywords: list[str]


class AdBannerOut(CamelModel):
    id: str
    position: str
    image_url: str
    link_url: str
    alt_text: str
    width: int
    height: int
    active: bool
    created_at: str


class UpdateAdBannerRequest(CamelModel):
    link_url: str | None = None
    alt_text: str | None = None
    active: bool | None = None


class TriggerDiscoveryRequest(CamelModel):
    max_sources: int | None = None
    max_items: int | None = None


class DiscoveryJobOut(CamelModel):
    id: str
    status: str
    params: dict
    created_at: str
    started_at: str | None
    finished_at: str | None
    items_found: int | None
    error: str | None


class ReportDiscoveryJobStatusRequest(CamelModel):
    status: str
    items_found: int | None = None
    item_ids: list[str] | None = None
    error: str | None = None


class MaterialReferenceOut(CamelModel):
    kind: str
    url: str
    usable_as_final_asset: bool | None
    editorial_prompt: str | None


class DiscoveryScoresOut(CamelModel):
    freshness_score: float | None
    relevance_score: float | None
    impact_score: float | None
    source_quality_score: float | None
    completeness_score: float | None
    material_score: float | None
    duplicate_of: str | None


class DiscoveryItemOut(CamelModel):
    id: str
    source_url: str
    original_url: str
    original_title: str
    raw_text: str
    source_name: str | None
    source_domain: str
    author: str | None
    language: str | None
    category_id: str | None
    topics: list[str]
    published_at: str | None
    discovered_at: str
    materials: list[MaterialReferenceOut]
    scores: DiscoveryScoresOut
    status: str
    story_id: str | None
    assigned_to: str | None = None


class DecideDiscoveryItemRequest(CamelModel):
    decision: str


class AssignDiscoveryItemRequest(CamelModel):
    assignee: str | None


class TriggerArtifactRequest(CamelModel):
    story_id: str
    provider: str | None = None  # explicit provider choice, or "auto"/omitted


class ArtifactJobOut(CamelModel):
    id: str
    story_id: str
    status: str
    created_at: str
    started_at: str | None
    finished_at: str | None
    artifact_id: str | None
    error: str | None
    provider: str | None = None
    model: str | None = None
    validation_ok: bool | None = None
    validation_issue_count: int | None = None


class SeoMetadataOut(CamelModel):
    seo_title: str
    seo_description: str
    slug: str
    canonical_url: str | None


class SourceReferenceOut(CamelModel):
    source_url: str
    source_name: str | None
    source_domain: str
    author: str | None
    published_at: str | None
    retrieved_at: str
    license_info: str | None
    role: str = "PRIMARY"


class ClaimOut(CamelModel):
    id: str
    text: str
    label: str
    source_urls: list[str]
    reviewed: bool = False


class MediaRequirementOut(CamelModel):
    placeholder_id: str
    kind: str
    prompt: str
    asset_id: str | None
    asset_url: str | None = None
    external_url: str | None = None
    caption: str | None = None
    alt_text: str | None = None
    # Real provenance surfaced from the Asset row this requirement points
    # at (see mappers.artifact_out) -- "AI_GENERATED:<provider>:<model>" or
    # "HUMAN_UPLOADED", never invented when there's no asset yet.
    asset_provenance: str | None = None


class ValidationIssueOut(CamelModel):
    check: str
    detail: str
    severity: str = "BLOCKING"


class ArtifactOut(CamelModel):
    id: str
    story_id: str
    version: int
    status: str
    title: str
    subtitle: str | None
    excerpt: str
    summary: str
    content_html: str
    category_id: str | None
    tags: list[str]
    entities: list[str]
    seo: SeoMetadataOut
    sources: list[SourceReferenceOut]
    claims: list[ClaimOut]
    media_requirements: list[MediaRequirementOut]
    validation_issues: list[ValidationIssueOut]
    editorial_notes: str | None
    created_at: str
    published_news_id: str | None = None
    published_at: str | None = None
    scheduled_at: str | None = None


class ReviewArtifactRequest(CamelModel):
    decision: str
    reason: str | None = None


class UpdateArtifactRequest(CamelModel):
    """Partial patch -- the Revisión workspace's real autosave body. Only
    fields actually present in the JSON are applied (see
    exclude_unset=True in the route). `entities` remain generation-derived;
    editorial summary is editable and persists through the same patch."""
    title: str | None = None
    subtitle: str | None = None
    excerpt: str | None = None
    summary: str | None = None
    content_html: str | None = None
    category_id: str | None = None
    tags: list[str] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    slug: str | None = None
    canonical_url: str | None = None
    save_as_draft: bool = False


class ScheduleArtifactRequest(CamelModel):
    scheduled_at: datetime


class MarkClaimReviewedRequest(CamelModel):
    reviewed: bool = True
    # Set only when accepting a real ProposeClaimResolution proposal.
    label: str | None = None
    source_urls: list[str] | None = None


class UpdateMediaPromptRequest(CamelModel):
    prompt: str | None = None
    caption: str | None = None
    alt_text: str | None = None
    # Explicit flags -- distinguishes "field not sent" from "sent as
    # null/empty" for caption/alt_text, the same real tri-state concern
    # Artifact.update_media_prompt's own sentinel handles domain-side.
    clear_caption: bool = False
    clear_alt_text: bool = False


class AddMediaRequirementRequest(CamelModel):
    kind: str  # "BODY_IMAGE" | "VIDEO" -- never FEATURE_IMAGE (see Artifact.add_media_requirement)


class ProposeSeoFixRequest(CamelModel):
    field: str  # "title" | "seo_title" | "seo_description"
    provider: str | None = None
    instruction: str | None = None


class ProposeSeoFixResponseOut(CamelModel):
    """A real PROPOSAL -- never persisted by this response. See
    ProposeSeoFixOutput/ProposeSeoFix for the real, single Provider
    Control Plane call this comes from."""
    field: str
    value: str
    reason: str
    character_count: int
    min_length: int | None
    max_length: int
    provider: str
    model: str | None


class ProposeClaimResolutionResponseOut(CamelModel):
    """A real PROPOSAL -- never persisted by this response. Accepting it
    reuses POST .../claims/{id}/review (MarkClaimReviewedRequest's
    label/sourceUrls) -- no parallel write path."""
    claim_id: str
    label: str
    reason: str
    source_urls: list[str]
    provider: str
    model: str | None


class MediaGenerationJobOut(CamelModel):
    id: str
    artifact_id: str
    placeholder_id: str
    status: str
    created_at: str
    started_at: str | None
    finished_at: str | None
    asset_id: str | None
    error: str | None


class PublishedContentOut(CamelModel):
    id: str
    title: str
    subtitle: str | None
    slug: str
    excerpt: str | None
    summary: str | None
    content: str
    category: str | None
    tags: list[str]
    image_url: str | None
    author: str | None
    source_name: str | None
    source_url: str | None
    published_at: str | None
    updated_at: str | None


class ProviderOut(CamelModel):
    """Real, live-checked state -- id/kind/label are static, everything
    else comes from a real check_status() call. `has_stored_key` is the
    ONLY signal about a secret -- the raw key is never in this or any
    other response."""
    id: str
    label: str
    kind: str
    status: str
    detail: str | None
    version: str | None
    checked_at: str
    is_default: bool
    has_stored_key: bool


class SetDefaultProviderRequest(CamelModel):
    provider_id: str


class SetProviderApiKeyRequest(CamelModel):
    api_key: str


class ErrorOut(CamelModel):
    error: str
    message: str
    relation: str | None = None


# ── NEXUS Studio ──────────────────────────────────────────────────────────

class ClipTransformOut(CamelModel):
    x: float
    y: float
    scale: float
    rotation: float
    opacity: float
    focal_x: float
    focal_y: float


class StudioClipOut(CamelModel):
    id: str
    track: str
    start_ms: int
    duration_ms: int
    source_placeholder_id: str | None
    asset_id: str | None
    asset_url: str | None = None
    text: str | None
    transform: ClipTransformOut
    locked: bool
    muted: bool
    hidden: bool


class StudioSceneOut(CamelModel):
    id: str
    order: int
    duration_ms: int
    clips: list[StudioClipOut]


class StudioProjectOut(CamelModel):
    id: str
    source_artifact_id: str
    mode: str
    template_id: str
    format: str
    status: str
    version: int
    parent_project_id: str | None
    title: str
    scenes: list[StudioSceneOut]
    total_duration_ms: int
    created_at: str
    updated_at: str


class CreateStudioProjectRequest(CamelModel):
    source_artifact_id: str
    mode: str
    template_id: str | None = None
    format: str = "REEL_9X16"


class ClipTransformIn(CamelModel):
    x: float = 0.0
    y: float = 0.0
    scale: float = 1.0
    rotation: float = 0.0
    opacity: float = 1.0
    focal_x: float = 0.5
    focal_y: float = 0.5


class StudioClipIn(CamelModel):
    id: str
    track: str
    start_ms: int
    duration_ms: int
    source_placeholder_id: str | None = None
    asset_id: str | None = None
    text: str | None = None
    transform: ClipTransformIn = ClipTransformIn()
    locked: bool = False
    muted: bool = False
    hidden: bool = False


class StudioSceneIn(CamelModel):
    id: str
    order: int
    duration_ms: int
    clips: list[StudioClipIn]


class UpdateStudioProjectRequest(CamelModel):
    title: str | None = None
    template_id: str | None = None
    format: str | None = None
    status: str | None = None
    scenes: list[StudioSceneIn] | None = None


class StudioProjectVersionsResponse(CamelModel):
    versions: list[StudioProjectOut]


class TemplateElementOut(CamelModel):
    id: str
    kind: str
    track: str
    x: float
    y: float
    width: float
    height: float
    font_role: str | None
    color_role: str | None
    z_index: int


class TemplateSafeAreaOut(CamelModel):
    top: float
    right: float
    bottom: float
    left: float


class TemplateVersionOut(CamelModel):
    version: int
    elements: list[TemplateElementOut]
    safe_area: TemplateSafeAreaOut


class TemplateOut(CamelModel):
    id: str
    name: str
    description: str
    accent_color: str
    latest_version: TemplateVersionOut


class TemplatesResponse(CamelModel):
    templates: list[TemplateOut]


class EdgeInsetsOut(CamelModel):
    top: float
    right: float
    bottom: float
    left: float


class SafeAreaOut(CamelModel):
    format: str
    canvas_width: int
    canvas_height: int
    insets: EdgeInsetsOut  # pixels, not a fraction of canvas (unlike TemplateSafeAreaOut)
    source: str
