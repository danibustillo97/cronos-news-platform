"""Real match states and the Colombia day (mirror of the frontend Live Match Engine).

- ESPN status (``status.type``) → canonical state: SCHEDULED, LIVE, HT, BREAK,
  FINISHED, POSTPONED, CANCELLED, UNKNOWN. A match is live only when the provider
  says so; a score alone never means anything.
- Days are Colombia days (America/Bogota is UTC-5 all year, no DST), never the
  server's zone nor UTC.
- ``legacy_bucket`` keeps the historical contract of /api/sports/scoreboard
  (live | finished | scheduled) so existing consumers keep working; postponed and
  cancelled matches get their own bucket instead of pretending to be finished.
Pure: no I/O.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

BOGOTA = timezone(timedelta(hours=-5), "America/Bogota")
ACTIVE = {"LIVE", "HT", "BREAK"}

_NAME_MAP = {
    "STATUS_SCHEDULED": "SCHEDULED", "STATUS_TBD": "SCHEDULED", "STATUS_DELAYED": "SCHEDULED",
    "STATUS_IN_PROGRESS": "LIVE", "STATUS_FIRST_HALF": "LIVE", "STATUS_SECOND_HALF": "LIVE", "STATUS_OVERTIME": "LIVE",
    "STATUS_EXTRA_TIME": "LIVE", "STATUS_FIRST_HALF_EXTRA_TIME": "LIVE", "STATUS_SECOND_HALF_EXTRA_TIME": "LIVE", "STATUS_SHOOTOUT": "LIVE",
    "STATUS_HALFTIME": "HT",
    "STATUS_END_PERIOD": "BREAK", "STATUS_HALFTIME_ET": "BREAK", "STATUS_END_OF_EXTRATIME": "BREAK", "STATUS_END_OF_REGULATION": "BREAK",
    "STATUS_SUSPENDED": "BREAK", "STATUS_RAIN_DELAY": "BREAK",
    "STATUS_FULL_TIME": "FINISHED", "STATUS_FINAL": "FINISHED", "STATUS_FINAL_AET": "FINISHED", "STATUS_FINAL_PEN": "FINISHED", "STATUS_FINAL_ET": "FINISHED",
    "STATUS_POSTPONED": "POSTPONED",
    "STATUS_CANCELED": "CANCELLED", "STATUS_CANCELLED": "CANCELLED", "STATUS_ABANDONED": "CANCELLED", "STATUS_FORFEIT": "CANCELLED",
}


def normalize_status(status_type: dict | None) -> str:
    """ESPN ``status.type`` → canonical state."""
    if not status_type:
        return "UNKNOWN"
    name = str(status_type.get("name") or "").upper()
    if name in _NAME_MAP:
        return _NAME_MAP[name]
    text = " ".join(str(status_type.get(k) or "") for k in ("description", "detail", "shortDetail")).lower()
    if "postpon" in text or "aplaz" in text:
        return "POSTPONED"
    if "cancel" in text or "abandon" in text:
        return "CANCELLED"
    if "halftime" in text or "half time" in text or "descanso" in text:
        return "HT"
    state = status_type.get("state")
    if state == "in":
        return "LIVE"
    if state == "post" and status_type.get("completed"):
        return "FINISHED"
    if state == "pre":
        return "SCHEDULED"
    return "UNKNOWN"


def legacy_bucket(state: str) -> str:
    """Historical ``status`` of /api/sports/scoreboard (half-time and pauses belong to the live round)."""
    if state in ACTIVE:
        return "live"
    if state == "FINISHED":
        return "finished"
    if state == "SCHEDULED":
        return "scheduled"
    return state.lower()  # postponed | cancelled | unknown — never shown as finished or live


def bogota_day(iso: str | None) -> date | None:
    """Colombia calendar day of an ISO instant (ESPN uses '2026-11-27T01:40Z')."""
    if not iso:
        return None
    try:
        at = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    return at.astimezone(BOGOTA).date()


def bogota_today(now: datetime | None = None) -> date:
    return (now or datetime.now(timezone.utc)).astimezone(BOGOTA).date()


def espn_dates(today: date) -> list[str]:
    """Provider days to query: ESPN groups by its own (US Eastern) day, so yesterday is read too and filtered here."""
    return [(today - timedelta(days=1)).strftime("%Y%m%d"), today.strftime("%Y%m%d")]


def belongs_to_today(state: str, kickoff_iso: str | None, today: date) -> bool:
    """Today's matches in Colombia, plus a match still being played that kicked off before midnight."""
    day = bogota_day(kickoff_iso)
    if day == today:
        return True
    return state in ACTIVE and day is not None and day == today - timedelta(days=1)
