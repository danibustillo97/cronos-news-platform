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
from app.infrastructure.lab.local.discovery_reader import LocalDiscoveryContentReader
from app.infrastructure.runtime.discovery_runner_adapter import DiscoveryRunnerAdapter
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

from app.application.use_cases.prepare_content import PrepareContent
from app.application.use_cases.produce_story import ProduceStory
from app.application.use_cases.get_story_workspace import GetStoryWorkspace
from app.application.use_cases.review_composition import ReviewComposition
from app.application.use_cases.prepare_distribution import PrepareDistribution
from app.application.use_cases.get_discovery_today import GetDiscoveryToday
from app.application.use_cases.list_categories import ListCategories
from app.application.use_cases.list_news import ListNews
from app.application.use_cases.convert_news_to_content import ConvertNewsToContent
from app.application.use_cases.list_active_productions import ListActiveProductions
from app.application.use_cases.seo_settings import GetSeoSettings, UpdateSeoSettings
from app.application.use_cases.discovery import (
    DecideDiscoveryItem, GetDiscoveryJob, ListDiscoveryItems, ListDiscoveryJobs,
    ReportDiscoveryJobStatus, TriggerDiscovery,
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

        self.prepare_content = PrepareContent(self.news_repo, self.story_repo)
        self.convert_news_to_content = ConvertNewsToContent(
            self.news_repo, self.story_repo, self.production_repo, self.runtime,
        )
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
        self.list_news = ListNews(self.news_repo, self.story_repo)
        self.get_seo_settings = GetSeoSettings(self.site_settings_repo)
        self.update_seo_settings = UpdateSeoSettings(self.site_settings_repo)
        self.trigger_discovery = TriggerDiscovery(self.discovery_job_repo, self.discovery_runner)
        self.get_discovery_job = GetDiscoveryJob(self.discovery_job_repo)
        self.list_discovery_jobs = ListDiscoveryJobs(self.discovery_job_repo)
        self.report_discovery_job_status = ReportDiscoveryJobStatus(
            self.discovery_job_repo, self.discovery_repo, self.discovery_content_reader, self.category_repo,
        )
        self.list_discovery_items = ListDiscoveryItems(self.discovery_repo)
        self.decide_discovery_item = DecideDiscoveryItem(self.discovery_repo, self.story_repo)


@lru_cache(maxsize=1)
def get_container() -> Container:
    return Container()
