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

from app.domain.artifact.entities import ArtifactGenerationRequest, ClaimResolutionRequest, SeoFixRequest

_MAX_SOURCES = 6
_MAX_CHARS_PER_SOURCE = 8000

_RESPONSE_SCHEMA = """{
  "title": string,
  "subtitle": string or null,
  "excerpt": string,
  "summary": string,
  "content_html": string,  // must be "<article>...</article>". Allowed inner tags: p, h2, h3, ul, ol, li, blockquote, strong, em, a, and, ONLY for a BODY_IMAGE placement, an empty "<figure data-placeholder-id=\\"SAME_ID_AS_IN_media_requirements\\"></figure>" marker at the exact paragraph position that image belongs -- never put an <img>, text, or a <figcaption> inside it (the real image/caption live in media_requirements, never duplicated here). Never place a marker for a FEATURE_IMAGE inside content_html -- the feature image is never part of the body.
  "category_name": string or null,  // MUST be exactly one of the provided available category names, or null if none genuinely fits
  "tags": [string],
  "entities": [string],  // people, organizations, places actually named in the sources
  "seo_title": string,   // <= 60 chars
  "seo_description": string,  // 50-160 chars
  "slug": string,  // lowercase, hyphens only, no accents/spaces/special chars
  "claims": [
    { "text": string, "label": "SOURCE_FACT" | "VERIFIED_CONTEXT" | "INFERENCE" | "CREATIVE_FRAMING" | "UNVERIFIED" | "SOURCE_AVAILABILITY_CLAIM", "source_urls": [string] }
  ],
  "media_requirements": [
    {
      "placeholder_id": string,  // for BODY_IMAGE use "body_image_1", "body_image_2", ... in the order they appear in content_html
      "kind": "FEATURE_IMAGE" | "BODY_IMAGE" | "VIDEO",
      "prompt": string,  // the image-generation instruction. For BODY_IMAGE this MUST describe the specific scene/moment/entity from the paragraphs immediately around where you placed its marker -- never a generic photo of the overall topic.
      "caption": string or null,  // BODY_IMAGE: a real, reader-facing sentence describing what the image shows (never the same text as prompt). FEATURE_IMAGE: null is fine.
      "alt_text": string or null  // BODY_IMAGE: real accessibility description of the image. FEATURE_IMAGE: a short accessibility description.
    }
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
16. Determine what multimedia this article genuinely needs: exactly one FEATURE_IMAGE, plus a BODY_IMAGE for every place in the article where a real image would genuinely help the reader (a distinct scene, entity, or moment -- never one per paragraph just to fill space, and never zero for a long, multi-section article either).
17. For each BODY_IMAGE, decide its exact position in the article -- immediately after the paragraph or heading whose specific moment/scene/entity it illustrates -- and place a real "<figure data-placeholder-id=\"body_image_N\"></figure>" marker there in content_html (see schema below). This IS the article's real composition, not an afterthought: an editor opening this article in review must already see the images placed where you intended them, never having to insert them by hand.
18. Write each BODY_IMAGE's generation prompt from the actual paragraphs around its marker -- the specific scene/entity/moment that section describes -- never a generic photo of the article's overall topic. Write its caption (a real sentence for the reader, describing what the image shows) and its alt_text (real accessibility description) -- three genuinely different pieces of text, never the same string reused.
19. Validate internal consistency (dates, names, numbers) across your own draft.
20. Produce content_html as clean, standard HTML per the schema below -- no inline styles, no divs, no custom markup.
21. Attach a claims list: every material assertion in your article must appear once, labeled honestly by evidence strength.
22. Never invent a fact, quote, statistic, date, name, or event that isn't in the sources above.

HARD RULES:
- Do not copy sentences from any source. Do not do a word-substitution paraphrase of a single source.
- Do not invent anything not present in the sources. If something is unclear or unconfirmed, label the related claim UNVERIFIED -- do not silently present it as fact.
- Every BODY_IMAGE you declare in media_requirements MUST have exactly one matching "<figure data-placeholder-id=\"...\">" marker in content_html with the SAME placeholder_id, and vice versa -- never declare one without the other. The FEATURE_IMAGE's placeholder_id must never appear inside content_html; it stays outside the body, always.
- A BODY_IMAGE's prompt/caption/alt_text must never be interchangeable copies of each other -- the prompt is a generation instruction (never shown to readers), the caption is reader-facing, the alt_text is accessibility text.
- UNVERIFIED vs SOURCE_AVAILABILITY_CLAIM -- these are different real things, never conflate them:
  - UNVERIFIED: an assertion you are presenting AS a fact in the article, but you could not confirm it against the sources (e.g. a specific number or quote you're not fully sure of). This genuinely needs a human or further research before it should be trusted.
  - SOURCE_AVAILABILITY_CLAIM: a claim that HONESTLY states the sources do not specify/mention something (e.g. "the exact date of the deciding match isn't given in the available reporting"). This is not an unconfirmed fact -- it is an already-accurate statement about what the sources do or don't say, and needs no further verification. If your claim's own text is describing an absence of information rather than asserting new information, label it SOURCE_AVAILABILITY_CLAIM, never UNVERIFIED.
- If sources genuinely conflict on a material fact, say so in the article itself (attribute each version to its source) and label that claim CREATIVE_FRAMING or UNVERIFIED as appropriate -- never pick one version and hide the conflict.
- Preserve source attribution in your own reasoning (claims[].source_urls) -- this is not optional.
- Respond with ONLY a single JSON object matching this exact schema, no prose before or after it:

{_RESPONSE_SCHEMA}
"""


