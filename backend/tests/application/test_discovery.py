"""Unit tests for the Discovery use cases using in-memory test doubles for
every port -- isolates orchestration from real Supabase/automation I/O,
same pattern as test_produce_story.py.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.domain.category.entities import Category, CategoryGroup, Topic
from app.domain.discovery.entities import DiscoveryFilters, DiscoveryItem, DiscoveryJob, DiscoveryJobStatus, IngestedContent
from app.domain.ports import RuntimeUnavailableError
from app.domain.shared.errors import InvalidStateTransition, NotFoundError
from app.application.use_cases.discovery import (
    DecideDiscoveryItem, DecideDiscoveryItemInput, GetDiscoveryJob, ListDiscoveryItems,
    ReportDiscoveryJobStatus, ReportDiscoveryJobStatusInput, RequestStopDiscoveryJob, TriggerDiscovery,
    TriggerDiscoveryInput,
)


class InMemoryJobRepo:
    def __init__(self):
        self.jobs = {}

    def find_by_id(self, job_id):
        return self.jobs.get(job_id)

    def list_recent(self, limit=20):
        return list(self.jobs.values())[:limit]

    def save(self, job):
        self.jobs[job.id] = job


class InMemoryItemRepo:
    def __init__(self):
        self.items = {}

    def find_by_id(self, item_id):
        return self.items.get(item_id)

    def list(self, filters):
        return list(self.items.values())

    def exists_by_source_url(self, source_url):
        return any(i.source_url == source_url for i in self.items.values())

    def save(self, item):
        self.items[str(item.id)] = item


class InMemoryStoryRepo:
    def __init__(self):
        self.saved = {}

    def find_by_id(self, story_id):
        return self.saved.get(story_id)

    def find_by_source_news_id(self, news_id):
        return None

    def list_recent(self, limit):
        return list(self.saved.values())

    def save(self, story):
        self.saved[str(story.id)] = story


class FakeRunner:
    def __init__(self, should_fail=False):
        self.calls = []
        self.stop_calls = []
        self.should_fail = should_fail

    def trigger(self, job_id, params):
        if self.should_fail:
            raise RuntimeUnavailableError("automation/runtime unreachable")
        self.calls.append((job_id, params))

    def request_stop(self, job_id):
        if self.should_fail:
            raise RuntimeUnavailableError("automation/runtime unreachable")
        self.stop_calls.append(job_id)


class FakeContentReader:
    def __init__(self, items: list[IngestedContent]):
        self._items = {i.id: i for i in items}

    def read_many(self, item_ids):
        return [self._items[i] for i in item_ids if i in self._items]


class FakeCategoryRepo:
    def __init__(self, groups=None):
        self._groups = groups or []

    def list_tree(self):
        return self._groups


def test_trigger_discovery_creates_a_queued_job_and_calls_the_runner():
    jobs, runner = InMemoryJobRepo(), FakeRunner()
    job = TriggerDiscovery(jobs, runner).execute(TriggerDiscoveryInput(max_sources=5))
    assert job.status == DiscoveryJobStatus.QUEUED
    assert jobs.find_by_id(job.id) is job
    assert runner.calls == [(job.id, {"max_sources": 5})]


def test_request_stop_marks_cancelling_and_calls_runner():
    jobs, runner = InMemoryJobRepo(), FakeRunner()
    job = TriggerDiscovery(jobs, runner).execute(TriggerDiscoveryInput())
    job.start()
    jobs.save(job)

    result = RequestStopDiscoveryJob(jobs, runner).execute(job.id)

    assert result.status == DiscoveryJobStatus.CANCELLING
    assert runner.stop_calls == [job.id]


def test_request_stop_raises_not_found_for_unknown_job():
    with pytest.raises(NotFoundError):
        RequestStopDiscoveryJob(InMemoryJobRepo(), FakeRunner()).execute("missing")


def test_report_cancelled_ingests_real_items_saved_before_stop():
    jobs, items = InMemoryJobRepo(), InMemoryItemRepo()
    job = DiscoveryJob(id="job1", status=DiscoveryJobStatus.QUEUED, params={}, created_at=datetime.now(timezone.utc))
    jobs.save(job)
    job.start()
    job.request_cancel()
    jobs.save(job)

    raw = IngestedContent(
        id="item-abc", title="Un evento real", source_url="https://example.com/a", source="Example",
        image_url=None, content="Contenido real", published_at=None,
        ingested_at=datetime.now(timezone.utc).isoformat(), slug="un-evento",
    )
    use_case = ReportDiscoveryJobStatus(jobs, items, FakeContentReader([raw]), FakeCategoryRepo())
    result = use_case.execute(ReportDiscoveryJobStatusInput(job_id="job1", status="CANCELLED", item_ids=["item-abc"]))

    assert result.status == DiscoveryJobStatus.CANCELLED
    assert result.items_found == 1
    assert items.find_by_id("item-abc") is not None


def test_trigger_discovery_leaves_job_queued_if_runtime_unreachable():
    jobs, runner = InMemoryJobRepo(), FakeRunner(should_fail=True)
    with pytest.raises(RuntimeUnavailableError):
        TriggerDiscovery(jobs, runner).execute(TriggerDiscoveryInput())
    # A job was still recorded (so the failure is visible), but never
    # marked as running -- no fake progress.
    saved_job = list(jobs.jobs.values())[0]
    assert saved_job.status == DiscoveryJobStatus.QUEUED


def test_get_discovery_job_raises_not_found():
    with pytest.raises(NotFoundError):
        GetDiscoveryJob(InMemoryJobRepo()).execute("missing")


def _categories_with_futbol():
    futbol = Category(
        id="cat-futbol", group_id="grp-deportes", name="Fútbol", slug="futbol", sort_order=1, active=True,
        topics=[Topic(id="t1", category_id="cat-futbol", name="Champions League", slug="champions-league")],
    )
    return [CategoryGroup(id="grp-deportes", name="Deportes", slug="deportes", sort_order=1, active=True, categories=[futbol])]


def test_report_completed_ingests_real_items_with_classification_and_scores():
    jobs, items = InMemoryJobRepo(), InMemoryItemRepo()
    job = DiscoveryJob(id="job1", status=DiscoveryJobStatus.QUEUED, params={}, created_at=datetime.now(timezone.utc))
    jobs.save(job)
    job.start()
    jobs.save(job)

    raw = IngestedContent(
        id="item-abc", title="River gana la Champions League", source_url="https://example.com/a",
        source="Example", image_url="https://example.com/img.jpg", content="Un partidazo real",
        published_at=datetime.now(timezone.utc).isoformat(), ingested_at=datetime.now(timezone.utc).isoformat(),
        slug="river-gana",
    )
    reader = FakeContentReader([raw])
    categories = FakeCategoryRepo(_categories_with_futbol())

    use_case = ReportDiscoveryJobStatus(jobs, items, reader, categories)
    result = use_case.execute(ReportDiscoveryJobStatusInput(job_id="job1", status="COMPLETED", item_ids=["item-abc"]))

    assert result.status == DiscoveryJobStatus.COMPLETED
    assert result.items_found == 1
    saved_item = items.find_by_id("item-abc")
    assert saved_item.original_title == "River gana la Champions League"
    assert saved_item.category_id == "cat-futbol"
    assert "Champions League" in saved_item.topics
    assert saved_item.scores.freshness_score == pytest.approx(1.0, abs=0.01)
    assert saved_item.scores.material_score == 1.0
    assert saved_item.scores.relevance_score is None  # honestly unavailable, never fabricated


def test_report_completed_never_duplicates_an_already_known_source_url():
    jobs, items = InMemoryJobRepo(), InMemoryItemRepo()
    job = DiscoveryJob(id="job1", status=DiscoveryJobStatus.RUNNING, params={}, created_at=datetime.now(timezone.utc))
    jobs.save(job)

    raw = IngestedContent(
        id="item-abc", title="T", source_url="https://example.com/a", source=None, image_url=None,
        content="c", published_at=None, ingested_at=datetime.now(timezone.utc).isoformat(), slug=None,
    )
    # Pre-seed an item with the same source_url, as if a previous run already found it.
    from app.domain.discovery.entities import DiscoveryItem as DI, DiscoveryScores
    from app.domain.shared.ids import DiscoveryItemId
    items.save(DI.discover(
        item_id=DiscoveryItemId.of("existing"), source_url="https://example.com/a", original_url="https://example.com/a",
        original_title="Already known", raw_text="x", source_name=None, source_domain="example.com",
        discovered_at=datetime.now(timezone.utc),
    ))

    use_case = ReportDiscoveryJobStatus(jobs, items, FakeContentReader([raw]), FakeCategoryRepo())
    result = use_case.execute(ReportDiscoveryJobStatusInput(job_id="job1", status="COMPLETED", item_ids=["item-abc"]))

    assert result.items_found == 0
    assert items.find_by_id("item-abc") is None


def test_report_failed_records_the_real_error():
    jobs = InMemoryJobRepo()
    job = DiscoveryJob(id="job1", status=DiscoveryJobStatus.RUNNING, params={}, created_at=datetime.now(timezone.utc))
    jobs.save(job)
    use_case = ReportDiscoveryJobStatus(jobs, InMemoryItemRepo(), FakeContentReader([]), FakeCategoryRepo())
    result = use_case.execute(ReportDiscoveryJobStatusInput(job_id="job1", status="FAILED", error="network timeout"))
    assert result.status == DiscoveryJobStatus.FAILED
    assert result.error == "network timeout"


def _seed_item(items_repo, status=None):
    from app.domain.discovery.entities import DiscoveryItem as DI
    from app.domain.shared.ids import DiscoveryItemId
    item = DI.discover(
        item_id=DiscoveryItemId.new(), source_url="https://example.com/x", original_url="https://example.com/x",
        original_title="Title", raw_text="text", source_name="Example", source_domain="example.com",
        discovered_at=datetime.now(timezone.utc),
    )
    if status:
        item.status = status
    items_repo.save(item)
    return item


def test_decide_select_then_send_to_editorial_creates_a_real_story():
    items, stories = InMemoryItemRepo(), InMemoryStoryRepo()
    item = _seed_item(items)
    use_case = DecideDiscoveryItem(items, stories)

    use_case.execute(DecideDiscoveryItemInput(item_id=str(item.id), decision="SELECT"))
    result = use_case.execute(DecideDiscoveryItemInput(item_id=str(item.id), decision="SEND_TO_EDITORIAL"))

    assert result.story_id is not None
    story = stories.find_by_id(str(result.story_id))
    assert story is not None
    assert story.headline == "Title"
    assert story.sources[0].label == "discovery"


def test_decide_send_to_editorial_requires_selected_first():
    items, stories = InMemoryItemRepo(), InMemoryStoryRepo()
    item = _seed_item(items)
    use_case = DecideDiscoveryItem(items, stories)
    with pytest.raises(InvalidStateTransition):
        use_case.execute(DecideDiscoveryItemInput(item_id=str(item.id), decision="SEND_TO_EDITORIAL"))


def test_list_discovery_items_delegates_to_repository():
    items = InMemoryItemRepo()
    item = _seed_item(items)
    result = ListDiscoveryItems(items).execute(DiscoveryFilters())
    assert result == [item]
