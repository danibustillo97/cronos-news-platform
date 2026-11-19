"""Deterministic, keyword-based category classification -- the discovery-
side analog of automation/src/ai/classifier.py's approach, but matched
against the REAL category/topic taxonomy (app.domain.category) instead of
a fixed sports-only keyword list, and never hardcoded per the project's
own rule against hardcoding categories in application code.

No ML, no fabricated confidence score: a category/topic matches only if
its own real name appears as a substring in the item's text
(case-insensitive) -- either true or not, nothing in between to invent.
"""
from __future__ import annotations

from app.domain.category.entities import CategoryGroup


def classify(text: str, groups: list[CategoryGroup]) -> tuple[str | None, list[str]]:
    """Returns (category_id, topics). category_id comes from the first
    match found, by the taxonomy's own sort_order (the order `groups` is
    passed in) -- either the Category's own name in `text`, or (since a
    real article about "Champions League" won't usually contain the
    literal word "Fútbol") the parent Category of any matched Topic. Both
    are real hierarchy lookups, never a guess: a Topic match always has a
    real parent Category. topics are every Topic name found across all
    categories, since a real article can genuinely touch more than one.
    (None, []) means nothing matched at all -- never a guessed default."""
    lowered = text.lower()
    category_id: str | None = None
    topics: list[str] = []
    for group in groups:
        for category in group.categories:
            category_matches = category.name.lower() in lowered
            if category_matches and category_id is None:
                category_id = category.id
            for topic in category.topics:
                if topic.name.lower() in lowered:
                    topics.append(topic.name)
                    if category_id is None:
                        category_id = category.id
    return category_id, topics
