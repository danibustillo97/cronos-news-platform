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
    ArtifactGenerationResult, ArtifactJobStatus, ArtifactStatus, Claim, ClaimResolutionResult, EvidenceLabel,
    MediaKind, MediaRequirement, ProviderCheckResult, ProviderId, ProviderStatus, SeoFixResult,
)
from app.domain.category.entities import Category, CategoryGroup
from app.domain.discovery.entities import DiscoveryItem
from app.domain.ports import ArtifactGenerationUnavailableError
from app.domain.shared.errors import InvalidStateTransition, NotFoundError
from app.domain.shared.ids import DiscoveryItemId, StoryId
from app.domain.story.entities import Story, StorySource, StoryStatus
from app.application.use_cases.artifact import (
    ArchiveArtifact, ArchiveArtifactInput, GetArtifactJob, ListArtifactJobsForStory, MarkClaimReviewed,
    MarkClaimReviewedInput, ProposeClaimResolution, ProposeClaimResolutionInput, ProposeSeoFix, ProposeSeoFixInput,
    PublishArtifact, PublishArtifactInput, ReviewArtifact, ReviewArtifactInput, RunArtifactJob, RunArtifactJobInput,
    TriggerArtifact, TriggerArtifactInput, UpdateArtifact, UpdateArtifactInput,
)


class InMemoryArtifactJobRepo:
    def __init__(self):
        self.jobs = {}

    def find_by_id(self, job_id):
        return self.jobs.get(job_id)

    def find_latest_for_story(self, story_id):
        matches = [j for j in self.jobs.values() if str(j.story_id) == story_id]
        return max(matches, key=lambda j: j.created_at) if matches else None

    def list_for_story(self, story_id, limit=20):
        matches = [j for j in self.jobs.values() if str(j.story_id) == story_id]
        return sorted(matches, key=lambda j: j.created_at, reverse=True)[:limit]

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

    def publish(self, artifact, category_name, image_url, content_html):
        if self._error:
            raise self._error
        self.calls.append((artifact, category_name, image_url, content_html))
        return self._news_id


class FakeAssetRepo:
    def __init__(self):
        self.items = {}

    def find_by_id(self, asset_id):
        return self.items.get(asset_id)

    def list_for_story(self, story_id):
        return [a for a in self.items.values() if str(a.story_id) == story_id]

    def save(self, asset):
        self.items[str(asset.id)] = asset


class FakeStorage:
    def resolve_url(self, storage_ref):
        return f"https://cdn.example.com/{storage_ref}"


class FakeGenerator:
    def __init__(
        self, result=None, error=None, seo_fix_result=None, seo_fix_error=None,
        claim_resolution_result=None, claim_resolution_error=None,
    ):
        self._result = result
        self._error = error
        self._seo_fix_result = seo_fix_result
        self._seo_fix_error = seo_fix_error
        self._claim_resolution_result = claim_resolution_result
        self._claim_resolution_error = claim_resolution_error
        self.seo_fix_calls = []
        self.claim_resolution_calls = []

    def generate(self, request):
        if self._error:
            raise self._error
        return self._result

    def suggest_seo_fix(self, request):
        self.seo_fix_calls.append(request)
        if self._seo_fix_error:
            raise self._seo_fix_error
        result = self._seo_fix_result
        return result(request) if callable(result) else result

    def resolve_claim(self, request):
        self.claim_resolution_calls.append(request)
        if self._claim_resolution_error:
            raise self._claim_resolution_error
        result = self._claim_resolution_result
        return result(request) if callable(result) else result

    def check_status(self):
        return ProviderCheckResult(ProviderId.ANTHROPIC, ProviderStatus.CONNECTED, version="fake-model-1")


class FakeProviderResolver:
    """Always resolves to the one fake generator under test -- provider
    selection/switching logic itself is covered by
    test_provider_resolver.py, not here."""

    def __init__(self, generator=None):
        self._generator = generator or FakeGenerator()

    def resolve(self, requested):
        return ProviderId.ANTHROPIC

    def get(self, provider_id):
        return self._generator

    def all_providers(self):
        return {ProviderId.ANTHROPIC: self._generator}

    def default_provider_id(self):
        return "anthropic"


def _valid_result(category_name="Fútbol"):
    return ArtifactGenerationResult(
        title="Un título original", subtitle="Subtítulo", excerpt="Extracto", summary="Resumen",
        content_html="<article><p>Texto real de al menos un párrafo.</p></article>",
        category_name=category_name, tags=["futbol"], entities=["River Plate"],
        seo_title="Título SEO corto", seo_description="Una descripción SEO de largo razonable para pasar la validación.",
        slug="un-titulo-original",
        claims=[Claim(id="claim-1", text="River ganó", label=EvidenceLabel.SOURCE_FACT, source_urls=["https://example.com/a"])],
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
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))
    assert job.status == ArtifactJobStatus.QUEUED
    assert jobs.find_by_id(job.id) is job


def test_trigger_artifact_raises_not_found_for_unknown_story():
    with pytest.raises(NotFoundError):
        TriggerArtifact(InMemoryArtifactJobRepo(), InMemoryStoryRepo(), FakeProviderResolver()).execute(TriggerArtifactInput(story_id="missing"))


def test_get_artifact_job_raises_not_found():
    with pytest.raises(NotFoundError):
        GetArtifactJob(InMemoryArtifactJobRepo()).execute("missing")


def test_trigger_artifact_persists_resolved_provider_and_model():
    jobs, stories = InMemoryArtifactJobRepo(), InMemoryStoryRepo()
    story = Story.open_from_news(StoryId.of("s1"), "H", StorySource(news_id=None, source_url="u"))
    stories.save(story)
    generator = FakeGenerator()  # check_status() returns version="fake-model-1"

    job = TriggerArtifact(jobs, stories, FakeProviderResolver(generator)).execute(
        TriggerArtifactInput(story_id="s1", provider="anthropic")
    )

    assert job.provider == "anthropic"
    assert job.model == "fake-model-1"


