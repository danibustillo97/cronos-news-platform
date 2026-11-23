import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

import scraper  # noqa: E402
from scraper import (  # noqa: E402
    ScraperSettings, Source, extract_readable, ingest, normalize_url, parse_feed, parse_sources, strip_html,
)
from app.domain.category.entities import Category, CategoryGroup  # noqa: E402

NOW = datetime(2026, 11, 23, 12, 0, tzinfo=timezone.utc)
LONG = "Texto completo del artículo con suficientes palabras para pasar el filtro de párrafos cortos. " * 2

RSS = f"""<?xml version="1.0"?>
<rss xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<item><title>Real Madrid gana la final</title><link>https://news.test/a?utm_source=rss&amp;id=1</link>
  <description>Resumen corto</description><pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate>
  <dc:creator>Ana</dc:creator><media:content url="https://img.test/a.jpg" medium="image"/></item>
<item><title>Nota vieja</title><link>https://news.test/old</link><description>x</description>
  <pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate></item>
<item><title>Con content encoded</title><link>https://news.test/c</link><description>corto</description>
  <content:encoded><![CDATA[<p>{LONG}</p>]]></content:encoded><pubDate>Mon, 23 Nov 2026 11:00:00 GMT</pubDate></item>
</channel></rss>""".encode()

ATOM = b"""<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>Atom entry</title><link rel="alternate" href="https://atom.test/e1"/>
<updated>2026-11-23T09:00:00Z</updated><summary>Resumen atom</summary><author><name>Luis</name></author></entry>
</feed>"""

ARTICLE = f"""<html><head><meta property="og:image" content="/og.jpg"></head><body>
<nav><p>{LONG} menu</p></nav><article><p>{LONG}</p><p>Suscríbete a nuestro newsletter para recibir más noticias del día.</p>
<p>Corto</p></article></body></html>"""


def test_parse_sources_with_category_hints_and_dedupe():
    assert parse_sources("https://a.test/rss, https://b.test/feed|Fútbol\n#comentario\nhttps://a.test/rss\nftp://x") == [
        Source("https://a.test/rss"), Source("https://b.test/feed", "Fútbol"),
    ]


def test_strip_html():
    assert strip_html("<p>Hello <strong>world</strong></p>") == "Hello world"


def test_normalize_url_drops_tracking_and_fragment():
    assert normalize_url("https://News.Test/a?utm_source=x&id=1&fbclid=z#top") == "https://news.test/a?id=1"


def test_parse_rss_reads_media_image_author_and_content_encoded():
    records = parse_feed(RSS)
    assert [r.title for r in records] == ["Real Madrid gana la final", "Nota vieja", "Con content encoded"]
    first = records[0]
    assert first.image_url == "https://img.test/a.jpg"
    assert first.author == "Ana"
    assert first.published == datetime(2026, 11, 23, 10, 0, tzinfo=timezone.utc)
    assert records[2].description.startswith("Texto completo")  # content:encoded beats short description


def test_parse_atom():
    (entry,) = parse_feed(ATOM)
    assert (entry.link, entry.author, entry.description) == ("https://atom.test/e1", "Luis", "Resumen atom")


def test_extract_readable_skips_nav_boilerplate_and_short_paragraphs():
    text, image = extract_readable(ARTICLE, "https://news.test/a")
    assert text.startswith("Texto completo") and "newsletter" not in text and "Corto" not in text
    assert "menu" not in text
    assert image == "https://news.test/og.jpg"


# ── ingest() with fakes ────────────────────────────────────────────────────

class FakeDiscoveryRepo:
    def __init__(self, existing=()):
        self.saved = {}
        self.existing = set(existing)

    def exists_by_source_url(self, url):
        return url in self.existing or any(i.source_url == url for i in self.saved.values())

    def save(self, item):
        self.saved[str(item.id)] = item


class FakeCategoryRepo:
    def list_tree(self):
        futbol = Category(id="cat-futbol", group_id="g", name="Fútbol", slug="futbol", sort_order=1, active=True)
        return [CategoryGroup(id="g", name="Deportes", slug="deportes", sort_order=1, active=True, categories=[futbol])]


class FakeContainer:
    def __init__(self, existing=()):
        self.discovery_repo = FakeDiscoveryRepo(existing)
        self.category_repo = FakeCategoryRepo()


def _client(routes):
    def handler(request):
        key = str(request.url).split("?")[0]
        status, body, ctype = routes.get(key, (404, b"", "text/plain"))
        return httpx.Response(status, content=body, headers={"content-type": ctype})
    return httpx.Client(transport=httpx.MockTransport(handler))


