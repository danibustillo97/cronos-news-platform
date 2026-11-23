"""CRONOS editorial scraper -- RSS/Atom -> discovery_items (Supabase).

Runs in GitHub Actions (scraper.yml every 30 min, discovery-processing.yml on
demand from the panel's "Buscar" button). Both use `ingest()` below, so
there is exactly one ingestion implementation.

Per run, for every configured source:
  1. Download the feed (RSS 2.0 or Atom), follow redirects.
  2. Normalize each link (drop utm_*/fbclid/... and #fragments) and skip it
     if it is already in discovery_items.
  3. Skip items older than SCRAPER_MAX_AGE_HOURS.
  4. Fetch the article page and extract the readable text + og:image, so
     editors (and the AI, in automatic mode) work from the full story, not
     the 1-3 line feed summary. Falls back to the feed text on failure.
  5. Classify against the real category taxonomy (or the source's category
     hint) and compute the domain's freshness/completeness/material scores.
  6. Save as DISCOVERED.

Configuration (environment variables; GitHub secret/variables):
  (sources)                     come from the CONTENT PROFILE chosen in the panel's setup
                                (mode Fútbol / Todo, competitions, focuses, extra feeds).
  SCRAPER_SOURCES               optional extra feeds, comma/newline separated ("url|Categoría").
  SCRAPER_MAX_AGE_HOURS         default 48   (0 = no age limit)
  SCRAPER_MAX_ITEMS_PER_SOURCE  default 15
  SCRAPER_MAX_NEW_ITEMS         default 150  (total new items per run)
  SCRAPER_FETCH_FULL_TEXT       default 1    (0 = feed text only)
  SCRAPER_TIMEOUT               default 15   (seconds per HTTP request)

Exit code: 0 if at least one source worked (or there were none failing),
1 only if EVERY source failed -- one broken feed never turns the run red.
Logs carry counts and hostnames only: the repo is public, so are its logs.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import ipaddress
import json
import os
import re
import socket
import sys
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Callable
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import httpx

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.domain.discovery.classification import classify  # noqa: E402
from app.domain.discovery.entities import (  # noqa: E402
    DiscoveryItem, DiscoveryScores, MaterialKind, MaterialReference,
)
from app.domain.discovery.scoring import (  # noqa: E402
    compute_completeness_score, compute_freshness_score, compute_material_score,
)
from app.domain.shared.ids import DiscoveryItemId  # noqa: E402
from app.domain.content.profile import ContentProfile, Relevance, score_relevance  # noqa: E402

USER_AGENT = "Mozilla/5.0 (compatible; CronosNewsDiscovery/2.0; +editorial candidate ingestion)"
MAX_TEXT_CHARS = 12000
MIN_PARAGRAPH_CHARS = 60
_TRACKING_PARAMS = re.compile(r"^(utm_[a-z]+|fbclid|gclid|dclid|mc_[a-z]+|igshid|ref|ref_src|ocid|cmpid)$", re.I)
_BOILERPLATE = re.compile(
    r"cookies?|suscr[ií]b|newsletter|publicidad|aceptar|inicia sesi[oó]n|reg[ií]strate|derechos reservados"
    r"|all rights reserved|sign up|subscribe|lee también|te puede interesar"
    r"|obrigado pela participa|leia também|assine|newsletter|inscreva-se",
    re.I,
)


# ── Configuration ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Source:
    url: str
    category_hint: str | None = None
    name: str | None = None

    @property
    def host(self) -> str:
        return urlparse(self.url).hostname or self.url

    @property
    def label(self) -> str:
        return self.name or self.host


def profile_sources(profile, extra: str = "") -> list[Source]:
    """Sources from the content profile (setup) + optional extra feeds
    (SCRAPER_SOURCES), de-duplicated by URL."""
    sources = [Source(url=s.url, name=getattr(s, "name", None)) for s in profile.active_sources()]
    seen = {s.url for s in sources}
    return [*sources, *(s for s in parse_sources(extra) if s.url not in seen)]


@dataclass(frozen=True)
class ScraperSettings:
    max_age_hours: float = 48.0
    max_items_per_source: int = 15
    max_new_items: int = 150
    fetch_full_text: bool = True
    timeout: float = 15.0

    @staticmethod
    def from_env(env: dict | None = None) -> "ScraperSettings":
        env = os.environ if env is None else env

        def num(name: str, default: float) -> float:
            try:
                return float(env.get(name, "") or default)
            except ValueError:
                return default

        return ScraperSettings(
            max_age_hours=num("SCRAPER_MAX_AGE_HOURS", 48),
            max_items_per_source=max(1, int(num("SCRAPER_MAX_ITEMS_PER_SOURCE", 15))),
            max_new_items=max(1, int(num("SCRAPER_MAX_NEW_ITEMS", 150))),
            fetch_full_text=(env.get("SCRAPER_FETCH_FULL_TEXT", "1") or "1").strip() not in ("0", "false", "no"),
            timeout=max(3.0, num("SCRAPER_TIMEOUT", 15)),
        )


def parse_sources(value: str) -> list[Source]:
    sources: list[Source] = []
    seen: set[str] = set()
    for chunk in re.split(r"[,\n]", value or ""):
        chunk = chunk.strip()
        if not chunk or chunk.startswith("#"):
            continue
        url, _, hint = chunk.partition("|")
        url = url.strip()
        if not url.lower().startswith(("http://", "https://")) or url in seen:
            continue
        seen.add(url)
        sources.append(Source(url=url, category_hint=hint.strip() or None))
    return sources


# ── URL / text helpers ─────────────────────────────────────────────────────

def normalize_url(url: str) -> str:
    """Same article, same key: lowercase host, no tracking params, no fragment."""
    parsed = urlparse(url.strip())
    query = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if not _TRACKING_PARAMS.match(k)]
    return urlunparse((
        parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or "/", parsed.params, urlencode(query), "",
    ))


def strip_html(value: str) -> str:
    text = re.sub(r"<(script|style)\b[\s\S]*?</\1>", " ", value or "", flags=re.I)
    text = re.sub(r"<br\s*/?>|</p>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    lines = [" ".join(line.split()) for line in text.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    parsed: datetime | None = None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError, OverflowError):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", (text or "").lower())
    return "".join(c for c in text if not unicodedata.combining(c)).strip()


def _is_public_http_url(url: str) -> bool:
    """Basic SSRF guard for article pages linked from feeds."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except OSError:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False
    return True


