"""Discovery use cases -- orchestration only. All real editorial/
classification logic lives in app.domain.discovery (classification.py,
scoring.py, entities.py); this module wires ports together, same
separation ProduceStory already established for the narrative pipeline.
"""
from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse

from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import DiscoveryItemId, StoryId
from app.domain.story.entities import Story, StorySource
from app.domain.discovery.classification import classify
from app.domain.discovery.scoring import compute_completeness_score, compute_freshness_score, compute_material_score
from app.domain.discovery.entities import (
    DiscoveryFilters, DiscoveryItem, DiscoveryJob, DiscoveryJobStatus, DiscoveryScores,
    DiscoveryStatus, MaterialKind, MaterialReference,
)
from app.domain.ports import (
    CategoryRepository, DiscoveryContentReaderPort, DiscoveryJobRepository, DiscoveryRepository,
    DiscoveryRunnerPort, StoryRepository,
)


@dataclass
class TriggerDiscoveryInput:
    max_sources: int | None = None
    max_items: int | None = None


class TriggerDiscovery:
    """DISCOVERY UP -- creates a real job and asks Automation to run a
    real ingestion pass. Never fabricates progress: the job starts
    QUEUED and only moves forward when automation/runtime actually
    reports back (see ReportDiscoveryJobStatus)."""

    def __init__(self, jobs: DiscoveryJobRepository, runner: DiscoveryRunnerPort) -> None:
        self._jobs = jobs
        self._runner = runner

    def execute(self, input: TriggerDiscoveryInput) -> DiscoveryJob:
        params = {}
        if input.max_sources is not None:
            params["max_sources"] = input.max_sources
        if input.max_items is not None:
            params["max_items"] = input.max_items

        job = DiscoveryJob(
            id=str(uuid.uuid4()), status=DiscoveryJobStatus.QUEUED, params=params,
            created_at=datetime.now(timezone.utc),
        )
        self._jobs.save(job)
        # If automation/runtime can't be reached, this raises
        # RuntimeUnavailableError -- the job stays QUEUED, never silently
        # marked as running when nothing is actually running.
        self._runner.trigger(job.id, params)
        return job


class RequestStopDiscoveryJob:
    """A real, cooperative stop -- never kills the running scrape.
    Marks the job CANCELLING (visible to the UI immediately) and asks
    automation/runtime to signal the ingestion loop; the job only
    reaches CANCELLED once automation/runtime reports back with
    whatever it actually managed to save (ReportDiscoveryJobStatus)."""

    def __init__(self, jobs: DiscoveryJobRepository, runner: DiscoveryRunnerPort) -> None:
        self._jobs = jobs
        self._runner = runner

    def execute(self, job_id: str) -> DiscoveryJob:
        job = self._jobs.find_by_id(job_id)
        if job is None:
            raise NotFoundError("DiscoveryJob", job_id)
        job.request_cancel()
        self._jobs.save(job)
        # If automation/runtime can't be reached, this raises -- the job
        # stays CANCELLING (real, honest), never silently marked stopped.
        self._runner.request_stop(job_id)
        return job


class GetDiscoveryJob:
    def __init__(self, jobs: DiscoveryJobRepository) -> None:
        self._jobs = jobs

    def execute(self, job_id: str) -> DiscoveryJob:
        job = self._jobs.find_by_id(job_id)
        if job is None:
            raise NotFoundError("DiscoveryJob", job_id)
        return job


class ListDiscoveryJobs:
    def __init__(self, jobs: DiscoveryJobRepository) -> None:
        self._jobs = jobs

    def execute(self, limit: int = 20) -> list[DiscoveryJob]:
        return self._jobs.list_recent(limit)


@dataclass
class ReportDiscoveryJobStatusInput:
    job_id: str
    status: str  # "RUNNING" | "COMPLETED" | "FAILED"
    items_found: int | None = None
    item_ids: list[str] | None = None
    error: str | None = None


