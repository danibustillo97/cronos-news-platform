"""Branded id value objects shared across bounded contexts.

Pure domain code: no framework, no I/O, no external package imports.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class EntityId:
    value: str

    def __post_init__(self) -> None:
        if not self.value or not isinstance(self.value, str):
            raise ValueError(f"{type(self).__name__} requires a non-empty string value")

    def __str__(self) -> str:
        return self.value

    @classmethod
    def new(cls) -> "EntityId":
        return cls(str(uuid.uuid4()))

    @classmethod
    def of(cls, value: str) -> "EntityId":
        return cls(value)


class NewsId(EntityId):
    pass


class StoryId(EntityId):
    """Story ids are natural keys (often LAB's own story_id, e.g. an
    ingested news row's id) — not always a freshly generated uuid."""


class ProductionId(EntityId):
    pass


class CompositionId(EntityId):
    pass


class AssetId(EntityId):
    pass


class DistributionPlanId(EntityId):
    pass