def test_run_artifact_job_never_reresolves_provider_mid_run():
    """No silent switch: RunArtifactJob must use job.provider exactly as
    persisted at trigger time, even if a DIFFERENT resolver/default would
    pick something else by the time it actually runs."""
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))
    assert job.provider == "anthropic"  # FakeProviderResolver always resolves to anthropic

    used_provider_ids = []

    class TrackingResolver(FakeProviderResolver):
        def get(self, provider_id):
            used_provider_ids.append(provider_id)
            return super().get(provider_id)

    use_case = RunArtifactJob(
        jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()),
        TrackingResolver(FakeGenerator(result=_valid_result())),
    )
    use_case.execute(RunArtifactJobInput(job_id=job.id))

    assert used_provider_ids == [ProviderId.ANTHROPIC]  # exactly the persisted choice, resolved once


def test_retry_with_a_different_explicit_provider_after_a_failure():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)

    failing = FakeGenerator(error=ArtifactGenerationUnavailableError("provider A down"))
    job1 = TriggerArtifact(jobs, stories, FakeProviderResolver(failing)).execute(TriggerArtifactInput(story_id="s1"))
    RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(failing)) \
        .execute(RunArtifactJobInput(job_id=job1.id))
    assert jobs.find_by_id(job1.id).status == ArtifactJobStatus.FAILED

    # A human explicitly retries with a different provider -- a brand new
    # job, never the same one silently switched underneath it.
    working = FakeGenerator(result=_valid_result())
    job2 = TriggerArtifact(jobs, stories, FakeProviderResolver(working)).execute(TriggerArtifactInput(story_id="s1", provider="claude_code"))
    assert job2.id != job1.id
    RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(working)) \
        .execute(RunArtifactJobInput(job_id=job2.id))
    assert jobs.find_by_id(job2.id).status == ArtifactJobStatus.COMPLETED


def test_run_artifact_job_produces_validated_artifact_end_to_end():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    generator = FakeGenerator(result=_valid_result())
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(generator))
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
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    bad_result = _valid_result(category_name="No Existe")  # not a real category
    generator = FakeGenerator(result=bad_result)
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(generator))
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
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    generator = FakeGenerator(error=ArtifactGenerationUnavailableError("ANTHROPIC_API_KEY is not configured"))
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(generator))
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
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(), FakeProviderResolver(FakeGenerator()))
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    assert result_job.status == ArtifactJobStatus.FAILED
    assert "DiscoveryItem" in result_job.error


def test_review_artifact_approve_advances_story_to_produced():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))
    RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(FakeGenerator(result=_valid_result()))) \
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
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))
    RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(FakeGenerator(result=_valid_result()))) \
        .execute(RunArtifactJobInput(job_id=job.id))
    artifact = list(artifacts.items.values())[0]
    ReviewArtifact(artifacts, stories).execute(ReviewArtifactInput(artifact_id=str(artifact.id), decision="APPROVE"))
    return artifacts, stories, artifact


def test_publish_artifact_writes_real_row_and_advances_story():
    artifacts, stories, artifact = _approved_artifact_and_story()
    publisher = FakePublisher(news_id="news-42")

    result = PublishArtifact(artifacts, stories, FakeCategoryRepo(_categories()), FakeAssetRepo(), FakeStorage(), publisher) \
        .execute(PublishArtifactInput(artifact_id=str(artifact.id)))

    assert result.status == ArtifactStatus.PUBLISHED
    assert result.published_news_id == "news-42"
    assert stories.find_by_id("s1").status == StoryStatus.PUBLISHED
    assert len(publisher.calls) == 1
    published_artifact, category_name, image_url, content_html = publisher.calls[0]
    assert published_artifact is result
    assert category_name == "Fútbol"  # resolved from the real taxonomy, not the raw id
    assert image_url is None  # Phase 7 gap: no real image was generated for this test artifact
    assert content_html == artifact.content_html  # no body images to resolve -- unchanged


def test_publish_artifact_resolves_body_image_markers_into_real_img_tags():
    """The public site renders `content` as real HTML now (never plain
    text) -- a BODY_IMAGE's <figure data-placeholder-id> marker must
    resolve into a real <img>, using the SAME asset the editor generated/
    uploaded, exactly like ArticlePreviewModal.tsx's resolveBodyImages."""
    artifacts, stories, artifact = _approved_artifact_and_story()
    artifact.content_html = (
        '<article><p>Primer párrafo.</p><figure data-placeholder-id="body_image_1"></figure>'
        '<p>Segundo párrafo.</p></article>'
    )
    artifact.media_requirements = [
        *artifact.media_requirements,
        MediaRequirement(
            placeholder_id="body_image_1", kind=MediaKind.BODY_IMAGE, prompt="x", asset_id="asset-body-1",
            caption="Pie de foto real", alt_text="Alt real",
        ),
    ]
    artifacts.save(artifact)
    assets = FakeAssetRepo()
    assets.items["asset-body-1"] = type("Asset", (), {"storage_ref": "body/1483f6812653/img.png"})()
    publisher = FakePublisher()

    PublishArtifact(artifacts, stories, FakeCategoryRepo(_categories()), assets, FakeStorage(), publisher) \
        .execute(PublishArtifactInput(artifact_id=str(artifact.id)))

    _, _, _, content_html = publisher.calls[0]
    assert '<img src="https://cdn.example.com/body/1483f6812653/img.png" alt="Alt real" />' in content_html
    assert "<figcaption>Pie de foto real</figcaption>" in content_html
    assert "data-placeholder-id" not in content_html  # the marker is fully resolved, never left dangling


def test_publish_artifact_drops_an_unfulfilled_body_image_marker():
    artifacts, stories, artifact = _approved_artifact_and_story()
    artifact.content_html = '<article><p>x</p><figure data-placeholder-id="body_image_1"></figure></article>'
    artifact.media_requirements = [
        *artifact.media_requirements,
        MediaRequirement(placeholder_id="body_image_1", kind=MediaKind.BODY_IMAGE, prompt="x"),  # no asset_id yet
    ]
    artifacts.save(artifact)
    publisher = FakePublisher()

    PublishArtifact(artifacts, stories, FakeCategoryRepo(_categories()), FakeAssetRepo(), FakeStorage(), publisher) \
        .execute(PublishArtifactInput(artifact_id=str(artifact.id)))

    _, _, _, content_html = publisher.calls[0]
    assert "<img" not in content_html  # never a broken/empty image tag
    assert "data-placeholder-id" not in content_html


