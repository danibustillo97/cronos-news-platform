"""Web-wide search of the same story for the plagiarism check.

Bing News RSS returns the outlets' real article URLs (Google News only gives
encoded redirects), so we search the article title there, download each page
and extract its readable text. Only public http(s) hosts are fetched (no
internal addresses), with short timeouts and a size cap.
"""
from __future__ import annotations

import concurrent.futures as cf
import html
import ipaddress
import re
import socket
from dataclasses import dataclass
from urllib.parse import parse_qs, quote, urlparse

import httpx

_BING = "https://www.bing.com/news/search?q={q}&format=rss&setlang=es"
_UA = {"User-Agent": "Mozilla/5.0 (compatible; NexusNewsBot/1.0; originality check)"}
_MAX_BYTES = 1_500_000


@dataclass(frozen=True)
class WebArticle:
    title: str
    url: str
    source: str
    text: str


def is_public_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return False
        infos = socket.getaddrinfo(parsed.hostname, None)
        return all(ipaddress.ip_address(info[4][0]).is_global for info in infos)
    except (ValueError, OSError):
        return False


def real_url(link: str) -> str:
    """Bing wraps results as apiclick.aspx?...&url=<encoded>; unwrap it."""
    link = html.unescape(link)
    if "apiclick.aspx" in link:
        target = parse_qs(urlparse(link).query).get("url", [""])[0]
        return target or link
    return link


def parse_bing_rss(xml: str) -> list[tuple[str, str, str]]:
    items = []
    for block in re.findall(r"<item>(.*?)</item>", xml, flags=re.S):
        title = html.unescape(re.sub(r"<[^>]+>", "", (re.search(r"<title>(.*?)</title>", block, re.S) or [None, ""])[1])).strip()
        link = (re.search(r"<link>(.*?)</link>", block, re.S) or [None, ""])[1].strip()
        source = html.unescape((re.search(r"<News:Source>(.*?)</News:Source>", block, re.S) or [None, ""])[1]).strip()
        url = real_url(link)
        if title and url.startswith("http"):
            items.append((title, url, source or (urlparse(url).hostname or "")))
    return items


def readable_text(page: str) -> str:
    """Paragraph text of an article page (good enough for overlap measurement)."""
    page = re.sub(r"(?is)<(script|style|noscript|nav|footer|header|aside|form)[^>]*>.*?</\1>", " ", page)
    paragraphs = [html.unescape(re.sub(r"<[^>]+>", " ", p)) for p in re.findall(r"(?is)<p[^>]*>(.*?)</p>", page)]
    paragraphs = [re.sub(r"\s+", " ", p).strip() for p in paragraphs]
    return "\n".join(p for p in paragraphs if len(p) >= 60)


class BingStorySearch:
    def __init__(self, timeout: float = 6.0, max_articles: int = 8) -> None:
        self._timeout = timeout
        self._max = max_articles

    def search(self, query: str, exclude_hosts: set[str] | None = None) -> list[WebArticle]:
        exclude_hosts = exclude_hosts or set()
        try:
            res = httpx.get(_BING.format(q=quote(query[:160])), headers=_UA, timeout=self._timeout, follow_redirects=True)
            hits = parse_bing_rss(res.text) if res.status_code == 200 else []
        except httpx.HTTPError:
            return []
        hits = [h for h in hits if (urlparse(h[1]).hostname or "") not in exclude_hosts][: self._max]
        with cf.ThreadPoolExecutor(max_workers=min(8, len(hits) or 1)) as pool:
            return [a for a in pool.map(self._fetch, hits) if a]

    def _fetch(self, hit: tuple[str, str, str]) -> WebArticle | None:
        title, url, source = hit
        if not is_public_url(url):
            return None
        try:
            with httpx.stream("GET", url, headers=_UA, timeout=self._timeout, follow_redirects=True) as res:
                if res.status_code != 200 or "html" not in res.headers.get("content-type", "html"):
                    return None
                chunks, size = [], 0
                for chunk in res.iter_text():
                    chunks.append(chunk)
                    size += len(chunk)
                    if size > _MAX_BYTES:
                        break
            text = readable_text("".join(chunks))
        except httpx.HTTPError:
            return None
        return WebArticle(title=title, url=url, source=source, text=text) if len(text) >= 200 else None
