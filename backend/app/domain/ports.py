"""PORTS — the only contract boundary between Application/Domain and
Infrastructure. Everything here is a `Protocol` (structural typing): domain
and application code import ONLY this module, never a concrete adapter.

Domain purity rule enforced by tests/infrastructure/test_dependency_direction.py:
nothing under app/domain may import fastapi, supabase, httpx, requests, or
any app.infrastructure module.
"""
from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.domain.news.entities import News
from app.domain.story.entities import Story
from app.domain.production.entities import Production
from app.domain.composition.entities import Composition
from app.domain.distribution.entities import DistributionPlan, Platform
from app.domain.asset.entities import Asset, MediaGenerationJob, MediaGenerationResult
from app.domain.category.entities import CategoryGroup
from app.domain.settings.entities import SiteSeoSettings
from app.domain.intelligence.entities import (
    EditorialIntelligence, StoryIntelligence, NarrativeDirection, AudioDirection,
    MediaPlan, SequencePlan, AnimationPlan, RenderResult, AssemblyResult,
)
from app.domain.discovery.entities import DiscoveryFilters, DiscoveryItem, DiscoveryJob, IngestedContent
from app.domain.artifact.entities import (
    Artifact, ArtifactGenerationRequest, ArtifactGenerationResult, ArtifactJob, ProviderCheckResult, ProviderId,
)
from app.domain.publication.entities import PublishedContent


# ── repository ports ─────────────────────────────────────────────────────

class NewsRepository(Protocol):
    def find_by_id(self, news_id: str) -> News | None: ...
    def list_recent(self, limit: int) -> list[News]: ...
    def save(self, news: News) -> None: ...


class StoryRepository(Protocol):
    def find_by_id(self, story_id: str) -> Story | None: ...
    def find_by_source_news_id(self, news_id: str) -> Story | None: ...
    def list_recent(self, limit: int) -> list[Story]: ...
    def save(self, story: Story) -> None: ...


class ProductionRepository(Protocol):
    def find_by_id(self, production_id: str) -> Production | None: ...
    def find_latest_for_story(self, story_id: str) -> Production | None: ...
    def list_active(self, limit: int = 50) -> list[Production]:
        """RUNNING/PENDING first (most recently started first), then a
        few recent COMPLETED/FAILED — the operational dashboard's feed."""
        ...
    def has_runtime_jobs(self, production_id: str) -> bool:
        """True if the Local Runtime has ever recorded a stage for this
        production (a real production_jobs row) — the signal that its
        lifecycle is Runtime-owned, never fabricated/inferred."""
        ...
    def save(self, production: Production) -> None: ...


class CompositionRepository(Protocol):
    def find_by_id(self, composition_id: str) -> Composition | None: ...
    def list_for_story(self, story_id: str) -> list[Composition]: ...
    def save(self, composition: Composition) -> None: ...


class AssetRepository(Protocol):
    def find_by_id(self, asset_id: str) -> Asset | None: ...
    def list_for_story(self, story_id: str) -> list[Asset]: ...
    def save(self, asset: Asset) -> None: ...


class MediaGenerationJobRepository(Protocol):
    def find_by_id(self, job_id: str) -> MediaGenerationJob | None: ...
    def list_recent(self, limit: int = 20) -> list[MediaGenerationJob]: ...
    def save(self, job: MediaGenerationJob) -> None: ...


class DistributionRepository(Protocol):
    def find_by_id(self, plan_id: str) -> DistributionPlan | None: ...
    def list_for_composition(self, composition_id: str) -> list[DistributionPlan]: ...
    def save(self, plan: DistributionPlan) -> None: ...


class CategoryRepository(Protocol):
    def list_tree(self) -> list[CategoryGroup]: ...


class SiteSettingsRepository(Protocol):
    """Singleton config -- get_seo always returns a value (the row is
    seeded by the schema migration itself), never None."""
    def get_seo(self) -> SiteSeoSettings: ...
    def save_seo(self, settings: SiteSeoSettings) -> None: ...


