from __future__ import annotations

from app.domain.category.entities import CategoryGroup
from app.domain.ports import CategoryRepository


class ListCategories:
    def __init__(self, categories: CategoryRepository) -> None:
        self._categories = categories

    def execute(self) -> list[CategoryGroup]:
        return self._categories.list_tree()
