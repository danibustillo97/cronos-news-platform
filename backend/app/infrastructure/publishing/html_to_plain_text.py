"""Downgrades Artifact's structured HTML (already restricted to a small
whitelist -- see app.domain.artifact.validation._ALLOWED_HTML_TAGS) into
the plain-text-with-blank-line-paragraphs shape the legacy public `news`
table's `content` column actually expects (frontend/src/app/noticia/
[slug]/ArticleClient.tsx renders it as plain text split on blank lines,
never as HTML -- putting raw tags in there would show up literally to
readers). A real, documented format conversion, not a content change:
no text is invented, reordered, or summarized here.
"""
from __future__ import annotations

import html
import re

_BLOCK_OPEN = re.compile(r"<(article)[^>]*>", re.IGNORECASE)
_BLOCK_CLOSE_TO_BREAK = re.compile(r"</(p|h2|h3|li|blockquote)\s*>", re.IGNORECASE)
_LIST_ITEM_OPEN = re.compile(r"<li[^>]*>", re.IGNORECASE)
_ANY_TAG = re.compile(r"<[^>]+>")
_BLANK_RUN = re.compile(r"\n{3,}")


# Known, pre-existing limitation of the legacy public renderer (not
# something this converter can fix): frontend/.../ArticleClient.tsx's own
# processContent() drops any paragraph <= 60 chars after splitting on
# blank lines, so a short heading or list item may not actually render on
# the public page even though it is present in the stored `content`.
def html_to_plain_text(content_html: str) -> str:
    text = _BLOCK_OPEN.sub("", content_html)
    text = _LIST_ITEM_OPEN.sub("- ", text)
    text = _BLOCK_CLOSE_TO_BREAK.sub("\n\n", text)
    text = _ANY_TAG.sub("", text)
    text = html.unescape(text)
    text = _BLANK_RUN.sub("\n\n", text)
    return text.strip()
