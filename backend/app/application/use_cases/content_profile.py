"""Read / save the content profile chosen at first-run setup."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.domain.content.profile import ContentProfile, CustomSource


class GetContentProfile:
    def __init__(self, profiles) -> None:
        self._profiles = profiles

    def execute(self) -> ContentProfile:
        return self._profiles.get()


@dataclass
class UpdateContentProfileInput:
    mode: str
    competitions: list[str]
    focuses: list[str]
    disabled_sources: list[str] = field(default_factory=list)
    custom_sources: list[dict] = field(default_factory=list)
    priority_terms: list[str] = field(default_factory=list)
    blocked_terms: list[str] = field(default_factory=list)
    updated_by: str | None = None


def _terms(values: list[str]) -> tuple[str, ...]:
    seen: list[str] = []
    for value in values:
        value = " ".join((value or "").split())
        if value and value.lower() not in (s.lower() for s in seen):
            seen.append(value)
    return tuple(seen[:50])


class UpdateContentProfile:
    """Saving the profile is what completes the first-run setup."""

    def __init__(self, profiles) -> None:
        self._profiles = profiles

    def execute(self, input: UpdateContentProfileInput) -> ContentProfile:
        profile = ContentProfile(
            mode=input.mode,
            setup_completed=True,
            competitions=tuple(dict.fromkeys(input.competitions)),
            focuses=tuple(dict.fromkeys(input.focuses)),
            disabled_sources=tuple(dict.fromkeys(input.disabled_sources)),
            custom_sources=tuple(
                CustomSource(url=s["url"].strip(), name=(s.get("name") or None), covers=tuple(s.get("covers") or ("general",)))
                for s in input.custom_sources if (s.get("url") or "").strip()
            ),
            priority_terms=_terms(input.priority_terms),
            blocked_terms=_terms(input.blocked_terms),
            updated_at=datetime.now(timezone.utc),
            updated_by=input.updated_by,
        )  # ContentProfile.__post_init__ raises ValueError on anything invalid
        self._profiles.save(profile)
        return profile
