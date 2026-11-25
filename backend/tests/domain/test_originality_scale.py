from app.domain.editorial.originality import SourceText, rank_by_overlap
from app.infrastructure.web.story_search import is_public_url, parse_bing_rss, readable_text, real_url

ARTICLE = ("Atlético Nacional venció a Independiente Medellín en el clásico paisa y quedó como líder del "
           "cuadrangular con siete puntos después de cuatro fechas disputadas en el Atanasio Girardot.")


def test_rank_by_overlap_keeps_the_closest_texts():
    copy = SourceText(name="Copia", url="https://a", text=ARTICLE)
    partial = SourceText(name="Parcial", url="https://b", text="Atlético Nacional venció a Independiente Medellín en el clásico paisa ayer.")
    other = SourceText(name="Otra", url="https://c", text="Millonarios empató con Santa Fe en el Campín.")
    ranked = rank_by_overlap(ARTICLE, [other, partial, copy], keep=2)
    assert [s.name for s in ranked] == ["Copia", "Parcial"]


def test_bing_rss_parsing_unwraps_real_urls():
    xml = ("<rss><channel><item><title>Nacional gana el clásico</title>"
           "<link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;url=https%3a%2f%2fwww.semana.com%2fdeportes%2fnota&amp;c=1</link>"
           "<News:Source>Semana</News:Source></item></channel></rss>")
    assert parse_bing_rss(xml) == [("Nacional gana el clásico", "https://www.semana.com/deportes/nota", "Semana")]
    assert real_url("https://example.com/a") == "https://example.com/a"


def test_readable_text_and_ssrf_guard():
    page = "<html><script>var x=1</script><nav><p>Menú menú menú menú menú menú menú menú menú menú menú menú</p></nav>" \
           f"<article><p>{ARTICLE}</p><p>corto</p></article></html>"
    assert readable_text(page) == ARTICLE
    assert is_public_url("http://127.0.0.1/admin") is False
    assert is_public_url("http://localhost:8000/") is False
    assert is_public_url("ftp://example.com/x") is False
