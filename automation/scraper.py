from __future__ import annotations

import argparse
import hashlib
import html
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.container import get_container
from app.domain.discovery.entities import (
    DiscoveryItem,
    DiscoveryScores,
    DiscoveryStatus,
    MaterialKind,
    MaterialReference,
)
from app.domain.shared.ids import DiscoveryItemId


def parse_sources(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        return None


def strip_html(value: str) -> str:
    text = ET.fromstring(f"<root>{value}</root>").text or "" if False else value
    import re
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return " ".join(text.split())


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def fetch_feed(url: str, timeout: float) -> list[dict]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "CronosNewsDiscovery/1.0 (+editorial candidate ingestion)"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"feed returned HTTP {response.status}")
        root = ET.fromstring(response.read())

    records: list[dict] = []
    for element in root.iter():
        if local_name(element.tag).lower() not in {"item", "entry"}:
            continue
        fields: dict[str, str] = {}
        for child in element:
            name = local_name(child.tag).lower()
            fields[name] = (child.text or "").strip()
            if name == "link":
                href = child.attrib.get("href")
                if href:
                    fields["link"] = href

        link = fields.get("link") or fields.get("guid") or fields.get("id")
        title = fields.get("title") or fields.get("name")
        if not link or not title:
            continue

        raw_text = strip_html(
            fields.get("description")
            or fields.get("content")
            or fields.get("summary")
            or ""
        )
        records.append({
            "title": title,
            "link": link,
            "description": raw_text,
            "published": fields.get("pubdate")
            or fields.get("published")
            or fields.get("updated"),
            "author": fields.get("author") or fields.get("creator"),
        })
    return records


def save_candidate(container, record: dict, source_name: str, timeout: float) -> bool:
    source_url = record["link"]
    if container.discovery_repo.exists_by_source_url(source_url):
        return False

    parsed = urlparse(source_url)
    discovered_at = datetime.now(timezone.utc)
    published_at = parse_datetime(record["published"])
    if published_at is not None and published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)

    freshness = None
    if published_at is not None:
        freshness = max(0.0, 1.0 - abs((discovered_at - published_at).total_seconds()) / 604800)

    title = record["title"].strip()
    raw_text = record["description"].strip()
    digest = hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:16]
    item = DiscoveryItem(
        id=DiscoveryItemId.of(digest),
        source_url=source_url,
        original_url=source_url,
        original_title=title,
        raw_text=raw_text or title,
        source_name=source_name,
        source_domain=parsed.hostname or "",
        author=record["author"] or None,
        language=None,
        category_id=None,
        topics=[],
        published_at=published_at,
        discovered_at=discovered_at,
        materials=[],
        scores=DiscoveryScores(
            freshness_score=freshness,
            completeness_score=sum(bool(value) for value in (
                title, raw_text, record["author"], published_at,
            )) / 4,
        ),
        status=DiscoveryStatus.DISCOVERED,
    )
    container.discovery_repo.save(item)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest configurable RSS/Atom feeds into discovery_items")
    parser.add_argument("--sources", default="")
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sources = parse_sources(args.sources)
    if not sources:
        import os
        sources = parse_sources(os.getenv("SCRAPER_SOURCES", ""))
    if not sources:
        raise SystemExit("No scraper sources configured")

    container = get_container()
    saved = 0
    failed = 0
    for source in sources:
        try:
            records = fetch_feed(source, args.timeout)
            source_name = urlparse(source).hostname or source
            for record in records:
                if args.dry_run:
                    saved += 1
                elif save_candidate(container, record, source_name, args.timeout):
                    saved += 1
        except Exception as exc:
            failed += 1
            print(f"scraper source failed {source}: {exc}", file=sys.stderr)

    print(json.dumps({"saved": saved, "failed_sources": failed}))
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