class DiscoveryRepository(Protocol):
    def find_by_id(self, item_id: str) -> DiscoveryItem | None: ...
    def list(self, filters: DiscoveryFilters) -> list[DiscoveryItem]:
        """Server-side filtered/sorted/paginated -- never a full-table
        fetch for the UI to filter client-side (rule: no unbounded lists
        in React)."""
        ...
    def exists_by_source_url(self, source_url: str) -> bool: ...
    def save(self, item: DiscoveryItem) -> None: ...


class DiscoveryJobRepository(Protocol):
    def find_by_id(self, job_id: str) -> DiscoveryJob | None: ...
    def list_recent(self, limit: int = 20) -> list[DiscoveryJob]: ...
    def save(self, job: DiscoveryJob) -> None: ...


class ArtifactRepository(Protocol):
    def find_by_id(self, artifact_id: str) -> Artifact | None: ...
    def find_latest_for_story(self, story_id: str) -> Artifact | None: ...
    def list_by_status(self, status: str, limit: int = 50) -> list[Artifact]:
        """Real listing for the Ready tab -- VALIDATED/APPROVED, never a
        fabricated count."""
        ...
    def save(self, artifact: Artifact) -> None: ...


class ArtifactJobRepository(Protocol):
    def find_by_id(self, job_id: str) -> ArtifactJob | None: ...
    def find_latest_for_story(self, story_id: str) -> ArtifactJob | None: ...
    def list_recent(self, limit: int = 20) -> list[ArtifactJob]: ...
    def save(self, job: ArtifactJob) -> None: ...


class IntelligenceRepository(Protocol):
    """Persists each capability's typed result as its own
    `story_intelligence` row (kind + payload) — never one blob."""
    def save_editorial(self, story_id: str, result: EditorialIntelligence) -> None: ...
    def save_story_intelligence(self, story_id: str, result: StoryIntelligence) -> None: ...
    def save_narrative(self, story_id: str, result: NarrativeDirection) -> None: ...
    def save_audio(self, story_id: str, result: AudioDirection) -> None: ...
    def save_media_plan(self, story_id: str, result: MediaPlan) -> None: ...

    def get_editorial(self, story_id: str) -> EditorialIntelligence | None: ...
    def get_story_intelligence(self, story_id: str) -> StoryIntelligence | None: ...
    def get_narrative(self, story_id: str) -> NarrativeDirection | None: ...
    def get_audio(self, story_id: str) -> AudioDirection | None: ...
    def get_media_plan(self, story_id: str) -> MediaPlan | None: ...


# ── LAB capability ports (rule: LAB is compute, not the database) ───────
# One port per redistributed LAB capability. Each raises
# CapabilityUnavailableError (never invents a result) when LAB has not
# produced that capability's output for the given story yet.

class EditorialIntelligencePort(Protocol):
    """LAB Editorial Understanding -> Editorial Intelligence."""
    def analyze(self, story_id: str) -> EditorialIntelligence: ...


class StoryIntelligencePort(Protocol):
    """LAB Storycraft -> Story Intelligence / Story Context (concepts, hooks, script)."""
    def discover(self, story_id: str) -> StoryIntelligence: ...


class NarrativeDirectionPort(Protocol):
    """LAB Narrative -> Narrative Direction."""
    def plan(self, story_id: str) -> NarrativeDirection: ...


class AudioDirectionPort(Protocol):
    """LAB Audio -> Audio Direction."""
    def plan(self, story_id: str) -> AudioDirection: ...


class MediaPlanningPort(Protocol):
    """LAB Media -> Media Planning / Asset capability."""
    def plan(self, story_id: str) -> MediaPlan: ...


class SequencePlanningPort(Protocol):
    """LAB Sequence -> Sequence Planning."""
    def plan(self, story_id: str) -> SequencePlan: ...


class AnimationPlanningPort(Protocol):
    """LAB Animation -> Animation Planning."""
    def plan(self, story_id: str) -> AnimationPlan: ...


class RenderPort(Protocol):
    """LAB Render -> Render Execution."""
    def result(self, story_id: str) -> RenderResult: ...


class AssemblyPort(Protocol):
    """LAB Assembly + Export -> Assembly / Production Output capability."""
    def result(self, story_id: str) -> AssemblyResult: ...