def test_publish_artifact_requires_approved_status():
    artifacts, stories, artifact = _approved_artifact_and_story()
    publisher = FakePublisher()
    use_case = PublishArtifact(artifacts, stories, FakeCategoryRepo(_categories()), FakeAssetRepo(), FakeStorage(), publisher)
    use_case.execute(PublishArtifactInput(artifact_id=str(artifact.id)))  # first publish succeeds

    with pytest.raises(InvalidStateTransition):
        use_case.execute(PublishArtifactInput(artifact_id=str(artifact.id)))  # second publish is rejected
    assert len(publisher.calls) == 1  # no duplicate external write was attempted


def test_publish_artifact_raises_not_found_for_unknown_artifact():
    artifacts, stories = InMemoryArtifactRepo(), InMemoryStoryRepo()
    with pytest.raises(NotFoundError):
        PublishArtifact(artifacts, stories, FakeCategoryRepo(), FakeAssetRepo(), FakeStorage(), FakePublisher()) \
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


def _review_required_artifact():
    from app.domain.artifact.entities import Artifact, SeoMetadata, SourceReference
    from app.domain.artifact.validation import validate_artifact
    from app.domain.shared.ids import ArtifactId

    artifacts = InMemoryArtifactRepo()
    a = Artifact.draft(
        artifact_id=ArtifactId.new(), story_id=StoryId.of("s1"), version=1, title="t", subtitle=None,
        excerpt="e", summary="s", content_html="<article><p>x</p></article>", category_id="cat-futbol", tags=[],
        entities=[], seo=SeoMetadata(
            # empty seo_title is a real BLOCKING validation.py issue (an
            # over-length one is only WARNING -- section 7 -- so it would
            # never actually produce REVIEW_REQUIRED on its own)
            seo_title="",
            seo_description="Una descripción SEO de largo razonable para pasar la validación real de longitud.",
            slug="un-slug-valido",
        ),
        sources=[SourceReference(
            source_url="https://example.com/a", source_name="Example", source_domain="example.com",
            author=None, published_at=None, retrieved_at=datetime.now(timezone.utc),
        )],
        claims=[Claim(id="claim-1", text="Algo pasó", label=EvidenceLabel.SOURCE_FACT, source_urls=["https://example.com/a"])],
        media_requirements=[MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto")],
        created_at=datetime.now(timezone.utc),
    )
    a.apply_validation(validate_artifact(a, valid_category_names={"cat-futbol"}))
    assert a.status == ArtifactStatus.REVIEW_REQUIRED  # sanity: the fixture is actually broken the way we think
    artifacts.save(a)
    return artifacts, a


def test_update_artifact_patches_title_without_touching_other_fields():
    artifacts, a = _review_required_artifact()
    original_excerpt = a.excerpt

    result = UpdateArtifact(artifacts, FakeCategoryRepo(_categories())).execute(
        UpdateArtifactInput(artifact_id=str(a.id), title="Título editado por el editor")
    )

    assert result.title == "Título editado por el editor"
    assert result.excerpt == original_excerpt
    assert artifacts.find_by_id(str(a.id)).title == "Título editado por el editor"  # really persisted


def test_update_artifact_persists_manual_summary():
    artifacts, a = _review_required_artifact()
    updated = UpdateArtifact(artifacts, FakeCategoryRepo(_categories())).execute(
        UpdateArtifactInput(artifact_id=str(a.id), summary="Descripción editada manualmente")
    )

    assert updated.summary == "Descripción editada manualmente"
    assert artifacts.find_by_id(str(a.id)).summary == "Descripción editada manualmente"


def test_update_artifact_re_validates_and_can_clear_review_required():
    artifacts, a = _review_required_artifact()

    result = UpdateArtifact(artifacts, FakeCategoryRepo(_categories())).execute(
        UpdateArtifactInput(artifact_id=str(a.id), seo_title="Título SEO corregido")
    )

    assert result.status == ArtifactStatus.VALIDATED
    assert result.validation.ok


def test_update_artifact_does_not_re_validate_once_already_approved():
    artifacts, stories, artifact = _approved_artifact_and_story()
    use_case = UpdateArtifact(artifacts, FakeCategoryRepo(_categories()))

    result = use_case.execute(UpdateArtifactInput(artifact_id=str(artifact.id), title="Ajuste menor post-aprobación"))

    assert result.status == ArtifactStatus.APPROVED  # unchanged -- not silently re-validated
    assert result.title == "Ajuste menor post-aprobación"


def test_update_artifact_raises_not_found_for_unknown_artifact():
    with pytest.raises(NotFoundError):
        UpdateArtifact(InMemoryArtifactRepo(), FakeCategoryRepo(_categories())).execute(
            UpdateArtifactInput(artifact_id="missing", title="x")
        )


def test_update_artifact_blocked_once_published():
    artifacts, stories, artifact = _approved_artifact_and_story()
    PublishArtifact(artifacts, stories, FakeCategoryRepo(_categories()), FakeAssetRepo(), FakeStorage(), FakePublisher()) \
        .execute(PublishArtifactInput(artifact_id=str(artifact.id)))

    with pytest.raises(InvalidStateTransition):
        UpdateArtifact(artifacts, FakeCategoryRepo(_categories())).execute(
            UpdateArtifactInput(artifact_id=str(artifact.id), title="Intento tardío")
        )


def test_mark_claim_reviewed_persists():
    artifacts, a = _review_required_artifact()

    result = MarkClaimReviewed(artifacts, FakeCategoryRepo(_categories())).execute(
        MarkClaimReviewedInput(artifact_id=str(a.id), claim_id="claim-1", reviewed=True)
    )

    assert result.claims[0].reviewed is True
    assert artifacts.find_by_id(str(a.id)).claims[0].reviewed is True  # really persisted


def test_mark_claim_reviewed_raises_not_found_for_unknown_artifact():
    with pytest.raises(NotFoundError):
        MarkClaimReviewed(InMemoryArtifactRepo(), FakeCategoryRepo(_categories())).execute(
            MarkClaimReviewedInput(artifact_id="missing", claim_id="claim-1")
        )


def test_retry_reuses_the_same_artifact_id_never_duplicates_the_queue():
    """The real bug this fixes: every retry used to create a brand-new
    Artifact row (new id), so REVIEW_REQUIRED/VALIDATED queue queries
    showed both the stale and the fresh attempt as two separate cards.
    A retry must replace the SAME logical artifact in place."""
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)

    bad_result = _valid_result(category_name="No Existe")  # produces REVIEW_REQUIRED
    job1 = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))
    RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(FakeGenerator(result=bad_result))) \
        .execute(RunArtifactJobInput(job_id=job1.id))
    assert len(artifacts.items) == 1
    first_artifact_id = list(artifacts.items.keys())[0]
    assert artifacts.items[first_artifact_id].version == 1

    # A human retries -- same story, a second real job, this time with
    # good content.
    job2 = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))
    RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(FakeGenerator(result=_valid_result()))) \
        .execute(RunArtifactJobInput(job_id=job2.id))

    assert len(artifacts.items) == 1  # still exactly one logical artifact, never two
    only_artifact = list(artifacts.items.values())[0]
    assert str(only_artifact.id) == first_artifact_id  # same id, reused in place
    assert only_artifact.version == 2  # a real new attempt, tracked
    assert only_artifact.status == ArtifactStatus.VALIDATED  # the fixed content actually landed

    # Both attempts are still visible as real, distinct job history.
    history = ListArtifactJobsForStory(jobs).execute("s1")
    assert len(history) == 2
    assert {j.id for j in history} == {job1.id, job2.id}


