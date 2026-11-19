from __future__ import annotations

from app.domain.category.entities import CategoryGroup, Category, Topic
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseCategoryRepository:
    def __init__(self, client) -> None:
        self._client = client

    def list_tree(self) -> list[CategoryGroup]:
        try:
            groups = self._client.table("category_groups").select("*").order("sort_order").execute().data or []
            categories = self._client.table("categories").select("*").order("sort_order").execute().data or []
            topics = self._client.table("topics").select("*").order("name").execute().data or []
        except Exception as exc:
            raise_if_schema_missing(exc, "category_groups")
            raise

        topics_by_category: dict[str, list[Topic]] = {}
        for t in topics:
            topics_by_category.setdefault(t["category_id"], []).append(
                Topic(id=t["id"], category_id=t["category_id"], name=t["name"], slug=t["slug"])
            )

        categories_by_group: dict[str, list[Category]] = {}
        for c in categories:
            categories_by_group.setdefault(c["group_id"], []).append(
                Category(
                    id=c["id"], group_id=c["group_id"], name=c["name"], slug=c["slug"],
                    sort_order=c["sort_order"], active=c["active"], topics=topics_by_category.get(c["id"], []),
                )
            )

        return [
            CategoryGroup(
                id=g["id"], name=g["name"], slug=g["slug"], sort_order=g["sort_order"], active=g["active"],
                categories=categories_by_group.get(g["id"], []),
            )
            for g in groups
        ]
