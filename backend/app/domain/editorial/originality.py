"""ORIGINALITY -- how much of an article is copied from its sources.

Deterministic, explainable plagiarism check (the standard "shingling"
technique used by plagiarism detectors): both texts are normalised (lower
case, no accents/punctuation) and cut into overlapping 6-word sequences.

  originality = 1 - |article shingles found in ANY source| / |article shingles|

A sentence is reported as "copied" when at least half of its 6-word
sequences appear in one source -- that's what editors need to rewrite.
6 words is the usual threshold: shorter runs are common phrases ("el
partido de este domingo"), longer ones are unmistakably copied text.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

SHINGLE = 6
COPIED_SENTENCE_RATIO = 0.5


def _normalise(text: str) -> list[str]:
    text = unicodedata.normalize("NFKD", (text or "").lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.findall(r"[a-z0-9]+", text)


def shingles(text: str, size: int = SHINGLE) -> set[tuple[str, ...]]:
    words = _normalise(text)
    return {tuple(words[i:i + size]) for i in range(len(words) - size + 1)}


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?…])\s+|\n+", text or "")
    return [p.strip() for p in parts if len(_normalise(p)) >= SHINGLE]


@dataclass(frozen=True)
class SourceText:
    name: str
    url: str
    text: str


@dataclass
class SourceOverlap:
    name: str
    url: str
    overlap: float  # share of the article's shingles found in this source (0..1)


@dataclass
class CopiedPassage:
    text: str
    source: str
    ratio: float


@dataclass
class OriginalityReport:
    originality: float                       # 0..100
    article_words: int
    compared_sources: int
    sources: list[SourceOverlap] = field(default_factory=list)
    copied: list[CopiedPassage] = field(default_factory=list)


def check_originality(article_text: str, sources: list[SourceText]) -> OriginalityReport:
    article = shingles(article_text)
    words = len(_normalise(article_text))
    usable = [s for s in sources if len(_normalise(s.text)) >= SHINGLE]
    if not article or not usable:
        return OriginalityReport(originality=100.0 if article else 0.0, article_words=words, compared_sources=len(usable))

    source_sets = [(s, shingles(s.text)) for s in usable]
    copied_any: set[tuple[str, ...]] = set()
    overlaps: list[SourceOverlap] = []
    for source, sset in source_sets:
        common = article & sset
        copied_any |= common
        overlaps.append(SourceOverlap(name=source.name, url=source.url, overlap=round(len(common) / len(article), 4)))

    passages: list[CopiedPassage] = []
    for sentence in split_sentences(article_text):
        sh = shingles(sentence)
        if not sh:
            continue
        best_ratio, best_source = 0.0, ""
        for source, sset in source_sets:
            ratio = len(sh & sset) / len(sh)
            if ratio > best_ratio:
                best_ratio, best_source = ratio, source.name
        if best_ratio >= COPIED_SENTENCE_RATIO:
            passages.append(CopiedPassage(text=sentence, source=best_source, ratio=round(best_ratio, 3)))

    originality = round(100 * (1 - len(copied_any) / len(article)), 1)
    overlaps.sort(key=lambda o: o.overlap, reverse=True)
    return OriginalityReport(originality=originality, article_words=words, compared_sources=len(usable),
                             sources=overlaps, copied=passages[:30])