def test_retry_after_published_starts_a_new_logical_artifact():
    """A PUBLISHED artifact is live -- a later Artifact re-run for the
    same story must never silently mutate the published row. It starts a
    genuinely new id instead of resurrecting/overwriting it."""
    artifacts, stories, published = _approved_artifact_and_story()
    PublishArtifact(artifacts, stories, FakeCategoryRepo(_categories()), FakeAssetRepo(), FakeStorage(), FakePublisher()) \
        .execute(PublishArtifactInput(artifact_id=str(published.id)))

    jobs, discovery_items = InMemoryArtifactJobRepo(), InMemoryDiscoveryRepo()
    _seed_story_and_discovery_item(stories, discovery_items, story_id="s1")
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))
    RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(FakeGenerator(result=_valid_result()))) \
        .execute(RunArtifactJobInput(job_id=job.id))

    assert len(artifacts.items) == 2  # the published one, untouched, plus a fresh attempt
    fresh = [a for a in artifacts.items.values() if str(a.id) != str(published.id)][0]
    assert fresh.version == 1
    assert artifacts.find_by_id(str(published.id)).status == ArtifactStatus.PUBLISHED  # untouched


# ── ÚLTIMO BLOQUE ANTES DE PUBLISH: Artifact must deliver the body image
# ALREADY placed inside the document, never metadata only ──────────────

def test_run_artifact_job_persists_a_body_image_already_placed_in_the_document():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    generation = _generation_result(
        content_html=(
            '<article><p>Primer párrafo real.</p>'
            '<figure data-placeholder-id="body_image_1"></figure>'
            '<p>Segundo párrafo real.</p></article>'
        ),
        media_requirements=[
            MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto del estadio"),
            MediaRequirement(
                placeholder_id="body_image_1", kind=MediaKind.BODY_IMAGE,
                prompt="Nivel del embalse visto desde la orilla",
                caption="El embalse muestra niveles históricamente bajos.",
                alt_text="Fotografía del embalse con poca agua",
            ),
        ],
    )
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(FakeGenerator(result=generation)))
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    artifact = artifacts.find_by_id(result_job.artifact_id)
    assert artifact.status == ArtifactStatus.VALIDATED
    assert 'data-placeholder-id="body_image_1"' in artifact.content_html  # real placement, not metadata only
    body_image = next(m for m in artifact.media_requirements if m.placeholder_id == "body_image_1")
    assert body_image.caption == "El embalse muestra niveles históricamente bajos."
    assert body_image.alt_text == "Fotografía del embalse con poca agua"
    assert body_image.prompt == "Nivel del embalse visto desde la orilla"
    assert not any("not embedded" in i.detail for i in artifact.validation.issues)  # no orphan -- it's really there


def test_run_artifact_job_warns_when_a_declared_body_image_is_not_actually_placed():
    """The real gap this task closes: a BODY_IMAGE declared but never
    embedded must still surface honestly (as a WARNING, not silently
    dropped) -- this is what makes the "already placed" fix verifiable."""
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    generation = _generation_result(
        media_requirements=[
            MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto del estadio"),
            MediaRequirement(placeholder_id="body_image_1", kind=MediaKind.BODY_IMAGE, prompt="Foto del embalse"),
        ],
    )
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(FakeGenerator(result=generation)))
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    artifact = artifacts.find_by_id(result_job.artifact_id)
    assert any("not embedded" in i.detail for i in artifact.validation.issues)
    assert artifact.status == ArtifactStatus.VALIDATED  # non-blocking


def test_run_artifact_job_never_duplicates_the_feature_image_as_a_body_block():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    generation = _generation_result()  # only a FEATURE_IMAGE, never embedded in content_html
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(FakeGenerator(result=generation)))
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    artifact = artifacts.find_by_id(result_job.artifact_id)
    assert "FEATURE_IMAGE" not in artifact.content_html
    assert not any("must stay separate" in i.detail for i in artifact.validation.issues)


def test_run_artifact_job_records_validation_snapshot_on_the_job():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))
    RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(FakeGenerator(result=_valid_result()))) \
        .execute(RunArtifactJobInput(job_id=job.id))

    saved_job = jobs.find_by_id(job.id)
    assert saved_job.validation_ok is True
    assert saved_job.validation_issue_count == 0


def test_review_artifact_approve_succeeds_with_only_warning_issues():
    """Section 7's real fix: a WARNING (e.g. an over-length SEO title)
    must never block approval -- only a BLOCKING issue does."""
    artifacts, a = _review_required_artifact()
    # Fix the one real BLOCKING issue (empty seo_title) in the same edit
    # that introduces a real, non-blocking WARNING (an over-length title)
    # -- while status is still REVIEW_REQUIRED, UpdateArtifact re-validates
    # right away (see its own docstring), so this one call is what proves
    # a WARNING alone lands on VALIDATED, never REVIEW_REQUIRED.
    long_title = "Un título editorial deliberadamente larguísimo para superar los setenta caracteres reales"
    updated = UpdateArtifact(artifacts, FakeCategoryRepo(_categories())).execute(
        UpdateArtifactInput(artifact_id=str(a.id), seo_title="Título SEO corregido", title=long_title)
    )
    assert updated.status == ArtifactStatus.VALIDATED
    assert any(i.check == "title" for i in updated.validation.issues)  # the warning is real and still shown

    stories = InMemoryStoryRepo()
    stories.save(Story.open_from_news(StoryId.of("s1"), "H", StorySource(news_id=None, source_url="u")))
    result = ReviewArtifact(artifacts, stories).execute(ReviewArtifactInput(artifact_id=str(a.id), decision="APPROVE"))
    assert result.status == ArtifactStatus.APPROVED