# ── Feed parsing ───────────────────────────────────────────────────────────

@dataclass
class FeedRecord:
    title: str
    link: str
    description: str = ""
    published: datetime | None = None
    author: str | None = None
    image_url: str | None = None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def parse_feed(xml_bytes: bytes, base_url: str = "") -> list[FeedRecord]:
    root = ET.fromstring(xml_bytes.lstrip(b"\xef\xbb\xbf \r\n\t"))
    records: list[FeedRecord] = []
    for element in root.iter():
        if _local(element.tag) not in ("item", "entry"):
            continue
        title = link = description = content = author = image = None
        published_raw = None
        for child in element:
            name = _local(child.tag)
            text = (child.text or "").strip()
            media_url = child.attrib.get("url")
            if media_url and name in ("content", "thumbnail", "enclosure"):  # media:* / enclosure
                kind = child.attrib.get("type", "") or child.attrib.get("medium", "")
                if name == "thumbnail" or kind.startswith("image") or not kind:
                    image = image or media_url
                continue
            if name == "title":
                title = strip_html(text)
            elif name == "link":
                href = child.attrib.get("href")
                rel = child.attrib.get("rel", "alternate")
                if href and rel == "alternate":
                    link = link or href
                elif text:
                    link = link or text
                if href and rel == "enclosure" and child.attrib.get("type", "").startswith("image/"):
                    image = image or href
            elif name in ("guid", "id") and text.startswith("http"):
                link = link or text
            elif name in ("description", "summary"):
                description = description or text
            elif name in ("encoded", "content"):
                content = content or text
            elif name in ("pubdate", "published", "updated", "date"):
                published_raw = published_raw or text
            elif name in ("creator", "author"):
                nested = next((c.text for c in child if _local(c.tag) == "name" and c.text), None)
                author = author or (nested or text or None)
            elif name == "group":  # media:group > media:content
                for sub in child:
                    url = sub.attrib.get("url")
                    if url and _local(sub.tag) in ("content", "thumbnail"):
                        image = image or url
        if not title or not link:
            continue
        body = strip_html(content or "") if content and len(strip_html(content)) > len(strip_html(description or "")) \
            else strip_html(description or "")
        if not image and (content or description):
            match = re.search(r"<img[^>]+src=[\"']([^\"']+)", content or description or "", re.I)
            image = match.group(1) if match else None
        records.append(FeedRecord(
            title=title, link=urljoin(base_url, link), description=body,
            published=parse_datetime(published_raw), author=(author or None),
            image_url=urljoin(base_url, image) if image else None,
        ))
    return records


# ── Article page extraction ────────────────────────────────────────────────

def _meta(page: str, attr: str, value: str) -> str | None:
    for pattern in (
        rf"<meta[^>]+{attr}=[\"']{re.escape(value)}[\"'][^>]*content=[\"']([^\"']*)[\"']",
        rf"<meta[^>]+content=[\"']([^\"']*)[\"'][^>]*{attr}=[\"']{re.escape(value)}[\"']",
    ):
        match = re.search(pattern, page, re.I)
        if match and match.group(1).strip():
            return html.unescape(match.group(1).strip())
    return None


