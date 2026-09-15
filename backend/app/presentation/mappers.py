from __future__ import annotations

from app.domain.news.entities import News
from app.domain.story.entities import Story
from app.domain.production.entities import Production
from app.domain.composition.entities import Composition
from app.domain.distribution.entities import DistributionPlan
from app.domain.category.entities import CategoryGroup
from app.domain.settings.entities import SiteSeoSettings
from app.domain.discovery.entities import DiscoveryItem, DiscoveryJob
from app.application.use_cases.get_discovery_today import NewsRankingItem
from app.application.use_cases.list_news import NewsWorkspace, NewsWorkspaceItem
from app.application.use_cases.get_story_workspace import StoryWorkspace
from app.presentation.schemas import (
    NewsOut, NewsWorkspaceItemOut, NewsWorkspaceOut, NewsRankingItemOut, DiscoveryReasonOut,
    StoryOut, ProductionOut, ProductionStageOut, CompositionOut, CompositionContentOut, CompositionShotOut,
    DistributionPlanOut, StoryWorkspaceOut, CategoryGroupOut, CategoryOut, TopicOut,
    ActiveProductionItemOut, SeoSettingsOut,
    DiscoveryJobOut, DiscoveryItemOut, MaterialReferenceOut, DiscoveryScoresOut,
)


def news_out(news: News) -> NewsOut:
    return NewsOut(
        id=str(news.id), headline=news.headline, summary=news.summary, category=news.category,
        source=news.provenance.source_name, source_url=news.provenance.source_url,
        ingested_at=news.ingested_at.isoformat(), legacy_web_status=news.legacy_web_status,
    )


def news_workspace_item_out(item: NewsWorkspaceItem) -> NewsWorkspaceItemOut:
    return NewsWorkspaceItemOut(
        news=news_out(item.news), bucket=item.bucket.value, story_id=item.story_id, story_status=item.story_status,
    )


def news_workspace_out(workspace: NewsWorkspace) -> NewsWorkspaceOut:
    return NewsWorkspaceOut(items=[news_workspace_item_out(i) for i in workspace.items], counts=workspace.counts)


def news_ranking_item_out(item: NewsRankingItem) -> NewsRankingItemOut:
    return NewsRankingItemOut(
        news_id=item.news_id, headline=item.headline, category=item.category, score=item.score,
        reasons=[DiscoveryReasonOut(factor=r.factor, weight=r.weight, explanation=r.explanation) for r in item.reasons],
    )


def story_out(story: Story) -> StoryOut:
    return StoryOut(
        id=str(story.id), headline=story.headline, summary=story.summary, status=story.status.value,
        category_ids=story.category_ids, source_count=len(story.sources),
    )


def production_out(production: Production) -> ProductionOut:
    return ProductionOut(
        id=str(production.id), story_id=str(production.story_id), status=production.status.value,
        stages=[ProductionStageOut(id=s.id, label=s.label, done=s.done, detail=s.detail) for s in production.stages],
        progress=production.progress, errors=production.errors,
        started_at=production.started_at.isoformat(),
        completed_at=production.completed_at.isoformat() if production.completed_at else None,
    )


def active_production_item_out(item) -> ActiveProductionItemOut:
    return ActiveProductionItemOut(production=production_out(item.production), story_headline=item.story_headline)


def composition_out(composition: Composition, storage) -> CompositionOut:
    c = composition.content
    final_url = None
    if c.final_asset_ref:
        final_url = storage.resolve_url(f"{composition.story_id}/{c.final_asset_ref}")
    return CompositionOut(
        id=str(composition.id), story_id=str(composition.story_id), production_id=str(composition.production_id),
        kind=composition.kind.value, status=composition.status.value,
        content=CompositionContentOut(
            angle=c.angle, hook=c.hook, script=[{"section": s.section, "text": s.text} for s in c.script],
            narrative_summary=c.narrative_summary, media_summary=c.media_summary,
            asset_refs=c.asset_refs, final_asset_url=final_url,
            shots=[
                CompositionShotOut(
                    shot_id=s.shot_id, scene_id=s.scene_id, disposition=s.disposition,
                    duration_seconds=s.duration_seconds, asset_refs=s.asset_refs,
                )
                for s in c.shots
            ],
        ),
        target_platforms=composition.target_platforms,
    )


def distribution_plan_out(plan: DistributionPlan) -> DistributionPlanOut:
    return DistributionPlanOut(
        id=str(plan.id), composition_id=str(plan.composition_id), platform=plan.platform.value,
        format=plan.format.value, status=plan.status.value, copy=plan.copy,
        publication_url=plan.publication_url, failure_reason=plan.failure_reason,
    )


def story_workspace_out(workspace: StoryWorkspace, storage) -> StoryWorkspaceOut:
    return StoryWorkspaceOut(
        story=story_out(workspace.story),
        production=production_out(workspace.production) if workspace.production else None,
        compositions=[composition_out(c, storage) for c in workspace.compositions],
        distribution_plans={
            key: [distribution_plan_out(p) for p in plans] for key, plans in workspace.distribution_plans.items()
        },
    )


def category_group_out(group: CategoryGroup) -> CategoryGroupOut:
    return CategoryGroupOut(
        id=group.id, name=group.name, slug=group.slug, sort_order=group.sort_order, active=group.active,
        categories=[
            CategoryOut(
                id=c.id, name=c.name, slug=c.slug, sort_order=c.sort_order, active=c.active,
                topics=[TopicOut(id=t.id, name=t.name, slug=t.slug) for t in c.topics],
            )
            for c in group.categories
        ],
    )


def seo_settings_out(settings: SiteSeoSettings) -> SeoSettingsOut:
    return SeoSettingsOut(
        site_title=settings.site_title, meta_description=settings.meta_description, keywords=settings.keywords,
    )


def discovery_job_out(job: DiscoveryJob) -> DiscoveryJobOut:
    return DiscoveryJobOut(
        id=job.id, status=job.status.value, params=job.params, created_at=job.created_at.isoformat(),
        started_at=job.started_at.isoformat() if job.started_at else None,
        finished_at=job.finished_at.isoformat() if job.finished_at else None,
        items_found=job.items_found, error=job.error,
    )


def discovery_item_out(item: DiscoveryItem) -> DiscoveryItemOut:
    return DiscoveryItemOut(
        id=str(item.id), source_url=item.source_url, original_url=item.original_url,
        original_title=item.original_title, raw_text=item.raw_text, source_name=item.source_name,
        source_domain=item.source_domain, author=item.author, language=item.language,
        category_id=item.category_id, topics=item.topics,
        published_at=item.published_at.isoformat() if item.published_at else None,
        discovered_at=item.discovered_at.isoformat(),
        materials=[
            MaterialReferenceOut(
                kind=m.kind.value, url=m.url, usable_as_final_asset=m.usable_as_final_asset,
                editorial_prompt=m.editorial_prompt,
            )
            for m in item.materials
        ],
        scores=DiscoveryScoresOut(
            freshness_score=item.scores.freshness_score, relevance_score=item.scores.relevance_score,
            impact_score=item.scores.impact_score, source_quality_score=item.scores.source_quality_score,
            completeness_score=item.scores.completeness_score, material_score=item.scores.material_score,
            duplicate_of=item.scores.duplicate_of,
        ),
        status=item.status.value, story_id=str(item.story_id) if item.story_id else None,
    )
