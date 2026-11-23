from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.application.use_cases.editorial_board import (
    CreateArticle, CreateArticleInput, GetEditorialBoard, WriteDiscoveryItem, WriteItemInput,
    match_category, slugify, text_to_html,
)
from app.domain.artifact.entities import ArtifactJob, ArtifactJobStatus, ArtifactStatus
from app.domain.category.entities import Category, CategoryGroup
from app.domain.discovery.entities import DiscoveryItem, DiscoveryStatus
from app.domain.shared.ids import DiscoveryItemId, StoryId

NOW = datetime(2026, 11, 23, 15, 0, tzinfo=timezone.utc)


def _item(item_id, status=DiscoveryStatus.DISCOVERED, story_id=None):
    item = DiscoveryItem.discover(
        item_id=DiscoveryItemId.of(item_id), source_url=f"https://n.test/{item_id}", original_url=f"https://n.test/{item_id}",
        original_title=f"Nota {item_id}", raw_text="Texto", source_name="n.test", source_domain="n.test",
        discovered_at=NOW - timedelta(minutes=5),
    )
    item.status = status
    item.story_id = StoryId.of(story_id) if story_id else None
    return item


class Items:
    def __init__(self, items):
        self.items = {str(i.id): i for i in items}

    def list(self, filters):
        return [i for i in self.items.values() if i.status == filters.status]

    def find_by_id(self, item_id):
        return self.items.get(item_id)


class Stories:
    def __init__(self):
        self.saved = []

    def save(self, story):
        self.saved.append(story)


class Artifacts:
    def __init__(self, artifacts=()):
        self.items = list(artifacts)

    def list_by_status(self, status, limit=50):
        return [a for a in self.items if a.status.value == status][:limit]

    def save(self, artifact):
        self.items.append(artifact)


class Jobs:
    def __init__(self, jobs=()):
        self.jobs = list(jobs)

    def list_recent(self, limit=20):
        return self.jobs[:limit]


def _article(story, status, title="Artículo"):
    article = CreateArticle(Stories(), Artifacts()).execute(CreateArticleInput(title=title, legacy_news_id=story))
    article.status = status
    return article


def test_board_places_every_card_in_its_column():
    review = _article("s-review", ArtifactStatus.REVIEW_REQUIRED, "Revisar")
    approved = _article("s-ok", ArtifactStatus.APPROVED, "Lista")
    archived = _article("s-arch", ArtifactStatus.ARCHIVED)
    items = [
        _item("new"), _item("picked", DiscoveryStatus.SELECTED),
        _item("ai-running", DiscoveryStatus.SENT_TO_EDITORIAL, "ai-running"),
        _item("archived-story", DiscoveryStatus.SENT_TO_EDITORIAL, str(archived.story_id)),
    ]
    jobs = [ArtifactJob(id="j", story_id=StoryId.of("ai-running"), status=ArtifactJobStatus.RUNNING, created_at=NOW)]
    board = GetEditorialBoard(Items(items), Artifacts([review, approved, archived]), Jobs(jobs)).execute()

    assert {c.id for c in board.columns["incoming"]} == {"new", "picked"}
    writing = board.columns["writing"]
    assert [(c.kind, c.id, c.job_status) for c in writing] == [("job", "ai-running", "RUNNING")]
    assert [c.title for c in board.columns["review"]] == ["Lista", "Revisar"]  # ready-to-publish first
    assert board.columns["published"] == [] and board.columns["scheduled"] == []


class Recorder:
    def __init__(self, items=None):
        self.calls = []
        self.items = items

    def execute(self, input):
        self.calls.append(input)
        if hasattr(input, "decision") and self.items:
            item = self.items.items[input.item_id]
            item.status = DiscoveryStatus.SELECTED if input.decision == "SELECT" else DiscoveryStatus.SENT_TO_EDITORIAL
            return item
        return SimpleNamespace(id="result")


def test_write_manual_selects_then_opens_editor_in_one_call():
    items = Items([_item("a")])
    decide, open_manual, trigger = Recorder(items), Recorder(), Recorder()
    result = WriteDiscoveryItem(items, decide, open_manual, trigger).execute(WriteItemInput("a", "manual"))
    assert [c.decision for c in decide.calls] == ["SELECT"]
    assert len(open_manual.calls) == 1 and trigger.calls == [] and result.artifact is not None