# ── cross-cutting infrastructure ports ───────────────────────────────────

class StoragePort(Protocol):
    """Resolves an opaque asset storage_ref into a URL the frontend can use
    directly. Today: a local LAB-export file server. Tomorrow: Supabase
    Storage signed URLs — callers never notice the swap."""
    def resolve_url(self, storage_ref: str) -> str: ...


class SearchPort(Protocol):
    def search(self, query: str, limit: int = 20) -> list[News]: ...


class PublishedContentRepository(Protocol):
    """Read-only: the PUBLICATION boundary (see app/domain/publication/
    entities.py). Nothing in Editorial (Discovery/Artifact/Ready/Publish)
    depends on this -- it exists for a downstream consumer (Studio,
    eventually) to read what Editorial has actually published, through a
    stable id, without ever touching Story/Artifact/DiscoveryItem."""
    def find_by_id(self, content_id: str) -> PublishedContent | None: ...
    def find_by_slug(self, slug: str) -> PublishedContent | None: ...
    def list_recent(self, limit: int = 20, category: str | None = None) -> list[PublishedContent]: ...


class PublishingAvailabilityPort(Protocol):
    def is_connected(self, platform: Platform) -> bool: ...


class RuntimeUnavailableError(Exception):
    """The Local Runtime (automation/runtime/) isn't reachable —
    never fabricate a story_id/production when this happens (rule:
    'no fake progress')."""


class ExecutionRuntimePort(Protocol):
    """The bridge to the Local Runtime that actually drives LAB. News
    orchestrates intent, LAB produces — this port is the only place
    news/backend crosses that boundary (rule 'NEWS NO PRODUCE, LAB
    PRODUCE')."""
    def is_connected(self) -> bool: ...
    def ingest(self, title: str, source_url: str, content: str, image_url: str | None, source: str | None) -> str:
        """Returns the LAB item_id — this becomes the Story's id."""
        ...
    def start_production(self, production_id: str, story_id: str, item_id: str) -> None: ...
    def cancel_production(self, production_id: str) -> None: ...
    def resume_production(self, production_id: str, story_id: str, item_id: str) -> None: ...


class ArtifactGenerationPort(Protocol):
    """The one real LLM call in the whole editorial pipeline -- deliberately
    provider-agnostic (see app/infrastructure/llm/ for the concrete
    adapters). NEXUS's domain/application code never knows which vendor
    answers this; swapping providers means writing a new adapter, never
    touching Artifact/TriggerArtifact.

    Raises a real, specific exception (never returns fabricated content)
    when the provider isn't configured or the call fails -- see
    ArtifactGenerationUnavailableError."""
    def generate(self, request: ArtifactGenerationRequest) -> ArtifactGenerationResult: ...


class ArtifactProviderPort(ArtifactGenerationPort, Protocol):
    """An ArtifactGenerationPort that can also report its own real,
    live status -- the Provider Control Plane's unit of selection. Every
    concrete provider (AnthropicArtifactGenerator, ClaudeCodeArtifact
    Generator) implements both generate() and check_status(); nothing
    downstream (the resolver, the use cases) ever special-cases one
    provider over another."""
    def check_status(self) -> ProviderCheckResult: ...


class ArtifactProviderResolverPort(Protocol):
    """Turns a requested provider name ("anthropic", "claude_code",
    "auto", or None) into a real, currently-usable ProviderId -- see
    app/infrastructure/llm/provider_resolver.py for the concrete,
    real-status-checking implementation. Application code depends on
    this Protocol only, never the concrete resolver class."""
    def resolve(self, requested: str | None) -> ProviderId: ...
    def get(self, provider_id: ProviderId) -> ArtifactProviderPort: ...
    def all_providers(self) -> dict[ProviderId, ArtifactProviderPort]: ...
    def default_provider_id(self) -> str: ...


