from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.container import Container, get_container
from app.presentation.schemas import CategoryGroupOut
from app.presentation.mappers import category_group_out

router = APIRouter(prefix="/api/categories", tags=["categories"])


class CategoriesResponse(BaseModel):
    groups: list[CategoryGroupOut]


@router.get("", response_model=CategoriesResponse)
def list_categories(container: Container = Depends(get_container)) -> CategoriesResponse:
    groups = container.list_categories.execute()
    return CategoriesResponse(groups=[category_group_out(g) for g in groups])
