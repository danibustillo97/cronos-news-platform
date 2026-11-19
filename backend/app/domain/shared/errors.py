"""Domain-level errors. No framework/HTTP concepts here — presentation maps
these to HTTP responses."""
from __future__ import annotations


class DomainError(Exception):
    """Base class for errors raised by entities enforcing their own invariants."""


class InvalidStateTransition(DomainError):
    def __init__(self, entity: str, current: str, attempted: str) -> None:
        super().__init__(f"{entity} cannot go from {current} to {attempted}")
        self.entity = entity
        self.current = current
        self.attempted = attempted


class NotFoundError(Exception):
    """Raised by application use cases when a required aggregate is missing."""

    def __init__(self, entity: str, entity_id: str) -> None:
        super().__init__(f"{entity} {entity_id} not found")
        self.entity = entity
        self.entity_id = entity_id


class CapabilityUnavailableError(Exception):
    """Raised by a LAB capability port adapter when that capability has not
    produced a result for this story yet — never invented, always explicit.

    `reason` distinguishes two genuinely different situations (never
    collapsed into one generic message):
      - "item_not_found": the LAB workspace item itself has no trace
        anywhere yet (no story_intelligence rows, no export) — the
        production hasn't really started, or is stuck earlier upstream.
      - "artifact_not_ready": the item exists and IS producing things,
        just not this particular capability's artifact yet.
    """

    def __init__(self, capability: str, story_id: str, reason: str = "artifact_not_ready") -> None:
        message = (
            f"LAB workspace item not found for {capability} (lab_item_id={story_id})"
            if reason == "item_not_found" else
            f"LAB execution has not produced the {capability} artifact yet (lab_item_id={story_id})"
        )
        super().__init__(message)
        self.capability = capability
        self.story_id = story_id
        self.reason = reason


class QuickReelNotEligible(Exception):
    """Raised by the QuickReel use case (P8) -- a deterministic, rules-only
    eligibility gate, no AI reasoning involved. `reason` distinguishes
    genuinely different situations, never collapsed into one message:
      - "story_not_ready": the owning Story hasn't reached PRODUCED yet
        (see CRONOS - Domain Language Alignment's READY mapping).
      - "composition_not_approved": the Composition itself isn't APPROVED
        (that same mapping's "para una pieza concreta" clause).
      - "no_includable_shots": every shot is EXCLUDED_NO_ASSET /
        BLOCKED_NOT_RENDERED -- there is nothing existing to assemble, and
        Quick Reel never fabricates a shot to fill the gap.
    """

    def __init__(self, composition_id: str, reason: str) -> None:
        super().__init__(f"Composition {composition_id} is not eligible for Quick Reel ({reason})")
        self.composition_id = composition_id
        self.reason = reason


class SchemaNotProvisionedError(Exception):
    """Raised by a Supabase repository when its required table is missing."""

    def __init__(self, relation: str) -> None:
        setup = (
            "Run supabase_setup/cronos_platform_schema.sql first, then "
            "supabase_setup/discovery_schema.sql"
            if relation in {"discovery_items", "discovery_jobs"}
            else "Run supabase_setup/artifact_schema.sql"
            if relation in {"artifacts", "artifact_jobs"}
            else "Run supabase_setup/cronos_platform_schema.sql"
        )
        super().__init__(
            f'Table "{relation}" does not exist yet — {setup}'
        )
        self.relation = relation


class RowLevelSecurityError(Exception):
    """The schema IS provisioned — a write was rejected by RLS. This is a
    credentials problem (anon key writing where the policy requires role
    'authenticated'), never a missing-table problem — do not confuse the two."""

    def __init__(self, relation: str) -> None:
        super().__init__(
            f'Row-level security blocked a write to "{relation}" — the backend needs '
            f"SUPABASE_SERVICE_ROLE_KEY set as a local env var (see backend/.env), not the anon key"
        )
        self.relation = relation


class SupabaseAuthenticationError(Exception):
    """Supabase itself rejected the API key/JWT used for this request —
    distinct from RLS (which accepts the credentials but denies the
    operation) and from a missing table."""

    def __init__(self, relation: str) -> None:
        super().__init__(
            f'Supabase rejected the credentials used for "{relation}" — check '
            f"SUPABASE_URL/SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY"
        )
        self.relation = relation


class DatabaseUnavailableError(Exception):
    """Could not reach Supabase at all (network/connection failure) —
    distinct from every error above, which all require a response FROM
    Supabase to classify."""

    def __init__(self, relation: str) -> None:
        super().__init__(f'Could not reach Supabase for "{relation}" — network/connection issue')
        self.relation = relation
