from datetime import datetime, timezone

from app.domain.artifact.entities import (
    Artifact, Claim, EvidenceLabel, MediaKind, MediaRequirement, SeoMetadata, SourceReference, ValidationSeverity,
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
        claims=[Claim(id="claim-1", text="River ganó el partido", label=EvidenceLabel.SOURCE_FACT, source_urls=["https://example.com/a"])],
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


def test_html_with_real_editor_toolbar_tags_passes():
    """Revisión 2.0's real toolbar (TiptapEditor) can produce underline,
    code blocks, inline images and links -- the allow-list must match
    what the editor can actually save, or a human's real edit would be
    rejected as if it were corrupt content."""
    html = (
        "<article><p>Texto <u>subrayado</u> y <a href=\"https://example.com\">un link</a>.</p>"
        "<pre><code>const x = 1;</code></pre>"
        "<img src=\"https://example.com/foto.jpg\" /></article>"
    )
    result = validate_artifact(_valid_artifact(content_html=html))
    assert not any(i.check == "content_html" for i in result.issues)


def test_html_with_editorial_blocks_passes_for_safe_video_embed():
    html = (
        '<article><p>Texto.</p><figure data-image-gallery="true">'
        '<img src="https://example.com/a.jpg" /><img src="https://example.com/b.jpg" />'
        '</figure><table><tbody><tr><th>Local</th><td>2</td></tr></tbody></table>'
        '<video src="https://cdn.example.com/highlights.mp4" controls=""></video>'
        '<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe></div>'
        '</article>'
    )
    result = validate_artifact(_valid_artifact(content_html=html))
    assert not any(i.check == "content_html" for i in result.issues)


def test_html_rejects_untrusted_iframe_sources():
    html = (
        '<article><p>Texto.</p><div data-youtube-video="">'
        '<iframe src="https://attacker.example/embed"></iframe></div></article>'
    )
    result = validate_artifact(_valid_artifact(content_html=html))
    assert any(i.check == "content_html" for i in result.issues)


def test_html_rejects_video_without_https_source():
    html = '<article><p>Texto.</p><video src="javascript:alert(1)"></video></article>'
    result = validate_artifact(_valid_artifact(content_html=html))
    assert any(i.check == "content_html" for i in result.issues)


def test_html_rejects_unsupported_div_attributes():
    html = '<article><p>Texto.</p><div onclick="alert(1)">contenido</div></article>'
    result = validate_artifact(_valid_artifact(content_html=html))
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
    a.claims = [Claim(id="claim-1", text="algo no confirmado", label=EvidenceLabel.UNVERIFIED)]
    result = validate_artifact(a)
    assert any(i.check == "evidence" for i in result.issues)


def test_no_claims_fails():
    result = validate_artifact(_valid_artifact(claims=[]))
    assert any(i.check == "evidence" for i in result.issues)


def test_no_feature_image_requirement_fails():
    result = validate_artifact(_valid_artifact(media_requirements=[]))
    assert any(i.check == "multimedia" for i in result.issues)


# ---- Section 7: BLOCKING vs WARNING severity -- the real fix for
# "every warning, however cosmetic, blocked approve()". ----

def test_title_too_long_is_a_warning_and_does_not_block_ok():
    result = validate_artifact(_valid_artifact(title="x" * 71), valid_category_names={"cat-futbol"})
    issue = next(i for i in result.issues if i.check == "title")
    assert issue.severity == ValidationSeverity.WARNING
    assert result.ok  # a cosmetic over-length title alone must still be VALIDATED-eligible


def test_empty_title_is_blocking():
    result = validate_artifact(_valid_artifact(title=""))
    issue = next(i for i in result.issues if i.check == "title")
    assert issue.severity == ValidationSeverity.BLOCKING
    assert not result.ok


def test_seo_title_too_long_is_a_warning():
    long_seo_title = "x" * 61
    result = validate_artifact(
        _valid_artifact(seo=SeoMetadata(seo_title=long_seo_title, seo_description=_valid_artifact().seo.seo_description, slug="un-titulo-editorial-real")),
        valid_category_names={"cat-futbol"},
    )
    issue = next(i for i in result.issues if i.check == "seo_title")
    assert issue.severity == ValidationSeverity.WARNING
    assert result.ok


def test_seo_description_out_of_range_is_a_warning():
    result = validate_artifact(
        _valid_artifact(seo=SeoMetadata(seo_title="Título SEO corto", seo_description="Muy corta.", slug="un-titulo-editorial-real")),
        valid_category_names={"cat-futbol"},
    )
    issue = next(i for i in result.issues if i.check == "seo_description")
    assert issue.severity == ValidationSeverity.WARNING
    assert result.ok


def test_unverified_claim_is_a_warning_and_does_not_block_ok():
    a = _valid_artifact()
    a.claims = [Claim(id="claim-1", text="algo no confirmado", label=EvidenceLabel.UNVERIFIED)]
    result = validate_artifact(a, valid_category_names={"cat-futbol"})
    issue = next(i for i in result.issues if i.check == "evidence")
    assert issue.severity == ValidationSeverity.WARNING
    assert result.ok  # an unverified claim is a real, shown signal -- never a hard stop by itself


def test_reviewed_unverified_claim_clears_the_evidence_warning_entirely():
    """A human editor explicitly reviewing the one flagged claim (section
    4/11) is the real editorial action this warning asks for -- it must
    actually make the warning go away on revalidation, not linger."""
    a = _valid_artifact()
    a.claims = [Claim(id="claim-1", text="algo no confirmado", label=EvidenceLabel.UNVERIFIED, reviewed=True)]
    result = validate_artifact(a, valid_category_names={"cat-futbol"})
    assert not any(i.check == "evidence" for i in result.issues)
    assert result.ok


def test_no_claims_at_all_is_still_blocking():
    result = validate_artifact(_valid_artifact(claims=[]))
    issue = next(i for i in result.issues if i.check == "evidence")
    assert issue.severity == ValidationSeverity.BLOCKING
    assert not result.ok


def test_no_sources_is_blocking():
    result = validate_artifact(_valid_artifact(sources=[]))
    issue = next(i for i in result.issues if i.check == "sources")
    assert issue.severity == ValidationSeverity.BLOCKING


# ── Revisión 2.0 section 2: SOURCE_AVAILABILITY_CLAIM is not "evidence" ──

def test_source_availability_claim_never_counts_as_unverified():
    a = _valid_artifact()
    a.claims = [Claim(
        id="claim-1", text="La fecha exacta no está especificada en las fuentes disponibles.",
        label=EvidenceLabel.SOURCE_AVAILABILITY_CLAIM,
    )]
    result = validate_artifact(a, valid_category_names={"cat-futbol"})
    assert not any(i.check == "evidence" for i in result.issues)
    assert result.ok  # a real, present claim -- "no claims recorded" doesn't apply either


def test_source_availability_claim_mixed_with_a_real_unverified_claim():
    a = _valid_artifact()
    a.claims = [
        Claim(id="claim-1", text="La fecha exacta no está especificada.", label=EvidenceLabel.SOURCE_AVAILABILITY_CLAIM),
        Claim(id="claim-2", text="El equipo ganó por goleada.", label=EvidenceLabel.UNVERIFIED),
    ]
    result = validate_artifact(a, valid_category_names={"cat-futbol"})
    issue = next(i for i in result.issues if i.check == "evidence")
    assert "1 claim" in issue.detail  # only the genuinely UNVERIFIED one counts, not the availability claim


# ── Evolución del Artifact section 6/7: a BODY_IMAGE must be a real node
# in the document, never just a declared-but-invisible requirement ─────

def test_body_image_embedded_in_the_document_has_no_orphan_warning():
    a = _valid_artifact(
        content_html='<article><p>Primer párrafo real.</p><figure data-placeholder-id="BODY_IMAGE_01"></figure><p>Otro párrafo.</p></article>',
        media_requirements=[
            MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto del estadio"),
            MediaRequirement(placeholder_id="BODY_IMAGE_01", kind=MediaKind.BODY_IMAGE, prompt="Foto del embalse"),
        ],
    )
    result = validate_artifact(a, valid_category_names={"cat-futbol"})
    assert not any("not embedded" in i.detail for i in result.issues)


def test_body_image_declared_but_not_embedded_warns():
    a = _valid_artifact(
        media_requirements=[
            MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto del estadio"),
            MediaRequirement(placeholder_id="BODY_IMAGE_01", kind=MediaKind.BODY_IMAGE, prompt="Foto del embalse"),
        ],
    )
    result = validate_artifact(a, valid_category_names={"cat-futbol"})
    issue = next(i for i in result.issues if i.check == "multimedia" and "not embedded" in i.detail)
    assert issue.severity == ValidationSeverity.WARNING  # real inconsistency, never blocking
    assert "BODY_IMAGE_01" in issue.detail
    assert result.ok  # non-blocking -- the article can still be approved


# ── ÚLTIMO BLOQUE ANTES DE PUBLISH: document is the single source of
# truth -- a marker with no matching requirement, or a feature image
# leaking into the body, are both real inconsistencies. ─────────────────

def test_dangling_marker_with_no_matching_requirement_warns():
    a = _valid_artifact(
        content_html='<article><p>Primer párrafo real.</p><figure data-placeholder-id="body_image_1"></figure><p>Otro párrafo.</p></article>',
        media_requirements=[
            MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto del estadio"),
        ],
    )
    result = validate_artifact(a, valid_category_names={"cat-futbol"})
    issue = next(i for i in result.issues if i.check == "multimedia" and "no matching media requirement" in i.detail)
    assert issue.severity == ValidationSeverity.WARNING
    assert "body_image_1" in issue.detail
    assert result.ok  # non-blocking


def test_matching_marker_and_requirement_has_no_dangling_warning():
    a = _valid_artifact(
        content_html='<article><p>Primer párrafo real.</p><figure data-placeholder-id="body_image_1"></figure><p>Otro párrafo.</p></article>',
        media_requirements=[
            MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto del estadio"),
            MediaRequirement(placeholder_id="body_image_1", kind=MediaKind.BODY_IMAGE, prompt="Foto del embalse"),
        ],
    )
    result = validate_artifact(a, valid_category_names={"cat-futbol"})
    assert not any("no matching media requirement" in i.detail for i in result.issues)


def test_feature_image_embedded_in_body_warns():
    a = _valid_artifact(
        content_html='<article><p>Primer párrafo real.</p><figure data-placeholder-id="FEATURE_IMAGE"></figure><p>Otro párrafo.</p></article>',
        media_requirements=[
            MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto del estadio"),
        ],
    )
    result = validate_artifact(a, valid_category_names={"cat-futbol"})
    issue = next(i for i in result.issues if i.check == "multimedia" and "must stay separate" in i.detail)
    assert issue.severity == ValidationSeverity.WARNING
    assert "FEATURE_IMAGE" in issue.detail
    assert result.ok  # non-blocking


def test_feature_image_not_embedded_has_no_separation_warning():
    result = validate_artifact(_valid_artifact(), valid_category_names={"cat-futbol"})
    assert not any("must stay separate" in i.detail for i in result.issues)