class ReportDiscoveryJobStatus:
    """The callback automation/runtime posts to as a real discovery job
    actually progresses (PATCH /api/discovery/jobs/{id}). On COMPLETED,
    this is also where raw ingested content becomes real DiscoveryItem
    entities -- classification + the scores that are actually computable
    happen here, once, not guessed again later by the frontend."""

    def __init__(
        self, jobs: DiscoveryJobRepository, items: DiscoveryRepository,
        content_reader: DiscoveryContentReaderPort, categories: CategoryRepository,
    ) -> None:
        self._jobs = jobs
        self._items = items
        self._content_reader = content_reader
        self._categories = categories

    def execute(self, input: ReportDiscoveryJobStatusInput) -> DiscoveryJob:
        job = self._jobs.find_by_id(input.job_id)
        if job is None:
            raise NotFoundError("DiscoveryJob", input.job_id)

        now = datetime.now(timezone.utc)
        if input.status == "RUNNING":
            job.start()
        elif input.status == "FAILED":
            job.fail(input.error or "unknown error", now)
        elif input.status == "COMPLETED":
            item_ids = input.item_ids or []
            saved = self._ingest_items(item_ids, now)
            job.complete(items_found=len(saved), finished_at=now)
        elif input.status == "CANCELLED":
            # Stop was requested (RequestStopDiscoveryJob) -- ingest
            # whatever the loop actually saved before it stopped, same as
            # COMPLETED. Never discards real, already-saved items just
            # because the run ended early.
            item_ids = input.item_ids or []
            saved = self._ingest_items(item_ids, now)
            job.cancel(items_found=len(saved), finished_at=now)
        else:
            raise ValueError(f"unknown discovery job status: {input.status!r}")

        self._jobs.save(job)
        return job

    def _ingest_items(self, item_ids: list[str], discovered_at: datetime) -> list[DiscoveryItem]:
        if not item_ids:
            return []
        raw_items = self._content_reader.read_many(item_ids)
        groups = self._categories.list_tree()

        saved: list[DiscoveryItem] = []
        for raw in raw_items:
            if self._items.exists_by_source_url(raw.source_url):
                continue  # already discovered in a previous run -- never duplicate

            text_for_classification = f"{raw.title}\n{raw.content or ''}"
            category_id, topics = classify(text_for_classification, groups)

            published_at = datetime.fromisoformat(raw.published_at) if raw.published_at else None
            materials = [MaterialReference(kind=MaterialKind.IMAGE, url=raw.image_url)] if raw.image_url else []

            scores = DiscoveryScores(
                freshness_score=compute_freshness_score(published_at, discovered_at),
                completeness_score=compute_completeness_score(
                    has_title=bool(raw.title), has_content=bool(raw.content), has_image=bool(raw.image_url),
                    has_published_at=published_at is not None, has_author=False,  # LAB's ingestion doesn't capture author yet
                ),
                material_score=compute_material_score(len(materials)),
            )

            item = DiscoveryItem.discover(
                item_id=DiscoveryItemId.of(raw.id), source_url=raw.source_url, original_url=raw.source_url,
                original_title=raw.title, raw_text=raw.content or "", source_name=raw.source,
                source_domain=_domain_of(raw.source_url), discovered_at=discovered_at, published_at=published_at,
                category_id=category_id, topics=topics, materials=materials, scores=scores,
            )
            self._items.save(item)
            saved.append(item)
        return saved


class ListDiscoveryItems:
    def __init__(self, items: DiscoveryRepository) -> None:
        self._items = items

    def execute(self, filters: DiscoveryFilters) -> list[DiscoveryItem]:
        return self._items.list(filters)


@dataclass
class DecideDiscoveryItemInput:
    item_id: str
    decision: str  # "SELECT" | "IGNORE" | "ARCHIVE" | "SEND_TO_EDITORIAL"