def extract_readable(page: str, base_url: str = "") -> tuple[str, str | None]:
    """(text, og_image). Paragraphs inside <article>/<main>/<body>, minus
    boilerplate -- the same heuristic as frontend /api/import-article."""
    cleaned = re.sub(r"<(script|style|noscript|svg|iframe|form|nav|footer|aside)\b[\s\S]*?</\1>", " ", page, flags=re.I)
    cleaned = re.sub(r"<!--[\s\S]*?-->", " ", cleaned)
    def paragraphs_in(scope: str) -> list[str]:
        found: list[str] = []
        for match in re.finditer(r"<p\b[^>]*>([\s\S]*?)</p>", scope, re.I):
            text = " ".join(strip_html(match.group(1)).split())
            if len(text) < MIN_PARAGRAPH_CHARS or _BOILERPLATE.search(text) or text in found:
                continue
            found.append(text)
            if len(found) >= 40:
                break
        return found

    # Pages often have several <article> (related-news cards, teasers): use
    # the candidate scope that really holds the most article text.
    scopes = [m.group(1) for m in re.finditer(r"<article\b[^>]*>([\s\S]*?)</article>", cleaned, re.I)]
    for tag in ("main", "body"):
        match = re.search(rf"<{tag}\b[^>]*>([\s\S]*?)</{tag}>", cleaned, re.I)
        if match:
            scopes.append(match.group(1))
    scopes = scopes or [cleaned]
    best = max((paragraphs_in(scope) for scope in scopes), key=lambda ps: sum(len(p) for p in ps), default=[])
    image = _meta(page, "property", "og:image") or _meta(page, "name", "twitter:image")
    return "\n\n".join(best)[:MAX_TEXT_CHARS], (urljoin(base_url, image) if image else None)


def fetch_article(client: httpx.Client, url: str) -> tuple[str, str | None]:
    if not _is_public_http_url(url):
        return "", None
    response = client.get(url)
    if response.status_code != 200 or "html" not in response.headers.get("content-type", "html"):
        return "", None
    return extract_readable(response.text, str(response.url))


# ── Ingestion ──────────────────────────────────────────────────────────────

@dataclass
class SourceReport:
    host: str
    found: int = 0
    saved: int = 0
    duplicates: int = 0
    too_old: int = 0
    off_topic: int = 0
    full_text: int = 0
    error: str | None = None


@dataclass
class IngestReport:
    sources: list[SourceReport] = field(default_factory=list)
    stopped: bool = False

    @property
    def saved(self) -> int:
        return sum(s.saved for s in self.sources)

    @property
    def failed_sources(self) -> int:
        return sum(1 for s in self.sources if s.error)

    def as_dict(self) -> dict:
        return {
            "saved": self.saved, "failed_sources": self.failed_sources, "stopped": self.stopped,
            "sources": [s.__dict__ for s in self.sources],
        }


def _category_for(hint: str | None, text: str, groups) -> tuple[str | None, list[str]]:
    category_id, topics = classify(text, groups)
    if hint:
        wanted = _fold(hint)
        for group in groups:
            for category in group.categories:
                if wanted in (_fold(category.name), _fold(category.slug)):
                    return category.id, topics
    return category_id, topics


def build_item(record: FeedRecord, source: Source, groups, text: str, image_url: str | None,
               now: datetime, relevance: Relevance | None = None) -> DiscoveryItem:
    url = normalize_url(record.link)
    materials = [MaterialReference(kind=MaterialKind.IMAGE, url=image_url)] if image_url else []
    category_id, topics = _category_for(source.category_hint, f"{record.title}\n{text}", groups)
    if relevance is not None:
        topics = list(dict.fromkeys([*relevance.topics, *topics]))
    return DiscoveryItem.discover(
        item_id=DiscoveryItemId.of(hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]),
        source_url=url, original_url=record.link, original_title=record.title.strip(),
        raw_text=(text or record.title).strip(), source_name=source.label,
        source_domain=urlparse(url).hostname or "", discovered_at=now, published_at=record.published,
        author=record.author, category_id=category_id, topics=topics, materials=materials,
        scores=DiscoveryScores(
            freshness_score=compute_freshness_score(record.published, now),
            completeness_score=compute_completeness_score(
                has_title=bool(record.title), has_content=bool(text), has_image=bool(image_url),
                has_published_at=record.published is not None, has_author=bool(record.author),
            ),
            material_score=compute_material_score(len(materials)),
            relevance_score=relevance.score if relevance is not None else None,
        ),
    )