class ArtifactCredentialsStorePort(Protocol):
    """Where a provider's secret actually lives. Local/dev: backend/.env
    (same file every other secret in this codebase already uses). A real
    production deployment needs a different adapter (e.g. AWS Secrets
    Manager) -- swapping it never touches domain/application code, same
    seam as every other port here. NEVER returns the raw secret to a
    caller outside this process -- only whether one is set."""
    def set_key(self, provider_id: ProviderId, value: str) -> None: ...
    def clear_key(self, provider_id: ProviderId) -> None: ...
    def has_key(self, provider_id: ProviderId) -> bool: ...
    def set_default_provider(self, provider_id: ProviderId) -> None: ...


class ProviderUnavailableError(Exception):
    """Raised by TriggerArtifact when the requested (or auto-resolved)
    provider is not actually usable right now -- never creates a job
    doomed to fail. Distinct from ArtifactGenerationUnavailableError,
    which is raised mid-generation by a provider that WAS selected."""


class ArtifactGenerationUnavailableError(Exception):
    """The configured LLM provider isn't reachable, isn't configured
    (missing API key), or returned something this backend can't parse
    into a real ArtifactGenerationResult. Never silently degrades to
    invented content -- the caller (TriggerArtifact) fails the job
    honestly with this message."""


class ArtifactPublishingPort(Protocol):
    """PUBLISH: materializes an APPROVED Artifact into the pre-existing
    public `news` table the live site (nexusnews.info) already reads
    from directly -- the same table CRONOS' own NEWS bounded context
    writes ingestion rows into (see news_repository.py's own docstring).
    Publish adds a genuinely new row of the public-facing kind (real
    title/content/seo/status='published'); it never touches or replaces
    an ingestion row. Returns the new row's real id -- never a fabricated
    one -- and raises on any failure instead of pretending it worked."""
    def publish(self, artifact: Artifact, category_name: str | None, image_url: str | None) -> str: ...


class MediaGenerationPort(Protocol):
    """PHASE 7: the one real image-generation call for an Artifact's
    declared MediaRequirement. Provider-agnostic like
    ArtifactGenerationPort -- the concrete adapter (see
    app/infrastructure/media/) reaches the real Gemini/Cloudflare
    providers that already exist in automation/lab/media/, through the
    Local Runtime bridge (NEWS/backend never imports LAB Python directly,
    same 'NO PRODUCE, LAB PRODUCE' rule as ExecutionRuntimePort). Raises
    MediaGenerationUnavailableError -- never returns a placeholder
    image -- when the runtime or the provider isn't reachable/configured."""
    def generate(self, story_id: str, placeholder_id: str, prompt: str, aspect_ratio: str = "16:9") -> MediaGenerationResult: ...


class MediaGenerationUnavailableError(Exception):
    """The Local Runtime isn't reachable, or the real image provider it
    called (Gemini/Cloudflare) failed/isn't configured -- always the real
    error message, never silently retried into a fabricated image."""


class DiscoveryContentReaderPort(Protocol):
    """Reads what Automation's real ingestion actually produced for a set
    of item ids -- the raw material IngestDiscoveryResults maps into real
    DiscoveryItem entities. Never invents an item that wasn't really
    ingested; a missing id is simply absent from the result."""
    def read_many(self, item_ids: list[str]) -> list[IngestedContent]: ...


class DiscoveryRunnerPort(Protocol):
    """Automation's real ingestion capability (lab.ingestion.run, run via
    automation/runtime) -- the only thing that actually fetches from the
    real world. This backend never scrapes anything itself (same
    'NEWS/PRODUCTION NO PRODUCE, AUTOMATION PRODUCES' boundary as
    ExecutionRuntimePort, applied to raw content instead of a full
    production)."""
    def trigger(self, job_id: str, params: dict) -> None:
        """Fire-and-forget: automation/runtime runs the job asynchronously
        and reports completion back via PATCH /api/discovery/jobs/{id}.
        Raises RuntimeUnavailableError if automation/runtime can't be
        reached at all -- never silently queues nothing."""
        ...

    def request_stop(self, job_id: str) -> None:
        """A real, cooperative stop request -- never kills the running
        scrape. automation/runtime writes a stop signal the ingestion loop
        checks between sources; whatever was already saved stays saved.
        Raises RuntimeUnavailableError if automation/runtime can't be
        reached -- the job stays CANCELLING, never silently assumed
        stopped."""
        ...
