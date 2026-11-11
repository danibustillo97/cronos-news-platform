"""Composition root — the ONLY place concrete infrastructure classes are
instantiated and wired into application use cases. Presentation imports
from here, never from app.infrastructure directly.
"""
from __future__ import annotations

from functools import lru_cache

from app.infrastructure.persistence.supabase.client import get_supabase_client
from app.infrastructure.persistence.supabase.news_repository import SupabaseNewsRepository
from app.infrastructure.persistence.supabase.story_repository import SupabaseStoryRepository
from app.infrastructure.persistence.supabase.production_repository import SupabaseProductionRepository
from app.infrastructure.persistence.supabase.composition_repository import SupabaseCompositionRepository
from app.infrastructure.persistence.supabase.distribution_repository import SupabaseDistributionRepository
from app.infrastructure.persistence.supabase.category_repository import SupabaseCategoryRepository
from app.infrastructure.persistence.supabase.site_settings_repository import SupabaseSiteSettingsRepository
from app.infrastructure.persistence.supabase.intelligence_repository import SupabaseIntelligenceRepository
from app.infrastructure.persistence.supabase.discovery_repository import (
    SupabaseDiscoveryJobRepository, SupabaseDiscoveryRepository,
)
from app.infrastructure.persistence.supabase.artifact_repository import (
    SupabaseArtifactJobRepository, SupabaseArtifactRepository,
)
from app.infrastructure.persistence.supabase.asset_repository import (
    SupabaseAssetRepository, SupabaseMediaGenerationJobRepository,
)
from app.infrastructure.persistence.supabase.published_content_repository import SupabasePublishedContentRepository
from app.infrastructure.persistence.supabase.studio_repository import SupabaseStudioProjectRepository
from app.infrastructure.persistence.supabase.ad_banner_repository import SupabaseAdBannerRepository
from app.infrastructure.media.ad_banner_storage_adapter import SupabaseAdBannerStorageAdapter
from app.infrastructure.lab.local.discovery_reader import LocalDiscoveryContentReader
from app.infrastructure.runtime.discovery_runner_adapter import DiscoveryRunnerAdapter
from app.infrastructure.llm.anthropic_adapter import AnthropicArtifactGenerator
from app.infrastructure.llm.claude_code_adapter import ClaudeCodeArtifactGenerator
from app.infrastructure.llm.provider_resolver import ArtifactProviderResolver
from app.infrastructure.config.env_credentials_store import EnvFileCredentialsStore
from app.infrastructure.publishing.legacy_news_publisher import SupabaseLegacyNewsPublisher
from app.infrastructure.media.runtime_media_generation_adapter import RuntimeMediaGenerationAdapter
from app.infrastructure.lab.local.editorial_intelligence_adapter import LocalEditorialIntelligenceAdapter
from app.infrastructure.lab.local.story_intelligence_adapter import LocalStoryIntelligenceAdapter
from app.infrastructure.lab.local.narrative_direction_adapter import LocalNarrativeDirectionAdapter
from app.infrastructure.lab.local.audio_direction_adapter import LocalAudioDirectionAdapter
from app.infrastructure.lab.local.media_planning_adapter import LocalMediaPlanningAdapter
from app.infrastructure.lab.local.sequence_planning_adapter import LocalSequencePlanningAdapter
from app.infrastructure.lab.local.animation_planning_adapter import LocalAnimationPlanningAdapter
from app.infrastructure.lab.local.render_adapter import LocalRenderAdapter
from app.infrastructure.lab.local.assembly_adapter import LocalAssemblyAdapter
from app.infrastructure.lab.local.export_reader import LabExportReader
from app.infrastructure.lab.live.composite_reader import default_reader
from app.infrastructure.lab.local.local_storage_adapter import LocalLabStorageAdapter
from app.infrastructure.publishing.env_availability import EnvPublishingAvailability
from app.infrastructure.runtime.local_runtime_adapter import LocalRuntimeAdapter

