"""Unit tests for the Artifact use cases using in-memory test doubles for
every port -- isolates orchestration from a real LLM call/Supabase, same
pattern as test_discovery.py/test_produce_story.py. FakeGenerator is a
deterministic test double, not a claim that generation works without a
real provider (see test_artifact_llm.py for the real adapter's honest
failure path).
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.domain.artifact.entities import (
    ArtifactGenerationResult, ArtifactJobStatus, ArtifactStatus, Claim, EvidenceLabel, MediaKind, MediaRequirement,
)
from app.domain.category.entities import Category, CategoryGroup
from app.domain.discovery.entities import DiscoveryItem
from app.domain.ports import ArtifactGenerationUnavailableError
from app.domain.shared.errors import InvalidStateTransition, NotFoundError
from app.domain.shared.ids import DiscoveryItemId, StoryId
from app.domain.story.entities import Story, StorySource, StoryStatus
from app.application.use_cases.artifact import (
    GetArtifactJob, PublishArtifact, PublishArtifactInput, ReviewArtifact, ReviewArtifactInput, RunArtifactJob,
    RunArtifactJobInput, TriggerArtifact, TriggerArtifactInput,
)


class InMemoryArtifactJobRepo:
    def __init__(self):
        self.jobs = {}

    def find_by_id(self, job_id):
        return self.jobs.get(job_id)

    def list_recent(self, limit=20):
        return list(self.jobs.values())[:limit]

    def save(self, job):
        self.jobs[job.id] = job


class InMemoryArtifactRepo:
    def __init__(self):
        self.items = {}

    def find_by_id(self, artifact_id):
        return self.items.get(artifact_id)

    def find_latest_for_story(self, story_id):
        matches = [a for a in self.items.values() if str(a.story_id) == story_id]
        return max(matches, key=lambda a: a.version) if matches else None

    def list_by_status(self, status, limit=50):
        return [a for a in self.items.values() if a.status.value == status][:limit]

    def save(self, artifact):
        self.items[str(artifact.id)] = artifact


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


class InMemoryDiscoveryRepo:
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


class FakeCategoryRepo:
    def __init__(self, groups=None):
        self._groups = groups or []

    def list_tree(self):
        return self._groups


class FakePublisher:
    def __init__(self, news_id="news-1", error=None):
        self._news_id = news_id
        self._error = error
        self.calls = []

    def publish(self, artifact, category_name):
        if self._error:
            raise self._error
        self.calls.append((artifact, category_name))
        return self._news_id


class FakeGenerator:
    def __init__(self, result=None, error=None):
        self._result = result
        self._error = error

    def generate(self, request):
        if self._error:
            raise self._error
        return self._result


def _valid_result(category_name="Fútbol"):
    return ArtifactGenerationResult(
        title="Un título original", subtitle="Subtítulo", excerpt="Extracto", summary="Resumen",
        content_html="<article><p>Texto real de al menos un párrafo.</p></article>",
        category_name=category_name, tags=["futbol"], entities=["River Plate"],
        seo_title="Título SEO corto", seo_description="Una descripción SEO de largo razonable para pasar la validación.",
        slug="un-titulo-original",
        claims=[Claim(text="River ganó", label=EvidenceLabel.SOURCE_FACT, source_urls=["https://example.com/a"])],
        media_requirements=[MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto")],
    )


def _seed_story_and_discovery_item(stories, discovery_items, story_id="s1"):
    story = Story.open_from_news(StoryId.of(story_id), "Un evento real", StorySource(news_id=None, source_url="https://example.com/a"))
    stories.save(story)
    item = DiscoveryItem.discover(
        item_id=DiscoveryItemId.of(story_id), source_url="https://example.com/a", original_url="https://example.com/a",
        original_title="Un evento real", raw_text="Contenido real de la fuente.", source_name="Example",
        source_domain="example.com", discovered_at=datetime.now(timezone.utc),
    )
    discovery_items.save(item)
    return story, item


def _categories():
    futbol = Category(id="cat-futbol", group_id="grp-deportes", name="Fútbol", slug="futbol", sort_order=1, active=True, topics=[])
    return [CategoryGroup(id="grp-deportes", name="Deportes", slug="deportes", sort_order=1, active=True, categories=[futbol])]


def test_trigger_artifact_creates_queued_job():
    jobs, stories = InMemoryArtifactJobRepo(), InMemoryStoryRepo()
    story = Story.open_from_news(StoryId.of("s1"), "H", StorySource(news_id=None, source_url="u"))
    stories.save(story)
    job = TriggerArtifact(jobs, stories).execute(TriggerArtifactInput(story_id="s1"))
    assert job.status == ArtifactJobStatus.QUEUED
    assert jobs.find_by_id(job.id) is job


def test_trigger_artifact_raises_not_found_for_unknown_story():
    with pytest.raises(NotFoundError):
        TriggerArtifact(InMemoryArtifactJobRepo(), InMemoryStoryRepo()).execute(TriggerArtifactInput(story_id="missing"))


def test_get_artifact_job_raises_not_found():
    with pytest.raises(NotFoundError):
        GetArtifactJob(InMemoryArtifactJobRepo()).execute("missing")


def test_run_artifact_job_produces_validated_artifact_end_to_end():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories).execute(TriggerArtifactInput(story_id="s1"))

    generator = FakeGenerator(result=_valid_result())
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), generator)
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    assert result_job.status == ArtifactJobStatus.COMPLETED
    assert result_job.artifact_id is not None
    artifact = artifacts.find_by_id(result_job.artifact_id)
    assert artifact.status == ArtifactStatus.VALIDATED
    assert artifact.category_id == "cat-futbol"
    assert artifact.sources[0].source_url == "https://example.com/a"


def test_run_artifact_job_marks_review_required_when_validation_fails():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories).execute(TriggerArtifactInput(story_id="s1"))

    bad_result = _valid_result(category_name="No Existe")  # not a real category
    generator = FakeGenerator(result=bad_result)
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), generator)
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    assert result_job.status == ArtifactJobStatus.REVIEW_REQUIRED
    artifact = artifacts.find_by_id(result_job.artifact_id)
    assert artifact.status == ArtifactStatus.REVIEW_REQUIRED
    assert artifact.category_id is None  # unmatched category_name never gets fabricated into a fake id


def test_run_artifact_job_fails_honestly_when_generator_unavailable():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories).execute(TriggerArtifactInput(story_id="s1"))

    generator = FakeGenerator(error=ArtifactGenerationUnavailableError("ANTHROPIC_API_KEY is not configured"))
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), generator)
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    assert result_job.status == ArtifactJobStatus.FAILED
    assert "not configured" in result_job.error
    assert len(artifacts.items) == 0  # no fabricated Artifact was saved


def test_run_artifact_job_fails_when_no_discovery_item_backs_the_story():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    story = Story.open_from_news(StoryId.of("s1"), "H", StorySource(news_id=None, source_url="u"))
    stories.save(story)  # no matching DiscoveryItem saved
    job = TriggerArtifact(jobs, stories).execute(TriggerArtifactInput(story_id="s1"))

    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(), FakeGenerator())
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    assert result_job.status == ArtifactJobStatus.FAILED
    assert "DiscoveryItem" in result_job.error


def test_review_artifact_approve_advances_story_to_produced():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories).execute(TriggerArtifactInput(story_id="s1"))
    RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeGenerator(result=_valid_result())) \
        .execute(RunArtifactJobInput(job_id=job.id))
    artifact = list(artifacts.items.values())[0]

    result = ReviewArtifact(artifacts, stories).execute(ReviewArtifactInput(artifact_id=str(artifact.id), decision="APPROVE"))

    assert result.status == ArtifactStatus.APPROVED
    assert stories.find_by_id("s1").status == StoryStatus.PRODUCED


def _approved_artifact_and_story():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories).execute(TriggerArtifactInput(story_id="s1"))
    RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeGenerator(result=_valid_result())) \
        .execute(RunArtifactJobInput(job_id=job.id))
    artifact = list(artifacts.items.values())[0]
    ReviewArtifact(artifacts, stories).execute(ReviewArtifactInput(artifact_id=str(artifact.id), decision="APPROVE"))
    return artifacts, stories, artifact


def test_publish_artifact_writes_real_row_and_advances_story():
    artifacts, stories, artifact = _approved_artifact_and_story()
    publisher = FakePublisher(news_id="news-42")

    result = PublishArtifact(artifacts, stories, FakeCategoryRepo(_categories()), publisher) \
        .execute(PublishArtifactInput(artifact_id=str(artifact.id)))

    assert result.status == ArtifactStatus.PUBLISHED
    assert result.published_news_id == "news-42"
    assert stories.find_by_id("s1").status == StoryStatus.PUBLISHED
    assert len(publisher.calls) == 1
    published_artifact, category_name = publisher.calls[0]
    assert published_artifact is result
    assert category_name == "Fútbol"  # resolved from the real taxonomy, not the raw id


def test_publish_artifact_requires_approved_status():
    artifacts, stories, artifact = _approved_artifact_and_story()
    publisher = FakePublisher()
    use_case = PublishArtifact(artifacts, stories, FakeCategoryRepo(_categories()), publisher)
    use_case.execute(PublishArtifactInput(artifact_id=str(artifact.id)))  # first publish succeeds

    with pytest.raises(InvalidStateTransition):
        use_case.execute(PublishArtifactInput(artifact_id=str(artifact.id)))  # second publish is rejected
    assert len(publisher.calls) == 1  # no duplicate external write was attempted


def test_publish_artifact_raises_not_found_for_unknown_artifact():
    artifacts, stories = InMemoryArtifactRepo(), InMemoryStoryRepo()
    with pytest.raises(NotFoundError):
        PublishArtifact(artifacts, stories, FakeCategoryRepo(), FakePublisher()) \
            .execute(PublishArtifactInput(artifact_id="missing"))


def test_review_artifact_approve_requires_validated_status():
    artifacts, stories = InMemoryArtifactRepo(), InMemoryStoryRepo()
    from app.domain.artifact.entities import Artifact, SeoMetadata
    from app.domain.shared.ids import ArtifactId
    a = Artifact.draft(
        artifact_id=ArtifactId.new(), story_id=StoryId.of("s1"), version=1, title="t", subtitle=None,
        excerpt="e", summary="s", content_html="<article><p>x</p></article>", category_id=None, tags=[],
        entities=[], seo=SeoMetadata(seo_title="t", seo_description="d", slug="t"), sources=[], claims=[],
        media_requirements=[], created_at=datetime.now(timezone.utc),
    )
    artifacts.save(a)
    with pytest.raises(InvalidStateTransition):
        ReviewArtifact(artifacts, stories).execute(ReviewArtifactInput(artifact_id=str(a.id), decision="APPROVE"))