def test_archive_artifact_removes_it_from_status_queues():
    artifacts, a = _review_required_artifact()
    result = ArchiveArtifact(artifacts).execute(ArchiveArtifactInput(artifact_id=str(a.id)))

    assert result.status == ArtifactStatus.ARCHIVED
    assert artifacts.find_by_id(str(a.id)).status == ArtifactStatus.ARCHIVED
    assert artifacts.list_by_status("REVIEW_REQUIRED") == []
    assert artifacts.list_by_status("VALIDATED") == []
    assert artifacts.list_by_status("APPROVED") == []  # never available to Publish either


def test_archive_artifact_blocked_once_published():
    artifacts, stories, artifact = _approved_artifact_and_story()
    PublishArtifact(artifacts, stories, FakeCategoryRepo(_categories()), FakeAssetRepo(), FakeStorage(), FakePublisher()) \
        .execute(PublishArtifactInput(artifact_id=str(artifact.id)))

    with pytest.raises(InvalidStateTransition):
        ArchiveArtifact(artifacts).execute(ArchiveArtifactInput(artifact_id=str(artifact.id)))


def test_archive_artifact_raises_not_found_for_unknown_artifact():
    with pytest.raises(NotFoundError):
        ArchiveArtifact(InMemoryArtifactRepo()).execute(ArchiveArtifactInput(artifact_id="missing"))


def test_archive_artifact_is_not_reversible_by_archiving_twice():
    artifacts, a = _review_required_artifact()
    ArchiveArtifact(artifacts).execute(ArchiveArtifactInput(artifact_id=str(a.id)))
    with pytest.raises(InvalidStateTransition):
        ArchiveArtifact(artifacts).execute(ArchiveArtifactInput(artifact_id=str(a.id)))


# ── Section 5: "Corregir con IA" -- ProposeSeoFix ────────────────────────

def _seo_proposal(value="Un título corregido", reason="Se acortó preservando el sentido"):
    return SeoFixResult(value=value, reason=reason, character_count=len(value))


def test_propose_seo_fix_returns_a_real_proposal_never_persisted():
    artifacts, a = _review_required_artifact()
    original_title = a.title
    generator = FakeGenerator(seo_fix_result=_seo_proposal())
    output = ProposeSeoFix(artifacts, FakeProviderResolver(generator)).execute(
        ProposeSeoFixInput(artifact_id=str(a.id), field="title")
    )

    assert output.value == "Un título corregido"
    assert output.character_count == len("Un título corregido")
    assert output.max_length == 70
    # Nothing was persisted -- the proposal is a return value only.
    assert artifacts.find_by_id(str(a.id)).title == original_title


def test_propose_seo_fix_uses_the_resolved_provider_and_records_it():
    artifacts, a = _review_required_artifact()
    generator = FakeGenerator(seo_fix_result=_seo_proposal())
    output = ProposeSeoFix(artifacts, FakeProviderResolver(generator)).execute(
        ProposeSeoFixInput(artifact_id=str(a.id), field="seo_title")
    )

    assert output.provider == "anthropic"  # FakeProviderResolver always resolves to anthropic
    assert output.model == "fake-model-1"  # from check_status(), same provenance TriggerArtifact records
    assert len(generator.seo_fix_calls) == 1
    assert generator.seo_fix_calls[0].field == "seo_title"
    assert generator.seo_fix_calls[0].current_text == a.seo.seo_title  # the REAL current value, not invented


def test_propose_seo_fix_grounds_the_request_in_the_real_artifact_context():
    artifacts, a = _review_required_artifact()
    generator = FakeGenerator(seo_fix_result=_seo_proposal())
    ProposeSeoFix(artifacts, FakeProviderResolver(generator)).execute(
        ProposeSeoFixInput(artifact_id=str(a.id), field="title")
    )
    request = generator.seo_fix_calls[0]
    assert request.story_headline == a.title
    assert request.excerpt == a.excerpt
    assert request.max_length == 70
    assert request.min_length is None


def test_propose_seo_fix_forwards_a_real_instruction_for_the_impact_alternatives_chips():
    artifacts, a = _review_required_artifact()
    generator = FakeGenerator(seo_fix_result=_seo_proposal())
    ProposeSeoFix(artifacts, FakeProviderResolver(generator)).execute(
        ProposeSeoFixInput(artifact_id=str(a.id), field="title", instruction="más impacto")
    )
    assert generator.seo_fix_calls[0].instruction == "más impacto"


def test_propose_seo_fix_without_instruction_forwards_none():
    artifacts, a = _review_required_artifact()
    generator = FakeGenerator(seo_fix_result=_seo_proposal())
    ProposeSeoFix(artifacts, FakeProviderResolver(generator)).execute(
        ProposeSeoFixInput(artifact_id=str(a.id), field="title")
    )
    assert generator.seo_fix_calls[0].instruction is None


def test_propose_seo_fix_seo_description_uses_the_real_min_and_max():
    artifacts, a = _review_required_artifact()
    generator = FakeGenerator(seo_fix_result=_seo_proposal(value="x" * 100))
    output = ProposeSeoFix(artifacts, FakeProviderResolver(generator)).execute(
        ProposeSeoFixInput(artifact_id=str(a.id), field="seo_description")
    )
    assert output.min_length == 50
    assert output.max_length == 160


def test_propose_seo_fix_raises_not_found_for_unknown_artifact():
    with pytest.raises(NotFoundError):
        ProposeSeoFix(InMemoryArtifactRepo(), FakeProviderResolver()).execute(
            ProposeSeoFixInput(artifact_id="missing", field="title")
        )


def test_propose_seo_fix_rejects_an_unknown_field():
    artifacts, a = _review_required_artifact()
    with pytest.raises(ValueError):
        ProposeSeoFix(artifacts, FakeProviderResolver()).execute(
            ProposeSeoFixInput(artifact_id=str(a.id), field="content_html")
        )


