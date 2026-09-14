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


class DiscoveryItemOut(CamelModel):
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


class CompositionContentOut(CamelModel):
    angle: str | None
    hook: str | None
    script: list[dict]
    narrative_summary: str | None
    media_summary: str | None
    asset_refs: list[str]
    final_asset_url: str | None


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


class ErrorOut(CamelModel):
    error: str
    message: str
    relation: str | None = None
