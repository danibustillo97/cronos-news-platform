from datetime import datetime, timezone

from app.domain.artifact.entities import Artifact, SeoMetadata, SourceReference
from app.domain.shared.ids import ArtifactId, StoryId
from app.infrastructure.publishing.html_to_plain_text import html_to_plain_text
from app.infrastructure.publishing.legacy_news_publisher import SupabaseLegacyNewsPublisher


def test_html_to_plain_text_strips_tags_and_keeps_paragraph_breaks():
    html = (
        "<article><p>Primer párrafo con contenido real y suficientemente largo para pasar el filtro.</p>"
        "<h2>Un subtítulo</h2>"
        "<p>Segundo párrafo, también real, también largo, también con contenido genuino y verificable.</p>"
        "<ul><li>Primer punto real de la lista</li><li>Segundo punto real de la lista</li></ul></article>"
    )
    text = html_to_plain_text(html)
    assert "<" not in text and ">" not in text
    assert "Primer párrafo" in text
    assert "Un subtítulo" in text
    assert "- Primer punto real de la lista" in text
    paragraphs = [p for p in text.split("\n\n") if p]
    assert len(paragraphs) >= 4


def test_html_to_plain_text_unescapes_entities():
    text = html_to_plain_text("<article><p>River &amp; Boca &mdash; el clásico</p></article>")
    assert "&amp;" not in text
    assert "River & Boca" in text


class FakeTable:
    def __init__(self, client):
        self._client = client

    def insert(self, payload):
        self._client.inserted_payload = payload
        return self

    def execute(self):
        return self._client.response


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeSupabaseClient:
    def __init__(self, returned_id="news-generated-id"):
        self.response = FakeResponse([{"id": returned_id}])
        self.inserted_payload = None

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

    news_id = publisher.publish(_artifact(), category_name="Fútbol")

    assert news_id == "news-real-id"
    assert client.inserted_payload["title"] == "Un título real"
    assert client.inserted_payload["slug"] == "un-titulo-real"
    assert client.inserted_payload["category"] == "Fútbol"
    assert client.inserted_payload["status"] == "published"
    assert client.inserted_payload["source_url"] == "https://example.com/a"
    assert "<" not in client.inserted_payload["content"]
