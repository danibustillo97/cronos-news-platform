"""Web research for capsules (admin): real, citable material from Spanish
Wikipedia that grounds the AI / ChatGPT prompt, so efemérides and legends are
built from sourced facts instead of the model's memory.

POST /api/admin/research {kind, query?, day?}
  -> { facts: [{year, text, section, url}], sources: [{title, url, excerpt}] }

  kind = efemeride  -> football lines from the day page (Acontecimientos,
                       Nacimientos, Fallecimientos) for MM-DD
  otherwise         -> top search results for `query` (+ "fútbol") with intro extracts
"""
from __future__ import annotations

import re
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import Field

from app.presentation.schemas import CamelModel

router = APIRouter(prefix="/api/admin/research", tags=["research"])

_API = "https://es.wikipedia.org/w/api.php"
_PAGE = "https://es.wikipedia.org/wiki/{}"
_HEADERS = {"User-Agent": "NexusNewsBot/1.0 (editorial research)"}
_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
_FOOTBALL = re.compile(
    r"\bf[úu]tbol\b|\bfutbolista|\bfutbol[íi]stic|\bFIFA\b|\bCONMEBOL\b|\bUEFA\b|\bLibertadores\b|\bSudamericana\b"
    r"|\bCopa (Mundial de F|del Mundo|Am[ée]rica|de Campeones|Colombia)|\bMundial de (F[úu]tbol|Clubes)|\bgol(es)?\b"
    r"|\bselecci[óo]n (colombiana|argentina|brasile[ñn]a|de f[úu]tbol|nacional de f)|\bBalón de Oro\b|\bChampions\b",
    re.I,
)
_NOT_FOOTBALL = re.compile(r"Guerra Mundial|golpe de Estado|f[úu]tbol americano|f[úu]tbol sala", re.I)


class ResearchIn(CamelModel):
    kind: str = "leyenda"
    query: str | None = Field(default=None, max_length=160)
    day: str | None = None


def clean_wikitext(text: str) -> str:
    text = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"'{2,}", "", text).replace("&nbsp;", " ")
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip(" *:")


def football_facts(wikitext: str, page_url: str) -> list[dict]:
    facts: list[dict] = []
    section = ""
    for raw in wikitext.split("\n"):
        heading = re.match(r"^==\s*([^=]+?)\s*==\s*$", raw)
        if heading:
            section = heading.group(1)
            continue
        if section not in ("Acontecimientos", "Nacimientos", "Fallecimientos") or not raw.startswith("*"):
            continue
        if not _FOOTBALL.search(raw) or _NOT_FOOTBALL.search(raw):
            continue
        line = clean_wikitext(raw)
        m = re.match(r"^(\d{3,4})\s*:\s*(.+)$", line)
        if not m:
            continue
        facts.append({"year": int(m.group(1)), "text": m.group(2), "section": section, "url": page_url})
    return facts


def day_title(day: str) -> str:
    m = re.fullmatch(r"(\d{2})-(\d{2})", day or "")
    if not m or not 1 <= int(m.group(1)) <= 12:
        raise HTTPException(status_code=422, detail="La fecha va como MM-DD")
    return f"{int(m.group(2))} de {_MONTHS[int(m.group(1)) - 1]}"


async def _get(client: httpx.AsyncClient, params: dict) -> dict:
    try:
        res = await client.get(_API, params={**params, "format": "json", "formatversion": 2}, headers=_HEADERS)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="No se pudo consultar Wikipedia") from exc
    if res.status_code != 200:
        raise HTTPException(status_code=502, detail="Wikipedia no respondió")
    return res.json()


@router.post("")
async def research(body: ResearchIn) -> dict:
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        if body.kind == "efemeride":
            title = day_title(body.day or "")
            data = await _get(client, {"action": "parse", "page": title, "prop": "wikitext", "redirects": 1})
            wikitext = (data.get("parse") or {}).get("wikitext") or ""
            url = _PAGE.format(quote(title.replace(" ", "_")))
            facts = football_facts(wikitext, url)
            return {"facts": facts, "sources": [{"title": title, "url": url, "excerpt": f"{len(facts)} hechos de fútbol encontrados"}]}

        query = (body.query or "").strip()
        if len(query) < 3:
            raise HTTPException(status_code=422, detail="Escribe qué buscar (mínimo 3 caracteres)")
        search = await _get(client, {"action": "query", "list": "search", "srsearch": f"{query} fútbol", "srlimit": 5})
        hits = (search.get("query") or {}).get("search") or []
        if not hits:
            return {"facts": [], "sources": []}
        ids = "|".join(str(h["pageid"]) for h in hits)
        extracts = await _get(client, {"action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1,
                                       "exchars": 1500, "pageids": ids})
        pages = {str(p["pageid"]): p for p in (extracts.get("query") or {}).get("pages") or []}
        sources = []
        for h in hits:
            page = pages.get(str(h["pageid"])) or {}
            excerpt = (page.get("extract") or "").strip()
            if excerpt:
                sources.append({"title": h["title"], "url": _PAGE.format(quote(h["title"].replace(" ", "_"))), "excerpt": excerpt})
        return {"facts": [], "sources": sources}
