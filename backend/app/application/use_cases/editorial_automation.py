"""Editorial automation use cases: read/update the switch, and the
autopilot that runs after each scraper pass (GitHub Actions).

The autopilot only orchestrates existing, already-tested use cases --
DecideDiscoveryItem (SELECT -> SEND_TO_EDITORIAL), TriggerArtifact and
RunArtifactJob -- so an automatic draft is exactly the same thing as one an
editor asked for by hand. It publishes ONLY when "Publicación automática"
is ON and the draft passes the AutoPublishGate below (blocking checks, every
claim backed by evidence, plagiarism check); otherwise it stays in Revisión.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from app.domain.artifact.entities import ArtifactStatus, EvidenceLabel, ProviderId
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
    auto_publish: bool = False
    min_originality: int = 85


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
            auto_publish=input.auto_publish and input.enabled,
            min_originality=input.min_originality,
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
    published: list[str] = field(default_factory=list)        # artifact ids published automatically
    held: dict[str, str] = field(default_factory=dict)         # artifact id -> why it stayed in Revisión
    reason: str | None = None


def auto_publish_blocker(artifact, report, min_originality: int) -> str | None:
    """None = the draft may go out without a human; otherwise the reason it stays in Revisión.
    The gate is strict on purpose: a false "hold" costs an editor a click, a false
    "publish" puts copied or unverified text in front of readers."""
    if artifact is None:
        return "no se encontró el artículo generado"
    if artifact.status != ArtifactStatus.VALIDATED:
        return f"no pasó las validaciones ({artifact.status.value})"
    unverified = [c for c in artifact.claims if c.label == EvidenceLabel.UNVERIFIED and not c.reviewed]
    if unverified:
        return f"{len(unverified)} afirmación(es) sin evidencia"
    if report is None:
        return "no se pudo ejecutar el control de plagio"
    if report.article_words < 150:
        return f"texto demasiado corto para publicar solo ({report.article_words} palabras)"
    if report.compared_sources == 0:
        return "el control de plagio no encontró fuentes para comparar"
    if report.copied:
        return f"{len(report.copied)} frase(s) copiadas de {report.copied[0].source}"
    if report.originality < min_originality:
        return f"originalidad {report.originality:.0f}% (mínimo {min_originality}%)"
    return None


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
        artifacts=None, check_originality=None, review_artifact=None, publish_artifact=None,
    ) -> None:
        self._artifacts = artifacts
        self._originality = check_originality
        self._review = review_artifact
        self._publish = publish_artifact
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
                if settings.auto_publish:
                    self._auto_publish(getattr(finished, "artifact_id", None), settings.min_originality, report)
                for sibling_id in siblings:  # other outlets' copies of the same story
                    try:
                        self._decide.execute(DecideDiscoveryItemInput(item_id=sibling_id, decision="ARCHIVE"))
                    except Exception:  # noqa: BLE001
                        continue
        return report

    def _auto_publish(self, artifact_id: str | None, min_originality: int, report: AutopilotReport) -> None:
        if not artifact_id or not (self._artifacts and self._originality and self._review and self._publish):
            return
        from app.application.use_cases.artifact import PublishArtifactInput, ReviewArtifactInput
        try:
            artifact = self._artifacts.find_by_id(artifact_id)
            check = None
            if artifact is not None and artifact.status == ArtifactStatus.VALIDATED:
                try:
                    check = self._originality.execute(artifact_id)
                except Exception:  # noqa: BLE001 -- no check => no auto-publish
                    logger.exception("autopilot_originality_failed artifact_id=%s", artifact_id)
            blocker = auto_publish_blocker(artifact, check, min_originality)
            if blocker:
                report.held[artifact_id] = blocker
                return
            self._review.execute(ReviewArtifactInput(artifact_id=artifact_id, decision="APPROVE"))
            self._publish.execute(PublishArtifactInput(artifact_id=artifact_id))
            report.published.append(artifact_id)
            logger.info("autopilot_published artifact_id=%s originality=%s", artifact_id, check.originality)
        except Exception as exc:  # noqa: BLE001 -- a failed publish leaves it in Revisión
            logger.exception("autopilot_publish_failed artifact_id=%s", artifact_id)
            report.held[artifact_id] = f"falló la publicación: {exc}"
