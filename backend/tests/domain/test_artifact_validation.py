from datetime import datetime, timezone

from app.domain.artifact.entities import (
    Artifact, Claim, EvidenceLabel, MediaKind, MediaRequirement, SeoMetadata, SourceReference,
)
from app.domain.artifact.validation import validate_artifact
from app.domain.shared.ids import ArtifactId, StoryId


def _valid_artifact(**overrides):
    defaults = dict(
        artifact_id=ArtifactId.new(), story_id=StoryId.new(), version=1,
        title="Un título editorial real", subtitle="Subtítulo", excerpt="Resumen corto",
        summary="Resumen más largo del artículo",
        content_html="<article><p>Primer párrafo real.</p><h2>Sección</h2><p>Otro párrafo.</p></article>",
        category_id="cat-futbol", tags=["futbol"], entities=["River Plate"],
        seo=SeoMetadata(
            seo_title="Título SEO corto",
            seo_description="Una descripción SEO de largo razonable para pasar la validación real de longitud.",
            slug="un-titulo-editorial-real",
        ),
        sources=[SourceReference(
            source_url="https://example.com/a", source_name="Example", source_domain="example.com",
            author=None, published_at=None, retrieved_at=datetime.now(timezone.utc),
        )],
        claims=[Claim(text="River ganó el partido", label=EvidenceLabel.SOURCE_FACT, source_urls=["https://example.com/a"])],
        media_requirements=[MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto del estadio")],
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return Artifact.draft(**defaults)


def test_fully_valid_artifact_passes():
    result = validate_artifact(_valid_artifact(), valid_category_names={"cat-futbol"})
    assert result.ok, result.issues


def test_empty_title_fails():
    result = validate_artifact(_valid_artifact(title=""))
    assert not result.ok
    assert any(i.check == "title" for i in result.issues)


def test_title_too_long_fails():
    result = validate_artifact(_valid_artifact(title="x" * 71))
    assert any(i.check == "title" for i in result.issues)


def test_malformed_html_without_article_wrapper_fails():
    result = validate_artifact(_valid_artifact(content_html="<p>no wrapper</p>"))
    assert any(i.check == "content_html" for i in result.issues)


def test_html_with_disallowed_tags_fails():
    result = validate_artifact(_valid_artifact(content_html="<article><p>ok</p><script>bad()</script></article>"))
    assert any(i.check == "content_html" for i in result.issues)


def test_invalid_slug_fails():
    a = _valid_artifact()
    a.seo = SeoMetadata(seo_title=a.seo.seo_title, seo_description=a.seo.seo_description, slug="Not A Valid Slug!")
    result = validate_artifact(a)
    assert any(i.check == "slug" for i in result.issues)


def test_no_sources_fails():
    result = validate_artifact(_valid_artifact(sources=[]))
    assert any(i.check == "sources" for i in result.issues)


def test_unknown_category_fails_when_taxonomy_given():
    result = validate_artifact(_valid_artifact(category_id="not-real"), valid_category_names={"cat-futbol"})
    assert any(i.check == "category" for i in result.issues)


def test_missing_category_fails():
    result = validate_artifact(_valid_artifact(category_id=None))
    assert any(i.check == "category" for i in result.issues)


def test_unverified_claim_fails():
    a = _valid_artifact()
    a.claims = [Claim(text="algo no confirmado", label=EvidenceLabel.UNVERIFIED)]
    result = validate_artifact(a)
    assert any(i.check == "evidence" for i in result.issues)


def test_no_claims_fails():
    result = validate_artifact(_valid_artifact(claims=[]))
    assert any(i.check == "evidence" for i in result.issues)


def test_no_feature_image_requirement_fails():
    result = validate_artifact(_valid_artifact(media_requirements=[]))
    assert any(i.check == "multimedia" for i in result.issues)
