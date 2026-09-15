"""Prompt construction for Artifact generation -- kept separate from the
HTTP call itself (anthropic_adapter.py) so it's testable without a real
API call, and swappable if a different provider needs different prompt
shaping. The instructions here ARE the 21-step editorial process and the
NO INVENTAR discipline that used to live only in a Claude Code skill
(automation/.claude/skills/lab-editorial-*) -- see
docs/NEXUS_ARCHITECTURE_BASELINE.md for why that skill can't be the
production execution path.
"""
from __future__ import annotations

from app.domain.artifact.entities import ArtifactGenerationRequest

_MAX_SOURCES = 6
_MAX_CHARS_PER_SOURCE = 8000

_RESPONSE_SCHEMA = """{
  "title": string,
  "subtitle": string or null,
  "excerpt": string,
  "summary": string,
  "content_html": string,  // must be "<article>...</article>", only these inner tags: p, h2, h3, ul, ol, li, blockquote, strong, em, a
  "category_name": string or null,  // MUST be exactly one of the provided available category names, or null if none genuinely fits
  "tags": [string],
  "entities": [string],  // people, organizations, places actually named in the sources
  "seo_title": string,   // <= 60 chars
  "seo_description": string,  // 50-160 chars
  "slug": string,  // lowercase, hyphens only, no accents/spaces/special chars
  "claims": [
    { "text": string, "label": "SOURCE_FACT" | "VERIFIED_CONTEXT" | "INFERENCE" | "CREATIVE_FRAMING" | "UNVERIFIED", "source_urls": [string] }
  ],
  "media_requirements": [
    { "placeholder_id": string, "kind": "FEATURE_IMAGE" | "BODY_IMAGE" | "VIDEO", "prompt": string }
  ]
}"""


def build_artifact_prompt(request: ArtifactGenerationRequest) -> str:
    sources_block = "\n\n".join(
        f"--- SOURCE {i+1} ---\n"
        f"URL: {s.source_url}\n"
        f"Outlet: {s.source_name or s.source_domain}\n"
        f"Published: {s.published_at.isoformat() if s.published_at else 'unknown'}\n"
        f"Title: {s.title}\n"
        f"Content:\n{s.raw_text[:_MAX_CHARS_PER_SOURCE]}"
        for i, s in enumerate(request.sources[:_MAX_SOURCES])
    )
    categories = ", ".join(request.available_category_names) or "(none provided)"

    return f"""You are NEXUS's Artifact engine -- a professional editorial process, not a paraphrasing tool.

STORY SEED HEADLINE: {request.story_headline}

REAL SOURCES (the only material you may draw from):
{sources_block}

AVAILABLE CATEGORIES (pick category_name from this exact list, or null): {categories}

YOUR TASK -- perform the full editorial process:
1. Read every source carefully.
2. Compare sources against each other; note agreements and disagreements.
3. Identify the real facts they establish.
4. Detect any contradictions between sources.
5. Detect information that is missing or unconfirmed.
6. Identify real entities (people, organizations, places) actually named in the sources.
7. Pick the single best-fitting category from AVAILABLE CATEGORIES (or null if truly none fits).
8. Choose relevant tags/topics grounded in the actual content.
9. Determine the editorial angle -- what makes this story matter.
10. Write an original title (not a copy of any source's headline).
11. Write an original subtitle.
12. Write an excerpt and a summary.
13. Structure the article into clear paragraphs and, if long enough, sub-headings.
14. Write ORIGINAL editorial prose that synthesizes the sources -- never a mechanical paraphrase of a single source, never a copy with words swapped.
15. Write real SEO metadata (title, description, slug).
16. Determine what multimedia this article genuinely needs (at minimum a feature image).
17. List the specific assets/images needed, as media_requirements with a real, useful generation prompt for each.
18. Validate internal consistency (dates, names, numbers) across your own draft.
19. Produce content_html as clean, standard HTML per the schema below -- no inline styles, no divs, no custom markup.
20. Attach a claims list: every material assertion in your article must appear once, labeled honestly by evidence strength.
21. Never invent a fact, quote, statistic, date, name, or event that isn't in the sources above.

HARD RULES:
- Do not copy sentences from any source. Do not do a word-substitution paraphrase of a single source.
- Do not invent anything not present in the sources. If something is unclear or unconfirmed, label the related claim UNVERIFIED -- do not silently present it as fact.
- If sources genuinely conflict on a material fact, say so in the article itself (attribute each version to its source) and label that claim CREATIVE_FRAMING or UNVERIFIED as appropriate -- never pick one version and hide the conflict.
- Preserve source attribution in your own reasoning (claims[].source_urls) -- this is not optional.
- Respond with ONLY a single JSON object matching this exact schema, no prose before or after it:

{_RESPONSE_SCHEMA}
"""
