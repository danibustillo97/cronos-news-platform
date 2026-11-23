"""
Packager real -- primer módulo de Export que copia archivos de verdad y
materializa el paquete. Toma export_manifest.json (planner, sin cambios en
su lógica) y copia cada elemento PRESENT a su `package_relative_path`
dentro de `lab/workspace/exports/<story_id>/` -- nunca genera, regenera ni
modifica ningún archivo, solo copia bytes ya reales (`shutil.copy2`).

Solo se ejecuta si el manifest está en READY_FOR_REVIEW -- nunca salta la
revisión humana (ver docs/LAB_EXPORT_FORMAT.md). Re-valida justo antes de
copiar (defensa en profundidad: detecta si algo cambió entre el review y
el execute) y re-verifica cada copia contra su checksum declarado después
de copiar -- si algo no coincide, el export queda FAILED, nunca a medias
sin reportarlo.
"""

import json
import shutil
from pathlib import Path
from typing import Any
from datetime import datetime, timezone

from lab.core.job import register_job_type
from lab.core.logging_setup import get_logger
from lab.core.paths import LAB_ROOT
from lab.export.paths import export_dir, export_manifest_path
from lab.export.planner import _package_checksums, _sha256_file, load as load_manifest, validate_export_manifest

logger = get_logger(__name__)


def _entries_to_copy(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    entries = [e for e in manifest["artifacts"].values() if e["availability"] == "PRESENT"]
    entries += [e for e in manifest["assets"] if e["availability"] == "PRESENT"]
    entries += [e for e in manifest["renders"] if e["availability"] == "PRESENT"]
    if manifest["final_reel"]["availability"] == "PRESENT":
        entries.append(manifest["final_reel"])
    return entries


def process_export(story_id: str) -> dict[str, Any]:
    """Copia de verdad todo lo PRESENT de export_manifest.json al paquete
    en disco, y marca el manifest EXPORTED. Nunca lanza -- siempre devuelve
    un dict con el resultado (EXPORTED o FAILED)."""
    manifest = load_manifest(story_id)
    if manifest is None:
        raise ValueError(f"No hay export_manifest.json para la historia {story_id!r} — correr export-plan primero")

    if manifest["status"] != "READY_FOR_REVIEW":
        error = f"export_manifest.json está en status {manifest['status']!r} — correr export-review primero (no se salta la revisión humana)"
        return {"status": "FAILED", "error": error, "files_copied": 0, "total_size_bytes": 0}

    errors = validate_export_manifest(story_id)
    if errors:
        return {"status": "FAILED", "error": "; ".join(errors), "files_copied": 0, "total_size_bytes": 0}

    pkg_root = export_dir(story_id)
    entries = _entries_to_copy(manifest)

    copied = 0
    total_size = 0
    for entry in entries:
        source = LAB_ROOT / entry["source_relative_path"]
        destination = pkg_root / entry["package_relative_path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied += 1
        total_size += destination.stat().st_size

    # Re-verificar cada copia contra el checksum declarado -- si algo no
    # coincide, el export queda FAILED explícito, nunca "a medias" en silencio.
    mismatches = []
    for package_path, expected_checksum in _package_checksums(manifest):
        copy_path = pkg_root / package_path
        if not copy_path.exists() or _sha256_file(copy_path) != expected_checksum:
            mismatches.append(package_path)

    if mismatches:
        error = f"la copia de {len(mismatches)} archivo(s) no coincide con su checksum declarado: {mismatches}"
        logger.error("Export de %s: %s", story_id, error)
        return {"status": "FAILED", "error": error, "files_copied": copied, "total_size_bytes": total_size}

    manifest["status"] = "EXPORTED"
    manifest["exported_at"] = datetime.now(timezone.utc).isoformat()
    # export_manifest_path(story_id) YA es pkg_root/"export_manifest.json"
    # -- el manifest vive en la raíz del propio paquete desde que se
    # planificó, no hace falta copiarlo a ningún otro lado.
    export_manifest_path(story_id).write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    logger.info(
        "Export de %s -> %s (%d archivos, %d bytes)", story_id, pkg_root, copied, total_size,
    )
    return {
        "status": "EXPORTED", "error": None, "files_copied": copied, "total_size_bytes": total_size,
        "package_dir": str(pkg_root.relative_to(LAB_ROOT)).replace("\\", "/"),
    }


def _job_handler(params: dict[str, Any]) -> dict[str, Any]:
    story_id = params["story_id"]
    return process_export(story_id)


register_job_type("export_execute")(_job_handler)
