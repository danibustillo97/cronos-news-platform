from __future__ import annotations

from app.domain.news.entities import News
from app.domain.story.entities import Story
from app.domain.production.entities import Production
from app.domain.composition.entities import Composition
from app.domain.distribution.entities import DistributionPlan
from app.domain.category.entities import CategoryGroup
from app.domain.settings.entities import SiteSeoSettings
from app.domain.discovery.entities import DiscoveryItem, DiscoveryJob
from app.domain.artifact.entities import Artifact, ArtifactJob, ProviderId
from app.domain.asset.entities import MediaGenerationJob
from app.domain.publication.entities import PublishedContent
from app.domain.ads.entities import AdBanner
from app.domain.studio.entities import StudioProject
from app.domain.studio.templates import TemplatePreset
from app.application.use_cases.studio import SafeAreaResult
from app.application.use_cases.get_discovery_today import NewsRankingItem
from app.application.use_cases.get_story_workspace import StoryWorkspace
from app.presentation.schemas import (
    NewsOut, NewsRankingItemOut, DiscoveryReasonOut,
    StoryOut, ProductionOut, ProductionStageOut, CompositionOut, CompositionContentOut, CompositionShotOut,
    DistributionPlanOut, StoryWorkspaceOut, CategoryGroupOut, CategoryOut, TopicOut,
    ActiveProductionItemOut, SeoSettingsOut,
    DiscoveryJobOut, DiscoveryItemOut, MaterialReferenceOut, DiscoveryScoresOut,
    ArtifactJobOut, ArtifactOut, SeoMetadataOut, SourceReferenceOut, ClaimOut, MediaRequirementOut, ValidationIssueOut,
    MediaGenerationJobOut, PublishedContentOut, ProviderOut, AdBannerOut,
    StudioProjectOut, StudioSceneOut, StudioClipOut, ClipTransformOut,
    TemplateOut, TemplateVersionOut, TemplateElementOut, TemplateSafeAreaOut, SafeAreaOut, EdgeInsetsOut,
)


def news_out(news: News) -> NewsOut:
    return NewsOut(
        id=str(news.id), headline=news.headline, summary=news.summary, category=news.category,
        source=news.provenance.source_name, source_url=news.provenance.source_url,
        ingested_at=news.ingested_at.isoformat(), legacy_web_status=news.legacy_web_status,
    )


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


def ad_banner_out(banner: AdBanner) -> AdBannerOut:
    return AdBannerOut(
        id=banner.id, position=banner.position, image_url=banner.image_url, link_url=banner.link_url,
        alt_text=banner.alt_text, width=banner.width, height=banner.height, active=banner.active,
        created_at=banner.created_at.isoformat(),
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
        status=item.status.value,         story_id=str(item.story_id) if item.story_id else None,
        assigned_to=item.assigned_to,
    )


def artifact_job_out(job: ArtifactJob) -> ArtifactJobOut:
    return ArtifactJobOut(
        id=job.id, story_id=str(job.story_id), status=job.status.value, created_at=job.created_at.isoformat(),
        started_at=job.started_at.isoformat() if job.started_at else None,
        finished_at=job.finished_at.isoformat() if job.finished_at else None,
        artifact_id=job.artifact_id, error=job.error, provider=job.provider, model=job.model,
        validation_ok=job.validation_ok, validation_issue_count=job.validation_issue_count,
    )


_PROVIDER_LABELS = {ProviderId.ANTHROPIC: "Anthropic", ProviderId.CLAUDE_CODE: "Claude Code"}
_PROVIDER_KINDS = {ProviderId.ANTHROPIC: "API", ProviderId.CLAUDE_CODE: "CLI"}


def provider_out(summary) -> ProviderOut:
    check = summary.check
    return ProviderOut(
        id=check.provider_id.value, label=_PROVIDER_LABELS[check.provider_id], kind=_PROVIDER_KINDS[check.provider_id],
        status=check.status.value, detail=check.detail, version=check.version, checked_at=check.checked_at.isoformat(),
        is_default=summary.is_default, has_stored_key=summary.has_stored_key,
    )