_SEO_FIX_RESPONSE_SCHEMA = """{
  "value": string,
  "reason": string
}"""

_FIELD_DESCRIPTION = {
    "title": "the article's editorial title (the real headline shown to readers, not the SEO meta title)",
    "seo_title": "the SEO meta title (what search engines show as the clickable result title)",
    "seo_description": "the SEO meta description (the snippet search engines show under the title)",
}


def build_seo_fix_prompt(request: SeoFixRequest) -> str:
    """Section 5's real "Corregir con IA" -- a narrow, single-field fix,
    never a re-generation. Grounded in the artifact's own real headline/
    excerpt so the proposal can't drift into a different story; the exact
    real length bounds (see app/domain/artifact/validation.py's
    TITLE_MAX/SEO_TITLE_MAX/SEO_DESCRIPTION_MIN/MAX, passed in here as
    min_length/max_length) are the same ones validate_artifact enforces,
    never a second, possibly-inconsistent copy."""
    field_desc = _FIELD_DESCRIPTION.get(request.field, request.field)
    length_rule = (
        f"between {request.min_length} and {request.max_length} characters"
        if request.min_length is not None
        else f"at most {request.max_length} characters"
    )
    purpose = (
        f"a human editor asked for a real alternative with this specific angle: {request.instruction}"
        if request.instruction
        else "this field failed a real length guideline"
    )
    task_line = (
        f"- Rewrite this field with the requested angle above, while still fitting {length_rule}."
        if request.instruction
        else f"- Rewrite ONLY this field so it fits {length_rule}."
    )
    return f"""You are helping a human editor at NEXUS produce a real alternative for ONE SEO/editorial field -- {purpose}. This is a targeted rewrite of one field, never a rewrite of the article.

FIELD: {field_desc}
CURRENT VALUE ({len(request.current_text)} chars, must be {length_rule}):
"{request.current_text}"

ARTICLE HEADLINE (for context -- do not change the story, only reword this one field):
{request.story_headline}

ARTICLE EXCERPT (for context):
{request.excerpt}

TASK:
{task_line}
- Never invent a new fact, name, number, or claim not already present in the current value/headline/excerpt above -- a different editorial angle or framing is fine when requested, fabricated content is not.
- Do not simply truncate the current text; write a genuinely different, complete real sentence.
- Respond with ONLY a single JSON object matching this exact schema, no prose before or after it:

{_SEO_FIX_RESPONSE_SCHEMA}
"""


_CLAIM_RESOLUTION_RESPONSE_SCHEMA = """{
  "label": "SOURCE_FACT" | "VERIFIED_CONTEXT" | "INFERENCE" | "CREATIVE_FRAMING" | "UNVERIFIED" | "SOURCE_AVAILABILITY_CLAIM",
  "reason": string,
  "supported_by_source": boolean
}"""

_MAX_SOURCE_TEXT_CHARS = 8000


def build_claim_resolution_prompt(request: ClaimResolutionRequest) -> str:
    """Revisión 2.0 section 2/4's real "Resolver con IA" for a claim --
    re-examines it against the SAME real source text Artifact generated
    from (never a new web search -- no such real infrastructure exists
    here, and this task explicitly forbids inventing one)."""
    return f"""You are helping a human editor at NEXUS re-examine ONE specific claim from an article against the real source material it was generated from. This is a targeted re-check, not a rewrite.

ARTICLE HEADLINE (for context): {request.story_headline}

THE CLAIM TO RE-EXAMINE:
"{request.claim_text}"

THE REAL SOURCE TEXT (the only material you may use to judge this claim):
{request.source_text[:_MAX_SOURCE_TEXT_CHARS]}

TASK -- determine the honest, correct classification for this claim:
- SOURCE_FACT: the source text literally states this.
- VERIFIED_CONTEXT: confirmed by the source text as real context (not the main fact, but genuinely supported).
- INFERENCE: a reasoned conclusion from what the source text says, not a new fact.
- CREATIVE_FRAMING: an editorial/narrative choice, not a factual claim.
- SOURCE_AVAILABILITY_CLAIM: the claim itself is honestly stating that the source text does NOT specify/mention something (e.g. "the exact date isn't given"). This is not an unconfirmed fact -- it's an accurate statement about what the source does or doesn't say.
- UNVERIFIED: the claim presents something as fact, but the source text does not actually support it, and you cannot otherwise confirm it.

HARD RULES:
- Do not invent support that isn't really in the source text above. Setting "supported_by_source": true when the text doesn't actually contain that information would be fabricating evidence -- never do this.
- If genuinely unsure whether the source supports it, keep it UNVERIFIED with "supported_by_source": false -- an honest "still needs a human" is always better than a fabricated confirmation.
- Respond with ONLY a single JSON object matching this exact schema, no prose before or after it:

{_CLAIM_RESOLUTION_RESPONSE_SCHEMA}
"""
