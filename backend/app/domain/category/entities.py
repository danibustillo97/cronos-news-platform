"""CATEGORY — classification tree. Replaces any hardcoded category list in
the frontend; this is the source of truth."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Topic:
    id: str
    category_id: str
    name: str
    slug: str


@dataclass(frozen=True)
class Category:
    id: str
    group_id: str
    name: str
    slug: str
    sort_order: int
    active: bool
    topics: list[Topic] = field(default_factory=list)


@dataclass(frozen=True)
class CategoryGroup:
    id: str
    name: str
    slug: str
    sort_order: int
    active: bool
    categories: list[Category] = field(default_factory=list)
