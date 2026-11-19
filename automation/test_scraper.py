from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from scraper import parse_sources, strip_html


def test_parse_sources():
    assert parse_sources("https://a.test/rss, https://b.test/feed") == [
        "https://a.test/rss",
        "https://b.test/feed",
    ]


def test_strip_html():
    assert strip_html("<p>Hello <strong>world</strong></p>") == "Hello world"