def test_propose_seo_fix_propagates_a_real_provider_error():
    artifacts, a = _review_required_artifact()
    generator = FakeGenerator(seo_fix_error=ArtifactGenerationUnavailableError("ANTHROPIC_API_KEY is not configured"))
    with pytest.raises(ArtifactGenerationUnavailableError):
        ProposeSeoFix(artifacts, FakeProviderResolver(generator)).execute(
            ProposeSeoFixInput(artifact_id=str(a.id), field="title")
        )


def test_propose_seo_fix_retrying_never_creates_or_duplicates_an_artifact():
    """The operation is read-only by construction (it never calls
    artifacts.save) -- retrying it after a failure, or just asking twice,
    must never touch the artifacts table at all."""
    artifacts, a = _review_required_artifact()
    assert len(artifacts.items) == 1

    failing = FakeGenerator(seo_fix_error=ArtifactGenerationUnavailableError("down"))
    with pytest.raises(ArtifactGenerationUnavailableError):
        ProposeSeoFix(artifacts, FakeProviderResolver(failing)).execute(ProposeSeoFixInput(artifact_id=str(a.id), field="title"))
    assert len(artifacts.items) == 1

    working = FakeGenerator(seo_fix_result=_seo_proposal())
    ProposeSeoFix(artifacts, FakeProviderResolver(working)).execute(ProposeSeoFixInput(artifact_id=str(a.id), field="title"))
    assert len(artifacts.items) == 1  # still exactly one artifact


def test_accepting_a_seo_fix_proposal_persists_and_revalidates():
    """The end-to-end path the real UI takes: ProposeSeoFix returns a
    proposal, and ONLY UpdateArtifact (the existing PATCH endpoint)
    actually saves it and re-runs real validation (steps 9-11)."""
    artifacts, a = _review_required_artifact()  # REVIEW_REQUIRED because seo_title is empty (BLOCKING)
    long_title = "x" * 82  # over the 70-char guideline -- a real WARNING
    a.title = long_title
    artifacts.save(a)

    generator = FakeGenerator(seo_fix_result=_seo_proposal(value="Un título corregido y corto"))
    proposal = ProposeSeoFix(artifacts, FakeProviderResolver(generator)).execute(
        ProposeSeoFixInput(artifact_id=str(a.id), field="title")
    )
    assert proposal.character_count <= 70

    # Editor accepts (and also fixes the real blocking seo_title, since
    # this fixture's REVIEW_REQUIRED cause is the empty seo_title, not the
    # title warning) -- the same PATCH path a plain manual edit uses.
    updated = UpdateArtifact(artifacts, FakeCategoryRepo(_categories())).execute(
        UpdateArtifactInput(artifact_id=str(a.id), title=proposal.value, seo_title="Título SEO corregido")
    )

    assert updated.title == "Un título corregido y corto"
    assert updated.status == ArtifactStatus.VALIDATED
    assert not any(i.check == "title" for i in updated.validation.issues)  # the warning is really gone
    assert artifacts.find_by_id(str(a.id)).title == "Un título corregido y corto"  # really persisted


def test_rejecting_a_seo_fix_proposal_persists_nothing():
    artifacts, a = _review_required_artifact()
    original_title = a.title
    generator = FakeGenerator(seo_fix_result=_seo_proposal())
    ProposeSeoFix(artifacts, FakeProviderResolver(generator)).execute(
        ProposeSeoFixInput(artifact_id=str(a.id), field="title")
    )
    # The editor discards it -- no further call is made, nothing changes.
    assert artifacts.find_by_id(str(a.id)).title == original_title


def test_editing_a_seo_fix_proposal_before_accepting_persists_the_edited_value():
    artifacts, a = _review_required_artifact()
    generator = FakeGenerator(seo_fix_result=_seo_proposal(value="Propuesta original de la IA"))
    proposal = ProposeSeoFix(artifacts, FakeProviderResolver(generator)).execute(
        ProposeSeoFixInput(artifact_id=str(a.id), field="title")
    )
    editor_edited_value = proposal.value + " (ajustado a mano)"

    updated = UpdateArtifact(artifacts, FakeCategoryRepo(_categories())).execute(
        UpdateArtifactInput(artifact_id=str(a.id), title=editor_edited_value, seo_title="Título SEO corregido")
    )
    assert updated.title == editor_edited_value  # the human's final edit, not the raw AI proposal


# ── Revisión 2.0 section 1: Artifact auto-resolves before Revisión ──────

def _generation_result(**overrides):
    defaults = dict(
        title="Un título original", subtitle="Subtítulo", excerpt="Extracto", summary="Resumen",
        content_html="<article><p>Texto real de al menos un párrafo.</p></article>",
        category_name="Fútbol", tags=["futbol"], entities=["River Plate"],
        seo_title="Título SEO corto", seo_description="Una descripción SEO de largo razonable para pasar la validación.",
        slug="un-titulo-original",
        claims=[Claim(id="claim-1", text="River ganó", label=EvidenceLabel.SOURCE_FACT, source_urls=["https://example.com/a"])],
        media_requirements=[MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto")],
    )
    defaults.update(overrides)
    return ArtifactGenerationResult(**defaults)


def test_run_artifact_job_auto_resolves_an_over_length_title_before_finalizing():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    long_title = "x" * 82  # over the 70-char guideline -- a real WARNING
    generator = FakeGenerator(
        result=_generation_result(title=long_title), seo_fix_result=_seo_proposal(value="Un título corregido y corto"),
    )
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(generator))
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    artifact = artifacts.find_by_id(result_job.artifact_id)
    assert artifact.title == "Un título corregido y corto"  # auto-fixed before ever reaching Revisión
    assert artifact.status == ArtifactStatus.VALIDATED
    assert not any(i.check == "title" for i in artifact.validation.issues)
    assert len(generator.seo_fix_calls) == 1


def test_run_artifact_job_auto_resolve_rejects_a_fix_that_is_still_out_of_bounds():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    long_title = "x" * 82
    generator = FakeGenerator(result=_generation_result(title=long_title), seo_fix_result=_seo_proposal(value="y" * 90))
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(generator))
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    artifact = artifacts.find_by_id(result_job.artifact_id)
    assert artifact.title == long_title  # rejected fix never applied -- verify, don't trust
    assert any(i.check == "title" for i in artifact.validation.issues)  # warning survives, honestly
    assert artifact.status == ArtifactStatus.VALIDATED  # still non-blocking


