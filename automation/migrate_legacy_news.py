"""Migración única: borradores de la antigua pestaña "Noticias" -> tablero editorial.

La pestaña "Noticias" escribía directo en `news`. Ahora todo el trabajo vive
en el tablero (artifacts). Este script crea un borrador del tablero por cada
fila de `news` en estado draft que todavía no tiene artifact_id, y enlaza la
fila (`news.artifact_id`). Al publicar ese borrador, el publicador actualiza
ESA misma fila (upsert por artifact_id): no se duplican noticias.

Seguro por diseño:
  * Sin --apply solo muestra qué haría (no escribe nada).
  * Idempotente: los ids son deterministas y las filas ya enlazadas se saltan.
  * No borra ni modifica el contenido de `news`; solo completa artifact_id.

Requiere la migración 20261123_editorial_pipeline.sql (columna news.artifact_id)
y SUPABASE_SERVICE_ROLE_KEY.

  python automation/migrate_legacy_news.py           # simulación
  python automation/migrate_legacy_news.py --apply   # ejecutar
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.application.use_cases.editorial_board import CreateArticleInput, match_category  # noqa: E402


def legacy_input(row: dict, groups) -> CreateArticleInput:
    tags = row.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    return CreateArticleInput(
        title=row.get("title") or "(sin título)",
        content=row.get("content") or "",
        excerpt=row.get("excerpt") or row.get("summary"),
        category_id=match_category(row.get("category"), groups),
        image_url=row.get("image_url"),
        source_url=row.get("source_url"),
        source_name=row.get("source"),
        tags=list(tags),
        slug=row.get("slug"),
        story_label="legacy-news",
        legacy_news_id=str(row["id"]),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="escribe de verdad (sin esto, solo simula)")
    args = parser.parse_args()

    from app.container import get_container

    container = get_container()
    client = container.news_repo._client  # same service-role client the backend uses
    try:
        rows = (client.table("news").select("*").eq("status", "draft").is_("artifact_id", "null")
                .order("created_at").execute().data or [])
    except Exception as exc:  # noqa: BLE001
        print(f"No se pudo leer news ({type(exc).__name__}). ¿Se aplicó la migración 20261123? {exc}", file=sys.stderr)
        return 1

    groups = container.category_repo.list_tree()
    plan = [legacy_input(row, groups) for row in rows]
    summary = {
        "borradores_a_migrar": len(plan),
        "con_categoria_reconocida": sum(1 for p in plan if p.category_id),
        "con_imagen": sum(1 for p in plan if p.image_url),
        "modo": "EJECUCIÓN" if args.apply else "SIMULACIÓN (agrega --apply para ejecutar)",
    }
    if not args.apply:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0

    migrated, failed = 0, []
    for row, item in zip(rows, plan):
        try:
            artifact = container.create_article.execute(item)
            client.table("news").update({"artifact_id": str(artifact.id)}).eq("id", row["id"]).execute()
            migrated += 1
        except Exception as exc:  # noqa: BLE001 -- one bad row never stops the rest
            failed.append({"news_id": str(row["id"]), "error": f"{type(exc).__name__}: {str(exc)[:160]}"})
    summary.update({"migrados": migrated, "fallidos": failed})
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
