"""Pydantic response/request DTOs. Domain entities never cross the HTTP
boundary directly — every response is built through one of these."""
from __future__ import annotations

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


class NewsWorkspaceItemOut(CamelModel):
    news: NewsOut
    bucket: str
    story_id: str | None
    story_status: str | None


class NewsWorkspaceOut(CamelModel):
    items: list[NewsWorkspaceItemOut]
    counts: dict[str, int]


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


class ConvertToContentOut(CamelModel):
    story_id: str
    production_id: str
    already_existed: bool


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


class PrepareContentRequest(CamelModel):
    pass


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


class DecideDiscoveryItemRequest(CamelModel):
    decision: str


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


class ClaimOut(CamelModel):
    text: str
    label: str
    source_urls: list[str]


class MediaRequirementOut(CamelModel):
    placeholder_id: str
    kind: str
    prompt: str
    asset_id: str | None
    asset_url: str | None = None


class ValidationIssueOut(CamelModel):
    check: str
    detail: str


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


class ReviewArtifactRequest(CamelModel):
    decision: str
    reason: str | None = None


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
