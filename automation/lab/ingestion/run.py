"""
Orquesta la ingestión completa: fetch -> extract -> quality gate -> dedupe
-> guardar en workspace/incoming (estado INGESTED).

Esto es lo que corre el job `run_scraper`. Responsabilidad única:
    FUENTES -> SCRAPER -> RAW/INGESTED CONTENT -> LAB WORKSPACE
No publica, no escribe Supabase, no corre nada editorial, no decide qué
historia "vale la pena" — eso es explícitamente de fases posteriores
(docs/LAB_ARCHITECTURE_AUDIT.md, brief de corrección de arquitectura).
"""

from typing import Any

from lab.core.job import register_job_type
from lab.core.logging_setup import get_logger
from lab.core.workspace import WorkflowState, WorkspaceItem, list_items, new_item_id, save_item
from lab.ingestion import dedupe, stop_signal
from lab.ingestion.extract import extract_body, extract_image_url
from lab.ingestion.fetch import fetch_candidates
from lab.ingestion.quality import is_valid_article, is_valid_image_url
from lab.ingestion.slug import generate_slug

logger = get_logger(__name__)

DEFAULT_MAX_ITEMS = 30


def run_ingestion(
    max_sources: int | None = None, max_items: int = DEFAULT_MAX_ITEMS, job_id: str | None = None,
) -> dict[str, Any]:
    from lab.ingestion.sources import NEWS_SOURCES

    sources = NEWS_SOURCES[:max_sources] if max_sources else NEWS_SOURCES
    logger.info("Ingestión: %d fuentes, tope %d items", len(sources), max_items)

    candidates = fetch_candidates(sources)
    logger.info("Candidatos encontrados: %d", len(candidates))

    saved = 0
    saved_item_ids: list[str] = []
    skipped_duplicate = 0
    skipped_quality = 0
    errors = 0
    stopped = False

    for candidate in candidates:
        if saved >= max_items:
            break
        if job_id and stop_signal.is_stop_requested(job_id):
            logger.info("Detención solicitada para job %s -- cortando el loop, se conserva lo ya guardado", job_id)
            stopped = True
            break

        slug = generate_slug(candidate.title)
        if dedupe.is_known(candidate.url, slug):
            skipped_duplicate += 1
            continue

        try:
            content = extract_body(candidate.url)
            image_url = extract_image_url(candidate.url)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Error extrayendo %s: %s", candidate.url, exc)
            errors += 1
            continue

        if not is_valid_article(candidate.title, content) or not is_valid_image_url(image_url):
            skipped_quality += 1
            continue

        item = WorkspaceItem(
            id=new_item_id(),
            state=WorkflowState.INGESTED,
            title=candidate.title,
            source_url=candidate.url,
            source=candidate.source,
            image_url=image_url,
            content=content,
            published_at=candidate.published_at,
            extra={"slug": slug},
        )
        save_item(item)
        dedupe.mark_known(candidate.url, slug, item.id)
        saved += 1
        saved_item_ids.append(item.id)
        logger.info("Ingerido: %s | %s", item.id, item.title[:70])

    if job_id:
        stop_signal.clear_stop(job_id)

    summary = {
        "sources_visited": len(sources),
        "candidates_found": len(candidates),
        "saved": saved,
        "saved_item_ids": saved_item_ids,
        "skipped_duplicate": skipped_duplicate,
        "skipped_quality": skipped_quality,
        "errors": errors,
        "stopped": stopped,
    }
    logger.info("Ingestión terminada: %s", summary)
    return summary


@register_job_type("run_scraper")
def run_scraper_job(params: dict[str, Any]) -> dict[str, Any]:
    return run_ingestion(
        max_sources=params.get("max_sources"),
        max_items=params.get("max_items", DEFAULT_MAX_ITEMS),
        job_id=params.get("job_id"),
    )


def _find_ingested_item_id(source_url: str, slug: str) -> str | None:
    """Recuperación para índices de dedupe de antes de que existiera
    item_ids (ver ERROR 1): busca en INGESTED un item cuyo source_url o
    slug coincida. Solo cubre INGESTED (el caso real: `ingest_known_item`
    falló *después* de crear el item pero *antes* de que news/backend
    pudiera persistir Story/Production, así que el item nunca avanzó de
    estado) -- no es una búsqueda manual del usuario, la hace el código."""
    for item in list_items(WorkflowState.INGESTED):
        if item.source_url == source_url or item.extra.get("slug") == slug:
            return item.id
    return None


def ingest_known_item(
    title: str, source_url: str, content: str,
    image_url: str | None = None, source: str | None = None,
) -> dict[str, Any]:
    """Mete directo a INGESTED una noticia cuyo título/URL/cuerpo ya se
    conocen de antemano (viene de la tabla `news` de producción, vía el
    Local Runtime) — sin fetch/extract, porque la materia prima ya la
    trae quien llama. Pasa por los mismos gates de calidad y el mismo
    dedupe local que `run_ingestion`, y usa el mismo `WorkspaceItem` — no
    es un camino de ingestión paralelo, es la misma máquina de estados
    con una fuente de materia prima distinta (Supabase en vez de scraping).

    Idempotente de verdad: si esta URL ya se ingirió antes, NUNCA crea un
    segundo item -- siempre devuelve el item_id real ya existente (ver
    ERROR 1: antes devolvía item_id=None en este caso, que es el bug).
    """
    slug = generate_slug(title)
    if dedupe.is_known(source_url, slug):
        existing_id = dedupe.find_item_id(source_url, slug) or _find_ingested_item_id(source_url, slug)
        if existing_id:
            # Autocura el índice si la asociación se había perdido (item_ids
            # vacío de una corrida vieja) -- la próxima vez ya no hace falta escanear.
            dedupe.mark_known(source_url, slug, existing_id)
            logger.info("Ya ingerido, reutilizando item_id existente: %s | %s", existing_id, title[:70])
            return {"status": "existing", "item_id": existing_id}
        logger.error("URL/slug marcados como conocidos pero sin item_id resoluble: %s", source_url)
        return {"status": "duplicate_unresolvable", "item_id": None}

    if not is_valid_article(title, content):
        return {"status": "rejected_quality", "item_id": None}

    item = WorkspaceItem(
        id=new_item_id(),
        state=WorkflowState.INGESTED,
        title=title,
        source_url=source_url,
        source=source,
        image_url=image_url if is_valid_image_url(image_url) else None,
        content=content,
        extra={"slug": slug, "origin": "news_convert_to_content"},
    )
    save_item(item)
    dedupe.mark_known(source_url, slug, item.id)
    logger.info("Ingerido (known item): %s | %s", item.id, item.title[:70])
    return {"status": "ingested", "item_id": item.id}


@register_job_type("ingest_known_item")
def ingest_known_item_job(params: dict[str, Any]) -> dict[str, Any]:
    return ingest_known_item(
        title=params["title"],
        source_url=params["source_url"],
        content=params["content"],
        image_url=params.get("image_url"),
        source=params.get("source"),
    )
