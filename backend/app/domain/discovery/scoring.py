"""Real, documented, deterministic score computations -- see
DiscoveryScores' own docstring in entities.py for which fields these are
and which are always None (relevance/impact/source_quality -- no real
algorithm exists for those yet, and this module does not fabricate one).
Every formula here is fully determined by real inputs already captured by
ingestion (timestamps, field presence, material count), reproducible,
never a magic number tuned to "look right".
"""
from __future__ import annotations

from datetime import datetime

# Linear decay to 0 over 24h -- a real editorial cycle window (matches
# the "últimas 24 horas" option in Discovery's own time-range filter),
# not an arbitrary constant. Documented here, not hidden in a config file
# nobody reads.
FRESHNESS_WINDOW_HOURS = 24.0


def compute_freshness_score(published_at: datetime | None, discovered_at: datetime) -> float | None:
    """1.0 at age=0, decaying linearly to 0.0 at age >= FRESHNESS_WINDOW_HOURS.
    None if published_at is unknown -- freshness is never assumed to be
    "just now" for an item whose real publish time wasn't captured."""
    if published_at is None:
        return None
    age_hours = (discovered_at - published_at).total_seconds() / 3600.0
    age_hours = max(0.0, age_hours)
    return max(0.0, 1.0 - age_hours / FRESHNESS_WINDOW_HOURS)


def compute_completeness_score(
    *, has_title: bool, has_content: bool, has_image: bool, has_published_at: bool, has_author: bool,
) -> float:
    """Fraction of the five fields Discovery cares about that are
    actually present -- real field-presence check, not a quality
    judgment (a present-but-thin content field still counts as present)."""
    fields = [has_title, has_content, has_image, has_published_at, has_author]
    return sum(1 for f in fields if f) / len(fields)


def compute_material_score(material_count: int) -> float:
    """1.0 if at least one material reference exists, else 0.0 -- presence
    only, never a quality judgment (no vision model or human review has
    looked at the material yet)."""
    return 1.0 if material_count > 0 else 0.0