def test_run_artifact_job_auto_resolve_never_fails_the_whole_job_on_provider_error():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    long_title = "x" * 82
    generator = FakeGenerator(
        result=_generation_result(title=long_title), seo_fix_error=ArtifactGenerationUnavailableError("down"),
    )
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(generator))
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    assert result_job.status != ArtifactJobStatus.FAILED  # the auto-resolve attempt failing is not a job failure
    artifact = artifacts.find_by_id(result_job.artifact_id)
    assert artifact.title == long_title  # unchanged, original warning intact


def test_run_artifact_job_auto_resolves_unverified_claim_to_source_availability():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    claim_text = "La fecha exacta del partido decisivo no está especificada en la información disponible."
    generation = _generation_result(claims=[Claim(id="claim-1", text=claim_text, label=EvidenceLabel.UNVERIFIED)])
    resolution = ClaimResolutionResult(
        label=EvidenceLabel.SOURCE_AVAILABILITY_CLAIM, reason="La fuente no menciona esa fecha.", supported_by_source=True,
    )
    generator = FakeGenerator(result=generation, claim_resolution_result=resolution)
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(generator))
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    artifact = artifacts.find_by_id(result_job.artifact_id)
    assert artifact.claims[0].label == EvidenceLabel.SOURCE_AVAILABILITY_CLAIM
    assert not any(i.check == "evidence" for i in artifact.validation.issues)
    assert artifact.status == ArtifactStatus.VALIDATED
    assert len(generator.claim_resolution_calls) == 1
    assert generator.claim_resolution_calls[0].source_text == "Contenido real de la fuente."  # the REAL source, never invented


def test_run_artifact_job_auto_resolve_leaves_a_genuinely_unresolved_claim_as_a_warning():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    generation = _generation_result(claims=[Claim(id="claim-1", text="Un número que no se pudo confirmar.", label=EvidenceLabel.UNVERIFIED)])
    resolution = ClaimResolutionResult(label=EvidenceLabel.UNVERIFIED, reason="No se pudo confirmar contra la fuente.", supported_by_source=False)
    generator = FakeGenerator(result=generation, claim_resolution_result=resolution)
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(generator))
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    artifact = artifacts.find_by_id(result_job.artifact_id)
    assert artifact.claims[0].label == EvidenceLabel.UNVERIFIED
    assert artifact.claims[0].reviewed is False  # genuinely still needs a human
    assert any(i.check == "evidence" for i in artifact.validation.issues)
    assert artifact.status == ArtifactStatus.VALIDATED  # non-blocking either way


def test_run_artifact_job_auto_resolve_never_upgrades_to_source_fact_without_real_evidence():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    generation = _generation_result(claims=[Claim(id="claim-1", text="Algo que parece cierto.", label=EvidenceLabel.UNVERIFIED)])
    # A hallucinating provider claiming SOURCE_FACT without real support --
    # must never be trusted at face value (section 2/4's hard rule).
    resolution = ClaimResolutionResult(label=EvidenceLabel.SOURCE_FACT, reason="Parece cierto.", supported_by_source=False)
    generator = FakeGenerator(result=generation, claim_resolution_result=resolution)
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(generator))
    result_job = use_case.execute(RunArtifactJobInput(job_id=job.id))

    artifact = artifacts.find_by_id(result_job.artifact_id)
    assert artifact.claims[0].label == EvidenceLabel.UNVERIFIED  # forced back -- never marked VERIFIED without evidence


def test_run_artifact_job_auto_resolve_caps_claim_resolution_attempts():
    jobs, artifacts, discovery_items, stories = (
        InMemoryArtifactJobRepo(), InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), InMemoryStoryRepo(),
    )
    _seed_story_and_discovery_item(stories, discovery_items)
    job = TriggerArtifact(jobs, stories, FakeProviderResolver()).execute(TriggerArtifactInput(story_id="s1"))

    many_claims = [
        Claim(id=f"claim-{i}", text=f"Afirmación sin confirmar número {i}.", label=EvidenceLabel.UNVERIFIED) for i in range(7)
    ]
    generation = _generation_result(claims=many_claims)
    resolution = ClaimResolutionResult(label=EvidenceLabel.UNVERIFIED, reason="x", supported_by_source=False)
    generator = FakeGenerator(result=generation, claim_resolution_result=resolution)
    use_case = RunArtifactJob(jobs, artifacts, discovery_items, stories, FakeCategoryRepo(_categories()), FakeProviderResolver(generator))
    use_case.execute(RunArtifactJobInput(job_id=job.id))

    assert len(generator.claim_resolution_calls) == 5  # the real, deliberate bound -- never unbounded provider spend


# ── Revisión 2.0 section 2/4: ProposeClaimResolution (manual, Revisión) ──