def ingest(
    container,
    sources: list[Source],
    settings: ScraperSettings,
    should_stop: Callable[[], bool] | None = None,
    dry_run: bool = False,
    http: httpx.Client | None = None,
    now: datetime | None = None,
    profile: ContentProfile | None = None,
) -> IngestReport:
    report = IngestReport()
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=settings.max_age_hours) if settings.max_age_hours > 0 else None
    groups = container.category_repo.list_tree()
    own_client = http is None
    client = http or httpx.Client(
        timeout=settings.timeout, follow_redirects=True, headers={"User-Agent": USER_AGENT},
    )
    budget = settings.max_new_items

    def fetch_feed(source: Source) -> tuple[list[FeedRecord], str | None]:
        try:
            response = client.get(source.url)
            if response.status_code != 200:
                raise RuntimeError(f"feed HTTP {response.status_code}")
            return parse_feed(response.content, str(response.url)), None
        except Exception as exc:  # noqa: BLE001 -- one bad feed never stops the run
            return [], f"{type(exc).__name__}: {str(exc)[:120]}"

    try:
        if should_stop and should_stop():
            report.stopped = True
            return report
        # 1. Download every feed in parallel.
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=8) as pool:
            fetched = list(pool.map(fetch_feed, sources))

        oldest = datetime.min.replace(tzinfo=timezone.utc)
        queues: list[tuple[Source, SourceReport, list[FeedRecord]]] = []
        for source, (records, error) in zip(sources, fetched):
            src = SourceReport(host=source.label, found=len(records), error=error)
            report.sources.append(src)
            records.sort(key=lambda r: r.published or oldest, reverse=True)  # newest first
            queues.append((source, src, records))

        # 2. Round-robin: one candidate per source per turn, so the budget is
        #    shared fairly (variety) instead of being spent by the first feeds.
        def candidates():
            while True:
                progressed = False
                for source, src, records in queues:
                    if records and src.saved < settings.max_items_per_source:
                        progressed = True
                        yield source, src, records.pop(0)
                if not progressed:
                    return

        for source, src, record in candidates():
            if budget <= 0:
                break
            if should_stop and should_stop():
                report.stopped = True
                break
            if cutoff and record.published and record.published < cutoff:
                src.too_old += 1
                continue
            url = normalize_url(record.link)
            repo = container.discovery_repo
            if repo.exists_by_source_url(url) or (url != record.link and repo.exists_by_source_url(record.link)):
                src.duplicates += 1
                continue

            text, image = record.description, record.image_url
            relevance = None
            if profile is not None:
                # Cheap first pass on the feed text: drop blocked / other-sport
                # items before spending a page download on them.
                first = score_relevance(profile, record.title, text or "")
                if not first.keep and first.reason != "no es de fútbol o no toca tus competiciones":
                    src.off_topic += 1
                    continue
            if settings.fetch_full_text:
                try:
                    page_text, og_image = fetch_article(client, record.link)
                except Exception:  # noqa: BLE001 -- fall back to feed text
                    page_text, og_image = "", None
                if len(page_text) > len(text or ""):
                    text = page_text
                    src.full_text += 1
                image = image or og_image

            if profile is not None:
                relevance = score_relevance(profile, record.title, text or "")
                if not relevance.keep:
                    src.off_topic += 1
                    continue
            item = build_item(record, source, groups, text, image, now, relevance)
            if not dry_run:
                repo.save(item)
            src.saved += 1
            budget -= 1
    finally:
        if own_client:
            client.close()
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest configured RSS/Atom feeds into discovery_items")
    parser.add_argument("--sources", default="", help="overrides SCRAPER_SOURCES")
    parser.add_argument("--dry-run", action="store_true", help="fetch and parse, never write")
    args = parser.parse_args()

    from app.container import get_container

    container = get_container()
    profile = container.content_profile_repo.get()
    sources = parse_sources(args.sources) if args.sources else profile_sources(profile, os.getenv("SCRAPER_SOURCES", ""))
    if not sources:
        print("No hay fuentes: configura el perfil de contenido en el panel (o SCRAPER_SOURCES)", file=sys.stderr)
        return 1
    print(f"perfil: modo={profile.mode} competiciones={len(profile.competitions)} fuentes={len(sources)}")
    report = ingest(container, sources, ScraperSettings.from_env(), dry_run=args.dry_run, profile=profile)
    print(json.dumps(report.as_dict(), ensure_ascii=False))
    for src in report.sources:
        if src.error:
            print(f"::warning::scraper source failed {src.host}: {src.error}")
    all_failed = bool(report.sources) and report.failed_sources == len(report.sources)
    return 1 if all_failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