def artifact_out(artifact: Artifact, asset_urls: dict[str, dict[str, str]] | None = None) -> ArtifactOut:
    asset_urls = asset_urls or {}
    return ArtifactOut(
        id=str(artifact.id), story_id=str(artifact.story_id), version=artifact.version, status=artifact.status.value,
        title=artifact.title, subtitle=artifact.subtitle, excerpt=artifact.excerpt, summary=artifact.summary,
        content_html=artifact.content_html, category_id=artifact.category_id, tags=artifact.tags,
        entities=artifact.entities,
        seo=SeoMetadataOut(
            seo_title=artifact.seo.seo_title, seo_description=artifact.seo.seo_description,
            slug=artifact.seo.slug, canonical_url=artifact.seo.canonical_url,
        ),
        sources=[
            SourceReferenceOut(
                source_url=s.source_url, source_name=s.source_name, source_domain=s.source_domain,
                author=s.author, published_at=s.published_at.isoformat() if s.published_at else None,
                retrieved_at=s.retrieved_at.isoformat(), license_info=s.license_info, role=s.role.value,
            )
            for s in artifact.sources
        ],
        claims=[
            ClaimOut(id=c.id, text=c.text, label=c.label.value, source_urls=c.source_urls, reviewed=c.reviewed)
            for c in artifact.claims
        ],
        media_requirements=[
            MediaRequirementOut(
                placeholder_id=m.placeholder_id, kind=m.kind.value, prompt=m.prompt, asset_id=m.asset_id,
                asset_url=(asset_urls.get(m.asset_id) or {}).get("url") if m.asset_id else m.external_url,
                external_url=m.external_url,
                caption=m.caption, alt_text=m.alt_text,
                asset_provenance=(asset_urls.get(m.asset_id) or {}).get("provenance") if m.asset_id else None,
            )
            for m in artifact.media_requirements
        ],
        validation_issues=[
            ValidationIssueOut(check=i.check, detail=i.detail, severity=i.severity.value)
            for i in artifact.validation.issues
        ],
        editorial_notes=artifact.editorial_notes, created_at=artifact.created_at.isoformat(),
        published_news_id=artifact.published_news_id,
        published_at=artifact.published_at.isoformat() if artifact.published_at else None,
        scheduled_at=artifact.scheduled_at.isoformat() if artifact.scheduled_at else None,
    )


def media_generation_job_out(job: MediaGenerationJob) -> MediaGenerationJobOut:
    return MediaGenerationJobOut(
        id=job.id, artifact_id=str(job.artifact_id), placeholder_id=job.placeholder_id, status=job.status.value,
        created_at=job.created_at.isoformat(), started_at=job.started_at.isoformat() if job.started_at else None,
        finished_at=job.finished_at.isoformat() if job.finished_at else None, asset_id=job.asset_id, error=job.error,
    )


def published_content_out(content: PublishedContent) -> PublishedContentOut:
    return PublishedContentOut(
        id=str(content.id), title=content.title, subtitle=content.subtitle, slug=content.slug,
        excerpt=content.excerpt, summary=content.summary, content=content.content, category=content.category,
        tags=content.tags, image_url=content.image_url, author=content.author, source_name=content.source_name,
        source_url=content.source_url,
        published_at=content.published_at.isoformat() if content.published_at else None,
        updated_at=content.updated_at.isoformat() if content.updated_at else None,
    )


def studio_project_out(project: StudioProject, asset_urls: dict[str, str] | None = None) -> StudioProjectOut:
    asset_urls = asset_urls or {}
    return StudioProjectOut(
        id=str(project.id), source_artifact_id=project.source_artifact_id, mode=project.mode.value,
        template_id=project.template_id, format=project.format.value, status=project.status.value,
        version=project.version, parent_project_id=project.parent_project_id, title=project.title,
        scenes=[
            StudioSceneOut(
                id=scene.id, order=scene.order, duration_ms=scene.duration_ms,
                clips=[
                    StudioClipOut(
                        id=clip.id, track=clip.track.value, start_ms=clip.start_ms, duration_ms=clip.duration_ms,
                        source_placeholder_id=clip.source_placeholder_id, asset_id=clip.asset_id,
                        asset_url=asset_urls.get(clip.asset_id) if clip.asset_id else None, text=clip.text,
                        transform=ClipTransformOut(
                            x=clip.transform.x, y=clip.transform.y, scale=clip.transform.scale,
                            rotation=clip.transform.rotation, opacity=clip.transform.opacity,
                            focal_x=clip.transform.focal_x, focal_y=clip.transform.focal_y,
                        ),
                        locked=clip.locked, muted=clip.muted, hidden=clip.hidden,
                    )
                    for clip in scene.clips
                ],
            )
            for scene in project.scenes
        ],
        total_duration_ms=project.total_duration_ms(),
        created_at=project.created_at.isoformat(), updated_at=project.updated_at.isoformat(),
    )


def template_out(template: TemplatePreset) -> TemplateOut:
    version = template.latest_version
    return TemplateOut(
        id=template.id, name=template.name, description=template.description, accent_color=template.accent_color,
        latest_version=TemplateVersionOut(
            version=version.version,
            elements=[
                TemplateElementOut(
                    id=e.id, kind=e.kind.value, track=e.track.value, x=e.x, y=e.y, width=e.width, height=e.height,
                    font_role=e.font_role, color_role=e.color_role, z_index=e.z_index,
                )
                for e in version.elements
            ],
            safe_area=TemplateSafeAreaOut(
                top=version.safe_area.top, right=version.safe_area.right,
                bottom=version.safe_area.bottom, left=version.safe_area.left,
            ),
        ),
    )


def safe_area_out(result: SafeAreaResult) -> SafeAreaOut:
    return SafeAreaOut(
        format=result.format.value, canvas_width=result.canvas_width, canvas_height=result.canvas_height,
        insets=EdgeInsetsOut(
            top=result.insets.top, right=result.insets.right, bottom=result.insets.bottom, left=result.insets.left,
        ),
        source=result.source,
    )