class DecideDiscoveryItem:
    """SELECT/IGNORE/ARCHIVE/SEND_TO_EDITORIAL -- the only editorial
    decisions Discovery itself makes about an item are these state
    transitions. SEND_TO_EDITORIAL is where a DiscoveryItem crosses into
    the existing Story pipeline (Story already is conceptually POST, see
    obsidian-vault/CRONOS - Domain Language Alignment.md) -- it creates a
    real Story, it never fabricates one silently earlier."""

    def __init__(self, items: DiscoveryRepository, stories: StoryRepository) -> None:
        self._items = items
        self._stories = stories

    def execute(self, input: DecideDiscoveryItemInput) -> DiscoveryItem:
        item = self._items.find_by_id(input.item_id)
        if item is None:
            raise NotFoundError("DiscoveryItem", input.item_id)

        if input.decision == "SELECT":
            item.select()
        elif input.decision == "IGNORE":
            item.ignore()
        elif input.decision == "ARCHIVE":
            item.archive()
        elif input.decision == "SEND_TO_EDITORIAL":
            story = Story.open_from_news(
                StoryId.of(str(item.id)), item.original_title,
                StorySource(news_id=None, source_url=item.original_url, label="discovery"),
            )
            self._stories.save(story)
            item.send_to_editorial(story.id)
        else:
            raise ValueError(f"unknown discovery decision: {input.decision!r}")

        self._items.save(item)
        return item


@dataclass
class AssignDiscoveryItemInput:
    item_id: str
    assignee: str | None


class AssignDiscoveryItem:
    def __init__(self, items: DiscoveryRepository) -> None:
        self._items = items

    def execute(self, input: AssignDiscoveryItemInput) -> DiscoveryItem:
        item = self._items.find_by_id(input.item_id)
        if item is None:
            raise NotFoundError("DiscoveryItem", input.item_id)
        item.assign_to(input.assignee)
        self._items.save(item)
        return item


def _domain_of(url: str) -> str:
    from urllib.parse import urlparse
    return urlparse(url).netloc or url


class RunQueuedDiscoveryJobs:
    """Worker side of serverless discovery (GitHub Actions, automation/run_discovery_jobs.py).

    Runs every QUEUED job over the configured sources. A stop request is honoured between
    sources: the job is re-read from storage, and once it is CANCELLING the worker keeps what
    it saved and marks it CANCELLED. A job stopped before it started is closed without
    running. One failing feed no longer fails the whole search: the job only fails when
    every source failed."""

    def __init__(
        self,
        jobs: DiscoveryJobRepository,
        fetch_records: Callable[[str], list[dict]],
        save_record: Callable[[dict, str], bool],
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ) -> None:
        self._jobs = jobs
        self._fetch = fetch_records
        self._save = save_record
        self._now = now

    def execute(self, sources: list[str]) -> int:
        processed = 0
        for job in self._jobs.list_recent(limit=100):
            if job.status == DiscoveryJobStatus.CANCELLING and job.started_at is None:
                job.cancel(items_found=0, finished_at=self._now())
                self._jobs.save(job)
                continue
            if job.status != DiscoveryJobStatus.QUEUED:
                continue
            self._run(job, sources)
            processed += 1
        return processed

    def _stop_requested(self, job_id: str) -> bool:
        current = self._jobs.find_by_id(job_id)
        return current is not None and current.status == DiscoveryJobStatus.CANCELLING

    def _run(self, job: DiscoveryJob, sources: list[str]) -> None:
        job.start()
        self._jobs.save(job)
        saved = 0
        errors: list[str] = []
        for source in sources:
            if self._stop_requested(job.id):
                job.cancel(items_found=saved, finished_at=self._now())
                self._jobs.save(job)
                return
            source_name = urlparse(source).hostname or source
            try:
                for record in self._fetch(source):
                    if self._save(record, source_name):
                        saved += 1
            except Exception as exc:  # noqa: BLE001 -- one broken feed must not stop the others
                errors.append(f"{source_name}: {exc}")
        if self._stop_requested(job.id):
            job.cancel(items_found=saved, finished_at=self._now())
        elif sources and len(errors) == len(sources):
            job.fail("; ".join(errors)[:1000], self._now())
        elif not sources:
            job.fail("No hay fuentes configuradas (SCRAPER_SOURCES)", self._now())
        else:
            job.complete(items_found=saved, finished_at=self._now())
        self._jobs.save(job)
