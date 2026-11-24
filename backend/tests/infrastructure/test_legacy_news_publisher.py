from datetime import datetime, timezone

from app.domain.artifact.entities import Artifact, SeoMetadata, SourceReference
from app.domain.shared.ids import ArtifactId, StoryId
from app.infrastructure.publishing.legacy_news_publisher import SupabaseLegacyNewsPublisher


class FakeTable:
    def __init__(self, client):
        self._client = client
        self._selecting = False

    def select(self, columns):
        self._selecting = True
        return self

    def like(self, column, pattern):
        prefix = pattern.rstrip("%")
        self._matches = [row for row in self._client.existing_rows if row[column].startswith(prefix)]
        return self

    def insert(self, payload):
        self._client.inserted_payload = payload
        return self

    def upsert(self, payload, on_conflict):
        self._client.inserted_payload = payload
        self._client.conflict_key = on_conflict
        return self

    def execute(self):
        if self._selecting:
            return FakeResponse(self._matches)
        return self._client.response


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeSupabaseClient:
    def __init__(self, returned_id="news-generated-id", existing_rows=None):
        self.response = FakeResponse([{"id": returned_id}])
        self.existing_rows = existing_rows or []
        self.inserted_payload = None
        self.conflict_key = None

    def table(self, name):
        assert name == "news"
        return FakeTable(self)


def _artifact():
    return Artifact.draft(
        artifact_id=ArtifactId.new(), story_id=StoryId.new(), version=1, title="Un título real",
        subtitle="Un subtítulo real", excerpt="Extracto real", summary="Resumen real",
        content_html="<article><p>Contenido real y suficientemente largo para el artículo completo.</p></article>",
        category_id="cat-1", tags=["futbol"], entities=["River Plate"],
        seo=SeoMetadata(seo_title="SEO real", seo_description="Descripción SEO real", slug="un-titulo-real"),
        sources=[SourceReference(
            source_url="https://example.com/a", source_name="Example", source_domain="example.com",
            author=None, published_at=None, retrieved_at=datetime.now(timezone.utc),
        )],
        claims=[], media_requirements=[], created_at=datetime.now(timezone.utc),
    )


def test_publisher_inserts_real_row_and_returns_real_id():
    client = FakeSupabaseClient(returned_id="news-real-id")
    publisher = SupabaseLegacyNewsPublisher(client)
    resolved_html = "<article><p>Contenido real ya resuelto por PublishArtifact.</p></article>"

    news_id = publisher.publish(
        _artifact(), category_name="Fútbol", image_url="https://cdn.example.com/img.jpg", content_html=resolved_html,
    )

    assert news_id == "news-real-id"
    assert client.inserted_payload["title"] == "Un título real"
    assert client.inserted_payload["slug"] == "un-titulo-real"
    assert client.inserted_payload["category"] == "Fútbol"
    assert client.inserted_payload["status"] == "published"
    assert client.inserted_payload["source_url"] == "https://example.com/a"
    assert client.inserted_payload["image_url"] == "https://cdn.example.com/img.jpg"
    assert client.conflict_key == "artifact_id"
    # The real, already-resolved HTML is stored as-is -- the public site
    # renders it as real HTML now, never a stripped plain-text downgrade.
    assert client.inserted_payload["content"] == resolved_html


def _publish(client, artifact):
    return SupabaseLegacyNewsPublisher(client).publish(artifact, "Fútbol", None, "<article><p>x</p></article>")


def test_publisher_picks_a_free_slug_when_another_article_owns_it():
    artifact = _artifact()
    client = FakeSupabaseClient(existing_rows=[
        {"slug": "un-titulo-real", "artifact_id": None},
        {"slug": "un-titulo-real-2", "artifact_id": "other-artifact"},
    ])
    _publish(client, artifact)
    assert client.inserted_payload["slug"] == "un-titulo-real-3"


def test_republishing_the_same_artifact_keeps_its_slug():
    artifact = _artifact()
    client = FakeSupabaseClient(existing_rows=[{"slug": "un-titulo-real", "artifact_id": str(artifact.id)}])
    _publish(client, artifact)
    assert client.inserted_payload["slug"] == "un-titulo-real"


def test_free_slug_is_used_as_is():
    client = FakeSupabaseClient(existing_rows=[{"slug": "un-titulo-real-de-ayer", "artifact_id": None}])
    _publish(client, _artifact())
    assert client.inserted_payload["slug"] == "un-titulo-real"