from app.application.use_cases.produce_story import ProduceStory
from app.application.use_cases.get_story_workspace import GetStoryWorkspace
from app.application.use_cases.review_composition import ReviewComposition
from app.application.use_cases.prepare_distribution import PrepareDistribution
from app.application.use_cases.get_discovery_today import GetDiscoveryToday
from app.application.use_cases.list_categories import ListCategories
from app.application.use_cases.list_active_productions import ListActiveProductions
from app.application.use_cases.seo_settings import GetSeoSettings, UpdateSeoSettings
from app.application.use_cases.discovery import (
    AssignDiscoveryItem, DecideDiscoveryItem, GetDiscoveryJob, ListDiscoveryItems, ListDiscoveryJobs,
    ReportDiscoveryJobStatus, RequestStopDiscoveryJob, TriggerDiscovery,
)
from app.application.use_cases.artifact import (
    ArchiveArtifact, CancelArtifactSchedule, GetArtifact, GetArtifactJob, GetLatestArtifactJobForStory,
    ListArtifactJobsForStory, ListArtifactsByStatus, MarkClaimReviewed, OpenManualDiscoveryEditor,
    ProposeClaimResolution, ProposeSeoFix, PublishArtifact, ReviewArtifact, RunArtifactJob,
    RunDueScheduledArtifactPublications, ScheduleArtifact, SubmitArtifactForReview, TriggerArtifact, UpdateArtifact,
)
from app.application.use_cases.artifact_providers import (
    CheckArtifactProvider, ClearProviderApiKey, ListArtifactProviders, SetDefaultArtifactProvider,
    SetProviderApiKey,
)
from app.application.use_cases.media_generation import (
    AddMediaRequirement, GetMediaGenerationJob, RemoveMediaRequirement, RunMediaGenerationJob,
    TriggerMediaGeneration, UpdateMediaPrompt, UploadMedia,
)
from app.application.use_cases.published_content import (
    GetPublishedContent, GetPublishedContentBySlug, ListPublishedContent,
)
from app.application.use_cases.ads import (
    CreateAdBanner, DeleteAdBanner, ListActiveAdBannersForPosition, ListAdBanners, UpdateAdBanner,
)
from app.application.use_cases.studio import (
    CreateStudioProject, DuplicateStudioProject, GetStudioProject, ListStudioProjectVersions, UpdateStudioProject,
)