def _routes():
    return {
        "https://feed.test/rss": (200, RSS, "application/rss+xml"),
        "https://broken.test/rss": (500, b"", "text/plain"),
        "https://news.test/a": (200, ARTICLE.encode(), "text/html"),
        "https://news.test/c": (404, b"", "text/plain"),
    }


def test_ingest_full_pipeline(monkeypatch):
    monkeypatch.setattr(scraper, "_is_public_http_url", lambda url: True)
    container = FakeContainer()
    report = ingest(
        container, [Source("https://feed.test/rss", "Fútbol"), Source("https://broken.test/rss")],
        ScraperSettings(max_age_hours=48), http=_client(_routes()), now=NOW,
    )
    feed, broken = report.sources
    assert (feed.found, feed.saved, feed.too_old, feed.full_text) == (3, 2, 1, 1)
    assert broken.error and report.failed_sources == 1

    items = {i.original_title: i for i in container.discovery_repo.saved.values()}
    madrid = items["Real Madrid gana la final"]
    assert madrid.source_url == "https://news.test/a?id=1"           # normalized
    assert madrid.raw_text.startswith("Texto completo")               # full text from the page
    assert madrid.category_id == "cat-futbol"                         # source hint
    assert madrid.materials[0].url == "https://img.test/a.jpg"        # feed image wins over og:image
    assert madrid.scores.freshness_score is not None
    assert items["Con content encoded"].raw_text.startswith("Texto completo")  # page 404 -> feed content


def test_ingest_skips_duplicates_and_respects_budget(monkeypatch):
    monkeypatch.setattr(scraper, "_is_public_http_url", lambda url: True)
    container = FakeContainer(existing={"https://news.test/a?id=1"})
    report = ingest(container, [Source("https://feed.test/rss")],
                    ScraperSettings(max_age_hours=0, max_new_items=2), http=_client(_routes()), now=NOW)
    (src,) = report.sources
    # newest first: "content encoded" (11:00) saved, Madrid (10:00) duplicate, old one fills the budget
    assert (src.saved, src.duplicates) == (2, 1)
    titles = [i.original_title for i in container.discovery_repo.saved.values()]
    assert titles == ["Con content encoded", "Nota vieja"]


def test_per_source_cap_counts_saved_items_not_records(monkeypatch):
    monkeypatch.setattr(scraper, "_is_public_http_url", lambda url: True)
    report = ingest(FakeContainer(), [Source("https://feed.test/rss")],
                    ScraperSettings(max_age_hours=48, max_items_per_source=1), http=_client(_routes()), now=NOW)
    (src,) = report.sources
    assert src.saved == 1


def test_ingest_stops_cooperatively():
    report = ingest(FakeContainer(), [Source("https://feed.test/rss")], ScraperSettings(),
                    should_stop=lambda: True, http=_client(_routes()), now=NOW)
    assert report.stopped and report.sources == []


def test_settings_from_env():
    s = ScraperSettings.from_env({"SCRAPER_MAX_AGE_HOURS": "12", "SCRAPER_FETCH_FULL_TEXT": "0", "SCRAPER_TIMEOUT": "x"})
    assert (s.max_age_hours, s.fetch_full_text, s.timeout) == (12.0, False, 15.0)


def test_old_items_cutoff_uses_now():
    assert NOW - timedelta(hours=48) > datetime(2026, 11, 2, tzinfo=timezone.utc)


def test_budget_is_shared_round_robin_across_sources(monkeypatch):
    monkeypatch.setattr(scraper, "_is_public_http_url", lambda url: True)
    feed = lambda host: (200, f"""<rss><channel>{''.join(
        f'<item><title>Nota {host} {i}</title><link>https://{host}/n{i}</link><description>Texto</description></item>'
        for i in range(5))}</channel></rss>""".encode(), "application/rss+xml")
    routes = {"https://a.test/rss": feed("a.test"), "https://b.test/rss": feed("b.test"), "https://c.test/rss": feed("c.test")}
    report = ingest(FakeContainer(), [Source("https://a.test/rss"), Source("https://b.test/rss"), Source("https://c.test/rss")],
                    ScraperSettings(max_age_hours=0, max_new_items=6, fetch_full_text=False), http=_client(routes), now=NOW)
    assert [s.saved for s in report.sources] == [2, 2, 2]   # not [5, 1, 0]