def _artifact_with_unverified_claim_and_discovery_item():
    from app.domain.artifact.entities import Artifact, SeoMetadata, SourceReference
    from app.domain.artifact.validation import validate_artifact
    from app.domain.shared.ids import ArtifactId

    artifacts = InMemoryArtifactRepo()
    discovery_items = InMemoryDiscoveryRepo()
    _seed_story_and_discovery_item(InMemoryStoryRepo(), discovery_items, story_id="s1")
    a = Artifact.draft(
        artifact_id=ArtifactId.new(), story_id=StoryId.of("s1"), version=1, title="Un título válido", subtitle=None,
        excerpt="e", summary="s", content_html="<article><p>x</p></article>", category_id="cat-futbol", tags=[],
        entities=[], seo=SeoMetadata(
            seo_title="Título SEO", seo_description="Una descripción SEO de largo razonable para pasar la validación real.",
            slug="un-slug-valido",
        ),
        sources=[SourceReference(
            source_url="https://example.com/a", source_name="Example", source_domain="example.com",
            author=None, published_at=None, retrieved_at=datetime.now(timezone.utc),
        )],
        claims=[Claim(id="claim-1", text="La fecha exacta no está especificada.", label=EvidenceLabel.UNVERIFIED)],
        media_requirements=[MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto")],
        created_at=datetime.now(timezone.utc),
    )
    a.apply_validation(validate_artifact(a, valid_category_names={"cat-futbol"}))
    artifacts.save(a)
    return artifacts, discovery_items, a


def test_propose_claim_resolution_returns_a_real_proposal_never_persisted():
    artifacts, discovery_items, a = _artifact_with_unverified_claim_and_discovery_item()
    resolution = ClaimResolutionResult(
        label=EvidenceLabel.SOURCE_AVAILABILITY_CLAIM, reason="La fuente no menciona la fecha.", supported_by_source=True,
    )
    generator = FakeGenerator(claim_resolution_result=resolution)
    output = ProposeClaimResolution(artifacts, discovery_items, FakeProviderResolver(generator)).execute(
        ProposeClaimResolutionInput(artifact_id=str(a.id), claim_id="claim-1")
    )

    assert output.label == "SOURCE_AVAILABILITY_CLAIM"
    assert output.source_urls == ["https://example.com/a"]
    assert output.provider == "anthropic"
    assert output.model == "fake-model-1"
    assert artifacts.find_by_id(str(a.id)).claims[0].label == EvidenceLabel.UNVERIFIED  # nothing persisted


def test_propose_claim_resolution_grounds_request_in_the_real_source_text():
    artifacts, discovery_items, a = _artifact_with_unverified_claim_and_discovery_item()
    generator = FakeGenerator(claim_resolution_result=ClaimResolutionResult(
        label=EvidenceLabel.UNVERIFIED, reason="x", supported_by_source=False,
    ))
    ProposeClaimResolution(artifacts, discovery_items, FakeProviderResolver(generator)).execute(
        ProposeClaimResolutionInput(artifact_id=str(a.id), claim_id="claim-1")
    )
    request = generator.claim_resolution_calls[0]
    assert request.claim_text == "La fecha exacta no está especificada."
    assert request.source_text == "Contenido real de la fuente."


def test_propose_claim_resolution_never_upgrades_without_real_evidence():
    artifacts, discovery_items, a = _artifact_with_unverified_claim_and_discovery_item()
    resolution = ClaimResolutionResult(label=EvidenceLabel.SOURCE_FACT, reason="Parece cierto.", supported_by_source=False)
    generator = FakeGenerator(claim_resolution_result=resolution)
    output = ProposeClaimResolution(artifacts, discovery_items, FakeProviderResolver(generator)).execute(
        ProposeClaimResolutionInput(artifact_id=str(a.id), claim_id="claim-1")
    )
    assert output.label == "UNVERIFIED"
    assert output.source_urls == []


def test_propose_claim_resolution_raises_not_found_for_unknown_artifact():
    with pytest.raises(NotFoundError):
        ProposeClaimResolution(InMemoryArtifactRepo(), InMemoryDiscoveryRepo(), FakeProviderResolver()).execute(
            ProposeClaimResolutionInput(artifact_id="missing", claim_id="claim-1")
        )


def test_propose_claim_resolution_raises_not_found_for_unknown_claim():
    artifacts, discovery_items, a = _artifact_with_unverified_claim_and_discovery_item()
    with pytest.raises(NotFoundError):
        ProposeClaimResolution(artifacts, discovery_items, FakeProviderResolver()).execute(
            ProposeClaimResolutionInput(artifact_id=str(a.id), claim_id="missing")
        )


def test_propose_claim_resolution_rejects_an_already_resolved_claim():
    artifacts, a = _review_required_artifact()  # its claim-1 is SOURCE_FACT already, not resolvable
    with pytest.raises(ValueError):
        ProposeClaimResolution(artifacts, InMemoryDiscoveryRepo(), FakeProviderResolver()).execute(
            ProposeClaimResolutionInput(artifact_id=str(a.id), claim_id="claim-1")
        )


def test_propose_claim_resolution_propagates_a_real_provider_error():
    artifacts, discovery_items, a = _artifact_with_unverified_claim_and_discovery_item()
    generator = FakeGenerator(claim_resolution_error=ArtifactGenerationUnavailableError("down"))
    with pytest.raises(ArtifactGenerationUnavailableError):
        ProposeClaimResolution(artifacts, discovery_items, FakeProviderResolver(generator)).execute(
            ProposeClaimResolutionInput(artifact_id=str(a.id), claim_id="claim-1")
        )


def test_propose_claim_resolution_retrying_never_duplicates_the_artifact():
    artifacts, discovery_items, a = _artifact_with_unverified_claim_and_discovery_item()
    assert len(artifacts.items) == 1

    failing = FakeGenerator(claim_resolution_error=ArtifactGenerationUnavailableError("down"))
    with pytest.raises(ArtifactGenerationUnavailableError):
        ProposeClaimResolution(artifacts, discovery_items, FakeProviderResolver(failing)).execute(
            ProposeClaimResolutionInput(artifact_id=str(a.id), claim_id="claim-1")
        )
    assert len(artifacts.items) == 1

    working = FakeGenerator(claim_resolution_result=ClaimResolutionResult(
        label=EvidenceLabel.SOURCE_AVAILABILITY_CLAIM, reason="x", supported_by_source=True,
    ))
    ProposeClaimResolution(artifacts, discovery_items, FakeProviderResolver(working)).execute(
        ProposeClaimResolutionInput(artifact_id=str(a.id), claim_id="claim-1")
    )
    assert len(artifacts.items) == 1


def test_accepting_a_claim_resolution_persists_and_revalidates():
    artifacts, discovery_items, a = _artifact_with_unverified_claim_and_discovery_item()
    assert a.status == ArtifactStatus.VALIDATED  # UNVERIFIED alone is a WARNING, not blocking
    assert any(i.check == "evidence" for i in a.validation.issues)

    resolution = ClaimResolutionResult(
        label=EvidenceLabel.SOURCE_AVAILABILITY_CLAIM, reason="La fuente no menciona la fecha.", supported_by_source=True,
    )
    generator = FakeGenerator(claim_resolution_result=resolution)
    proposal = ProposeClaimResolution(artifacts, discovery_items, FakeProviderResolver(generator)).execute(
        ProposeClaimResolutionInput(artifact_id=str(a.id), claim_id="claim-1")
    )

    updated = MarkClaimReviewed(artifacts, FakeCategoryRepo(_categories())).execute(MarkClaimReviewedInput(
        artifact_id=str(a.id), claim_id="claim-1", reviewed=True, label=proposal.label, source_urls=proposal.source_urls,
    ))

    assert updated.claims[0].label == EvidenceLabel.SOURCE_AVAILABILITY_CLAIM
    assert not any(i.check == "evidence" for i in updated.validation.issues)  # the warning is really gone
    assert artifacts.find_by_id(str(a.id)).claims[0].label == EvidenceLabel.SOURCE_AVAILABILITY_CLAIM  # persisted
