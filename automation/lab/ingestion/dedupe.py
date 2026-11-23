"""
Clasificación: REBUILD, adaptando el *patrón* de `visited_urls.txt`
(docs/LAB_ARCHITECTURE_AUDIT.md sección N.2/N.3).

`main.py` deduplica con dos mecanismos: una query en vivo a Supabase
(`is_duplicate`) y un archivo plano (`visited_urls.txt`). LAB no puede
usar el primero (cero dependencia de Supabase) y no comparte el segundo
(es el historial de producción, no el de LAB). Así que LAB tiene su
propio índice local, mismo espíritu que `visited_urls.txt` (un archivo,
sin red) pero en JSON y scoped a `lab/workspace/`.
"""

import json
from pathlib import Path

from lab.core.paths import DEDUPE_INDEX_FILE, ensure_runtime_dirs


def _load() -> dict:
    if not DEDUPE_INDEX_FILE.exists():
        return {"urls": [], "slugs": [], "item_ids": {}}
    data = json.loads(DEDUPE_INDEX_FILE.read_text(encoding="utf-8"))
    # Índices creados antes de que existiera item_ids (ver ERROR 1 -- un
    # duplicate sin forma de resolver el item_id real) no lo tienen; se
    # completa vacío, nunca se asume que la relación ya estaba ahí.
    data.setdefault("item_ids", {})
    return data


def _save(index: dict) -> None:
    ensure_runtime_dirs()
    DEDUPE_INDEX_FILE.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def is_known(url: str, slug: str) -> bool:
    index = _load()
    return url in index["urls"] or slug in index["slugs"]


def find_item_id(url: str, slug: str) -> str | None:
    """El item_id real asociado a esta url/slug, si el índice lo tiene
    registrado -- None si `is_known` es True pero la asociación se perdió
    (índice de antes de este fix), nunca inventado."""
    index = _load()
    return index["item_ids"].get(url) or index["item_ids"].get(slug)


def mark_known(url: str, slug: str, item_id: str | None = None) -> None:
    index = _load()
    if url not in index["urls"]:
        index["urls"].append(url)
    if slug not in index["slugs"]:
        index["slugs"].append(slug)
    if item_id:
        index["item_ids"][url] = item_id
        index["item_ids"][slug] = item_id
    _save(index)


def count_known() -> int:
    return len(_load()["urls"])