class Container:
    def __init__(self) -> None:
        client = get_supabase_client()

        self.news_repo = SupabaseNewsRepository(client)
        self.story_repo = SupabaseStoryRepository(client)
        self.production_repo = SupabaseProductionRepository(client)
        self.composition_repo = SupabaseCompositionRepository(client)
        self.distribution_repo = SupabaseDistributionRepository(client)
        self.category_repo = SupabaseCategoryRepository(client)
        self.site_settings_repo = SupabaseSiteSettingsRepository(client)
        self.intelligence_repo = SupabaseIntelligenceRepository(client)
        self.discovery_repo = SupabaseDiscoveryRepository(client)
        self.discovery_job_repo = SupabaseDiscoveryJobRepository(client)
        self.artifact_repo = SupabaseArtifactRepository(client)
        self.artifact_job_repo = SupabaseArtifactJobRepository(client)
        self.asset_repo = SupabaseAssetRepository(client)
        self.media_generation_job_repo = SupabaseMediaGenerationJobRepository(client)
        self.published_content_repo = SupabasePublishedContentRepository(client)
        self.studio_project_repo = SupabaseStudioProjectRepository(client)
        self.ad_banner_repo = SupabaseAdBannerRepository(client)
        self.ad_banner_storage = SupabaseAdBannerStorageAdapter(client)

        reader = default_reader()
        self.lab_editorial = LocalEditorialIntelligenceAdapter(reader)
        self.lab_story_intelligence = LocalStoryIntelligenceAdapter(reader)
        self.lab_narrative = LocalNarrativeDirectionAdapter(reader)
        self.lab_audio = LocalAudioDirectionAdapter(reader)
        self.lab_media = LocalMediaPlanningAdapter(reader)
        self.lab_sequence = LocalSequencePlanningAdapter(reader)
        self.lab_animation = LocalAnimationPlanningAdapter(reader)
        self.lab_render = LocalRenderAdapter(reader)
        self.lab_assembly = LocalAssemblyAdapter(reader)
        self.export_reader = LabExportReader()

        self.publishing_availability = EnvPublishingAvailability()
        self.storage = LocalLabStorageAdapter()
        self.runtime = LocalRuntimeAdapter()
        self.discovery_content_reader = LocalDiscoveryContentReader()
        self.discovery_runner = DiscoveryRunnerAdapter()
        self.anthropic_generator = AnthropicArtifactGenerator()
        self.claude_code_generator = ClaudeCodeArtifactGenerator()
        self.artifact_provider_resolver = ArtifactProviderResolver(self.anthropic_generator, self.claude_code_generator)
        self.artifact_credentials_store = EnvFileCredentialsStore()
        self.artifact_publisher = SupabaseLegacyNewsPublisher(client)
        self.media_generator = RuntimeMediaGenerationAdapter()

        self.list_active_productions = ListActiveProductions(self.production_repo, self.story_repo)
        self.produce_story = ProduceStory(
            self.story_repo, self.production_repo, self.composition_repo, self.intelligence_repo, self.news_repo,
            self.lab_editorial, self.lab_story_intelligence, self.lab_narrative, self.lab_audio,
            self.lab_media, self.lab_sequence, self.lab_animation, self.lab_render, self.lab_assembly,
        )
        self.get_story_workspace = GetStoryWorkspace(self.story_repo, self.production_repo, self.composition_repo, self.distribution_repo)
        self.review_composition = ReviewComposition(self.composition_repo)
        self.prepare_distribution = PrepareDistribution(self.composition_repo, self.distribution_repo, self.publishing_availability)
        self.get_discovery_today = GetDiscoveryToday(self.news_repo)
        self.list_categories = ListCategories(self.category_repo)
        self.get_seo_settings = GetSeoSettings(self.site_settings_repo)
        self.update_seo_settings = UpdateSeoSettings(self.site_settings_repo)
        self.trigger_discovery = TriggerDiscovery(self.discovery_job_repo, self.discovery_runner)
        self.get_discovery_job = GetDiscoveryJob(self.discovery_job_repo)
        self.request_stop_discovery_job = RequestStopDiscoveryJob(self.discovery_job_repo, self.discovery_runner)
        self.list_discovery_jobs = ListDiscoveryJobs(self.discovery_job_repo)
        self.report_discovery_job_status = ReportDiscoveryJobStatus(
            self.discovery_job_repo, self.discovery_repo, self.discovery_content_reader, self.category_repo,
        )
        self.list_discovery_items = ListDiscoveryItems(self.discovery_repo)
        self.decide_discovery_item = DecideDiscoveryItem(self.discovery_repo, self.story_repo)
        self.assign_discovery_item = AssignDiscoveryItem(self.discovery_repo)
        self.open_manual_discovery_editor = OpenManualDiscoveryEditor(
            self.discovery_repo, self.story_repo, self.artifact_repo,
        )
        self.trigger_artifact = TriggerArtifact(self.artifact_job_repo, self.story_repo, self.artifact_provider_resolver)
        self.get_artifact_job = GetArtifactJob(self.artifact_job_repo)
        self.get_artifact = GetArtifact(self.artifact_repo)
        self.get_latest_artifact_job_for_story = GetLatestArtifactJobForStory(self.artifact_job_repo)
        self.list_artifact_jobs_for_story = ListArtifactJobsForStory(self.artifact_job_repo)
        self.run_artifact_job = RunArtifactJob(
            self.artifact_job_repo, self.artifact_repo, self.discovery_repo, self.story_repo,
            self.category_repo, self.artifact_provider_resolver,
        )
        self.list_artifact_providers = ListArtifactProviders(self.artifact_provider_resolver, self.artifact_credentials_store)
        self.check_artifact_provider = CheckArtifactProvider(self.artifact_provider_resolver)
        self.set_default_artifact_provider = SetDefaultArtifactProvider(self.artifact_credentials_store)
        self.set_provider_api_key = SetProviderApiKey(self.artifact_credentials_store)
        self.clear_provider_api_key = ClearProviderApiKey(self.artifact_credentials_store)
        self.list_artifacts_by_status = ListArtifactsByStatus(self.artifact_repo)
        self.update_artifact = UpdateArtifact(self.artifact_repo, self.category_repo)
        self.mark_claim_reviewed = MarkClaimReviewed(self.artifact_repo, self.category_repo)
        self.propose_seo_fix = ProposeSeoFix(self.artifact_repo, self.artifact_provider_resolver)
        self.propose_claim_resolution = ProposeClaimResolution(
            self.artifact_repo, self.discovery_repo, self.artifact_provider_resolver,
        )
        self.review_artifact = ReviewArtifact(self.artifact_repo, self.story_repo)
        self.archive_artifact = ArchiveArtifact(self.artifact_repo)
        self.publish_artifact = PublishArtifact(
            self.artifact_repo, self.story_repo, self.category_repo, self.asset_repo, self.storage,
            self.artifact_publisher,
        )
        self.submit_artifact_for_review = SubmitArtifactForReview(self.artifact_repo, self.category_repo)
        self.schedule_artifact = ScheduleArtifact(self.artifact_repo)
        self.cancel_artifact_schedule = CancelArtifactSchedule(self.artifact_repo)
        self.run_due_scheduled_artifact_publications = RunDueScheduledArtifactPublications(
            self.artifact_repo, self.publish_artifact,
        )
        self.trigger_media_generation = TriggerMediaGeneration(self.media_generation_job_repo, self.artifact_repo)
        self.get_media_generation_job = GetMediaGenerationJob(self.media_generation_job_repo)
        self.run_media_generation_job = RunMediaGenerationJob(
            self.media_generation_job_repo, self.artifact_repo, self.asset_repo, self.media_generator,
        )
        self.update_media_prompt = UpdateMediaPrompt(self.artifact_repo)
        self.add_media_requirement = AddMediaRequirement(self.artifact_repo)
        self.remove_media_requirement = RemoveMediaRequirement(self.artifact_repo)
        self.upload_media = UploadMedia(self.artifact_repo, self.asset_repo, self.storage)
        self.get_published_content = GetPublishedContent(self.published_content_repo)
        self.get_published_content_by_slug = GetPublishedContentBySlug(self.published_content_repo)
        self.list_published_content = ListPublishedContent(self.published_content_repo)
        self.list_ad_banners = ListAdBanners(self.ad_banner_repo)
        self.list_active_ad_banners = ListActiveAdBannersForPosition(self.ad_banner_repo)
        self.create_ad_banner = CreateAdBanner(self.ad_banner_repo, self.ad_banner_storage)
        self.update_ad_banner = UpdateAdBanner(self.ad_banner_repo)
        self.delete_ad_banner = DeleteAdBanner(self.ad_banner_repo)
        self.create_studio_project = CreateStudioProject(self.artifact_repo, self.studio_project_repo)
        self.get_studio_project = GetStudioProject(self.studio_project_repo)
        self.update_studio_project = UpdateStudioProject(self.studio_project_repo)
        self.list_studio_project_versions = ListStudioProjectVersions(self.studio_project_repo)
        self.duplicate_studio_project = DuplicateStudioProject(self.studio_project_repo)


@lru_cache(maxsize=1)
def get_container() -> Container:
    return Container()