def test_write_ai_sends_to_editorial_and_triggers_job():
    items = Items([_item("a")])
    decide, open_manual, trigger = Recorder(items), Recorder(), Recorder()
    result = WriteDiscoveryItem(items, decide, open_manual, trigger).execute(WriteItemInput("a", "ai", "anthropic"))
    assert [c.decision for c in decide.calls] == ["SELECT", "SEND_TO_EDITORIAL"]
    assert trigger.calls[0].story_id == "a" and trigger.calls[0].provider == "anthropic"
    assert result.job is not None and open_manual.calls == []


def test_write_rejects_unknown_mode():
    with pytest.raises(ValueError):
        WriteDiscoveryItem(Items([]), Recorder(), Recorder(), Recorder()).execute(WriteItemInput("a", "magic"))


def test_create_article_is_deterministic_for_legacy_rows():
    artifacts = Artifacts()
    use_case = CreateArticle(Stories(), artifacts)
    first = use_case.execute(CreateArticleInput(title="Título", content="Uno\n\nDos", legacy_news_id="n1"))
    second = use_case.execute(CreateArticleInput(title="Título", content="Uno\n\nDos", legacy_news_id="n1"))
    assert first.id == second.id and first.story_id == second.story_id  # re-running the migration never duplicates
    assert first.content_html == "<p>Uno</p><p>Dos</p>"
    assert first.status == ArtifactStatus.DRAFT and first.seo.slug == "titulo"


def test_create_article_requires_title():
    with pytest.raises(ValueError):
        CreateArticle(Stories(), Artifacts()).execute(CreateArticleInput(title="  "))


def test_helpers():
    assert text_to_html("<p>ya es html</p>") == "<p>ya es html</p>"
    assert text_to_html("línea 1\nlínea 2") == "<p>línea 1</p><p>línea 2</p>"
    assert slugify("¡Messi renueva en 2028!") == "messi-renueva-en-2028"
    futbol = Category(id="c1", group_id="g", name="Fútbol", slug="futbol", sort_order=1, active=True)
    groups = [CategoryGroup(id="g", name="Deportes", slug="deportes", sort_order=1, active=True, categories=[futbol])]
    assert match_category("futbol", groups) == "c1"
    assert match_category("deporte", groups) == "c1"     # legacy singular name -> group's first category
    assert match_category("política", groups) is None


def test_set_feature_image_replaces_cover_and_keeps_body_media():
    from app.application.use_cases.editorial_board import SetFeatureImage, UploadArticleImage
    from app.domain.artifact.entities import MediaKind, MediaRequirement
    artifacts = Artifacts()
    article = CreateArticle(Stories(), artifacts).execute(CreateArticleInput(title="T", image_url="https://old/x.jpg"))
    article.media_requirements.append(MediaRequirement(placeholder_id="BODY_IMAGE_01", kind=MediaKind.BODY_IMAGE, prompt=""))
    artifacts.find_by_id = lambda _id: article
    updated = SetFeatureImage(artifacts).execute(str(article.id), "https://cdn/new.jpg", caption="Foto: AP")
    cover = [m for m in updated.media_requirements if m.kind == MediaKind.FEATURE_IMAGE]
    assert len(cover) == 1 and cover[0].external_url == "https://cdn/new.jpg" and cover[0].caption == "Foto: AP"
    assert any(m.placeholder_id == "BODY_IMAGE_01" for m in updated.media_requirements)
    with pytest.raises(ValueError):
        SetFeatureImage(artifacts).execute(str(article.id), "javascript:alert(1)")

    class Storage:
        def upload(self, artifact_id, content, content_type):
            return f"https://cdn/{artifact_id}.jpg"
    assert UploadArticleImage(artifacts, Storage()).execute(str(article.id), b"x", "image/jpeg").startswith("https://cdn/")


def test_storage_adapter_rejects_bad_files():
    from app.infrastructure.media.article_image_storage_adapter import SupabaseArticleImageStorage
    storage = SupabaseArticleImageStorage(client=None)
    with pytest.raises(ValueError):
        storage.upload("a", b"x", "application/pdf")
    with pytest.raises(ValueError):
        storage.upload("a", b"", "image/png")
