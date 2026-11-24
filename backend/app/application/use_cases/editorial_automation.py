"""Editorial automation use cases: read/update the switch, and the
autopilot that runs after each scraper pass (GitHub Actions).

The autopilot only orchestrates existing, already-tested use cases --
DecideDiscoveryItem (SELECT -> SEND_TO_EDITORIAL), TriggerArtifact and
RunArtifactJob -- so an automatic draft is exactly the same thing as one an
editor asked for by hand. It never publishes.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from app.domain.artifact.entities import ProviderId
from app.domain.automation.entities import EditorialAutomationSettings
from app.domain.discovery.entities import DiscoveryFilters, DiscoveryItem, DiscoveryStatus
from app.domain.discovery.trends import rank_clusters
from app.domain.ports import (
    ArtifactJobRepository, ArtifactProviderResolverPort, DiscoveryRepository, EditorialAutomationRepository,
    ProviderUnavailableError,
)
from app.application.use_cases.artifact import (
    RunArtifactJob, RunArtifactJobInput, TriggerArtifact, TriggerArtifactInput,
)
from app.application.use_cases.discovery import DecideDiscoveryItem, DecideDiscoveryItemInput

logger = logging.getLogger("cronos.autopilot")

AUTOPILOT_PROVIDER = ProviderId.ANTHROPIC
CANDIDATE_MAX_AGE_HOURS = 48


class GetEditorialAutomation:
    def __init__(self, settings: EditorialAutomationRepository) -> None:
        self._settings = settings

    def execute(self) -> EditorialAutomationSettings:
        return self._settings.get()


@dataclass
class UpdateEditorialAutomationInput:
    enabled: bool
    max_articles_per_run: int
    max_articles_per_day: int
    min_text_chars: int
    updated_by: str | None = None


class UpdateEditorialAutomation:
    """Turning automation ON requires the Anthropic provider to be really
    usable from this process -- never enables a mode that can only fail."""

    def __init__(self, settings: EditorialAutomationRepository, providers: ArtifactProviderResolverPort) -> None:
        self._settings = settings
        self._providers = providers

    def execute(self, input: UpdateEditorialAutomationInput) -> EditorialAutomationSettings:
        settings = EditorialAutomationSettings(
            enabled=input.enabled,
            max_articles_per_run=input.max_articles_per_run,
            max_articles_per_day=input.max_articles_per_day,
            min_text_chars=input.min_text_chars,
            updated_at=datetime.now(timezone.utc),
            updated_by=input.updated_by,
        )
        if settings.enabled:
            # Raises ProviderUnavailableError (409) with the real reason.
            self._providers.resolve(AUTOPILOT_PROVIDER.value)
        self._settings.save(settings)
        return settings


@dataclass
class AutopilotReport:
    enabled: bool
    budget: int = 0
    candidates: int = 0
    generated: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)
    reason: str | None = None


def candidate_rank(item: DiscoveryItem) -> float:
    """Relevant to the content profile + fresh + complete first. Unknown
    freshness ranks below any known one."""
    freshness = item.scores.freshness_score if item.scores.freshness_score is not None else -0.5
    completeness = item.scores.completeness_score or 0.0
    material = item.scores.material_score or 0.0
    relevance = item.scores.relevance_score
    if relevance is None:  # items scraped before content profiles existed
        return freshness * 0.6 + completeness * 0.3 + material * 0.1
    return relevance * 0.45 + freshness * 0.35 + completeness * 0.15 + material * 0.05


class RunEditorialAutopilot:
    def __init__(
        self,
        settings: EditorialAutomationRepository,
        discovery_items: DiscoveryRepository,
        artifact_jobs: ArtifactJobRepository,
        decide_item: DecideDiscoveryItem,
        trigger_artifact: TriggerArtifact,
        run_artifact_job: RunArtifactJob,
    ) -> None:
        self._settings = settings
        self._items = discovery_items
        self._jobs = artifact_jobs
        self._decide = decide_item
        self._trigger = trigger_artifact
        self._run = run_artifact_job

    def execute(self, now: datetime | None = None) -> AutopilotReport:
        now = now or datetime.now(timezone.utc)
        settings = self._settings.get()
        if not settings.enabled:
            return AutopilotReport(enabled=False, reason="modo automático apagado")

        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        used_today = sum(
            1 for job in self._jobs.list_recent(limit=300)
            if job.provider == AUTOPILOT_PROVIDER.value and job.created_at >= start_of_day
        )
        budget = max(0, min(settings.max_articles_per_run, settings.max_articles_per_day - used_today))
        report = AutopilotReport(enabled=True, budget=budget)
        if budget == 0:
            report.reason = f"límite diario alcanzado ({used_today}/{settings.max_articles_per_day})"
            return report
        pool = self._items.list(DiscoveryFilters(
            status=DiscoveryStatus.DISCOVERED, since=now - timedelta(hours=CANDIDATE_MAX_AGE_HOURS),
            sort_by="discovered_at", sort_dir="desc", limit=300,
        ))
        # Same trend engine as the board: hottest STORIES first (fresh + covered
        # by several outlets + relevant). Write from the copy with the most
        # text; the other outlets' copies are archived afterwards.
        picked: list[tuple[DiscoveryItem, list[str]]] = []
        candidates = 0
        for cluster in rank_clusters(pool, now):
            usable = [i for i in cluster.items if len((i.raw_text or "").strip()) >= settings.min_text_chars]
            if not usable:
                continue
            candidates += 1
            if len(picked) < budget:
                best = max(usable, key=lambda i: (candidate_rank(i), len(i.raw_text or "")))
                picked.append((best, [str(i.id) for i in cluster.items if i.id != best.id]))
        report.candidates = candidates
        if not picked:
            report.reason = "sin candidatas con texto suficiente"
            return report

        for item, siblings in picked:
            item_id = str(item.id)
            try:
                self._decide.execute(DecideDiscoveryItemInput(item_id=item_id, decision="SELECT"))
                self._decide.execute(DecideDiscoveryItemInput(item_id=item_id, decision="SEND_TO_EDITORIAL"))
                job = self._trigger.execute(TriggerArtifactInput(story_id=item_id, provider=AUTOPILOT_PROVIDER.value))
                finished = self._run.execute(RunArtifactJobInput(job_id=job.id))
            except ProviderUnavailableError as exc:
                report.failed.append(item_id)
                report.reason = f"proveedor no disponible: {exc}"
                break  # every next item would fail the same way
            except Exception:  # noqa: BLE001 -- one bad item never stops the batch
                logger.exception("autopilot_item_failed item_id=%s", item_id)
                report.failed.append(item_id)
                continue
            if finished.status.value == "FAILED":
                report.failed.append(item_id)
            else:
                report.generated.append(item_id)
                for sibling_id in siblings:  # other outlets' copies of the same story
                    try:
                        self._decide.execute(DecideDiscoveryItemInput(item_id=sibling_id, decision="ARCHIVE"))
                    except Exception:  # noqa: BLE001
                        continue
        return report

