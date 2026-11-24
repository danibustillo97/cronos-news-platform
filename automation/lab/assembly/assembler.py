"""
Assembler real -- primer modulo de Assembly que ejecuta FFmpeg de verdad y
produce el video final. Toma assembly_plan.json (planner, sin cambios en
su logica) y concatena con el demuxer `concat` de FFmpeg los clips YA
renderizados (videos/rendered/*.mp4, Fase 4.2.5) de los shots INCLUDED --
nunca vuelve a calcular geometria ni filtros ni motion: esa ejecucion ya la
hizo lab/render/renderer.py, y no se duplica aca (mismo criterio de
"no dupliques logica de FFmpeg" del diseno). Sin audio -- audio_plan.json
solo se referencia (assembly_plan.json.audio_plan_id), nunca se mezcla en
esta etapa.

Si no hay ningun shot INCLUDED, no se llama a FFmpeg -- no existe nada real
que ensamblar, y "un video vacio" seria fabricar contenido. El resultado
queda FAILED con un motivo explicito, nunca un archivo ficticio.

A diferencia de planner.py (puro, sin I/O de procesos, sin cambios en esta
etapa), este modulo SI reescribe assembly_plan.json tras ejecutar -- mismo
patron que lab/render/renderer.py con render_plan.json: el campo `output`
queda con status DONE + relative_path + metadata real de ffprobe, o FAILED
+ error (stderr de FFmpeg o motivo).
"""

import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Optional

from lab.assembly.paths import assembly_plan_path, final_reel_path
from lab.assembly.planner import load as load_assembly_plan
from lab.config import settings
from lab.core.job import register_job_type
from lab.core.logging_setup import get_logger
from lab.media.paths import story_media_dir

logger = get_logger(__name__)

_FFMPEG_TIMEOUT_SECONDS = 120
_MIN_REASONABLE_DURATION_SECONDS = 0.1


def _write_concat_list(paths: list[Path]) -> Path:
    """Archivo temporal en formato del demuxer `concat` de FFmpeg -- una
    línea `file '<path absoluto>'` por clip, en el orden ya decidido por
    assembly_plan.json (orden de aparición en `shots`, ya filtrado a
    INCLUDED). Comillas simples escapadas defensivamente."""
    fd, list_path = tempfile.mkstemp(prefix="lab_assembly_concat_", suffix=".txt")
    with open(fd, "w", encoding="utf-8") as f:
        for path in paths:
            escaped = str(path).replace("'", "'\\''")
            f.write(f"file '{escaped}'\n")
    return Path(list_path)


def _probe_output(path: Path) -> dict[str, Any]:
    """ffprobe real sobre el archivo ya escrito -- nunca inventa estos
    datos, los lee del archivo físico. Devuelve None-safe: si ffprobe
    falla o el stream de video no está, los campos quedan None y
    process_assembly_plan() lo trata como validación fallida."""
    command = [
        settings.FFPROBE_BINARY, "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,r_frame_rate",
        "-show_entries", "format=duration,size",
        "-of", "json",
        str(path),
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=_FFMPEG_TIMEOUT_SECONDS)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return {"error": f"ffprobe no pudo inspeccionar el output: {exc}"}

    if result.returncode != 0:
        return {"error": f"ffprobe terminó con error: {result.stderr[-1000:]}"}

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"error": "ffprobe no devolvió JSON válido"}

    streams = data.get("streams") or []
    fmt = data.get("format") or {}
    if not streams:
        return {"error": "el output no tiene ningún stream de video"}

    stream = streams[0]
    fps: Optional[float] = None
    r_frame_rate = stream.get("r_frame_rate")
    if r_frame_rate and "/" in r_frame_rate:
        num, _, den = r_frame_rate.partition("/")
        try:
            den_f = float(den)
            fps = round(float(num) / den_f, 3) if den_f else None
        except ValueError:
            fps = None

    try:
        duration_seconds = float(fmt["duration"]) if "duration" in fmt else None
    except (TypeError, ValueError):
        duration_seconds = None

    return {
        "codec_name": stream.get("codec_name"),
        "width": stream.get("width"),
        "height": stream.get("height"),
        "fps": fps,
        "duration_seconds": duration_seconds,
        "size_bytes": int(fmt["size"]) if fmt.get("size") else None,
    }


def process_assembly_plan(story_id: str) -> dict[str, Any]:
    """Concatena con FFmpeg real los shots INCLUDED de assembly_plan.json
    (Etapa de planificación, sin cambios en su lógica) y reescribe
    assembly_plan.json con el resultado real de `output`. Nunca lanza --
    siempre devuelve un dict con el resultado (DONE o FAILED)."""
    plan = load_assembly_plan(story_id)
    if plan is None:
        raise ValueError(f"No hay assembly_plan.json para la historia {story_id!r} — correr assembly-plan primero")

    included_shots = [s for s in plan["shots"] if s["disposition"] == "INCLUDED"]

    if not included_shots:
        outcome = {"status": "FAILED", "error": "no hay ningún shot INCLUDED en assembly_plan.json — nada real que ensamblar", "probe": None}
        plan["output"] = {"status": "FAILED", "relative_path": None, "error": outcome["error"]}
        assembly_plan_path(story_id).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.warning("Assembly de %s sin shots INCLUDED — no se llamó a FFmpeg", story_id)
        return outcome

    story_dir = story_media_dir(story_id)
    source_paths = [story_dir / s["source_video_path"] for s in included_shots]

    missing = [p for p in source_paths if not p.exists()]
    if missing:
        error = f"faltan {len(missing)} clip(s) declarados como INCLUDED en disco: {[str(p) for p in missing]}"
        plan["output"] = {"status": "FAILED", "relative_path": None, "error": error}
        assembly_plan_path(story_id).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.error("Assembly de %s: %s", story_id, error)
        return {"status": "FAILED", "error": error, "probe": None}

    output_path = final_reel_path(story_id)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    concat_list_path = _write_concat_list(source_paths)
    try:
        command = [
            settings.FFMPEG_BINARY, "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_list_path),
            "-c", "copy",
            str(output_path),
        ]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=_FFMPEG_TIMEOUT_SECONDS)
        except FileNotFoundError:
            error = f"FFmpeg no encontrado (binario: {settings.FFMPEG_BINARY!r})"
            plan["output"] = {"status": "FAILED", "relative_path": None, "error": error}
            assembly_plan_path(story_id).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
            return {"status": "FAILED", "error": error, "probe": None}
        except subprocess.TimeoutExpired:
            error = f"FFmpeg excedió el timeout de {_FFMPEG_TIMEOUT_SECONDS}s"
            plan["output"] = {"status": "FAILED", "relative_path": None, "error": error}
            assembly_plan_path(story_id).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
            return {"status": "FAILED", "error": error, "probe": None}
    finally:
        concat_list_path.unlink(missing_ok=True)

    if result.returncode != 0:
        error = result.stderr[-2000:]
        plan["output"] = {"status": "FAILED", "relative_path": None, "error": error}
        assembly_plan_path(story_id).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.error("Assembly de %s: FFmpeg falló: %s", story_id, error)
        return {"status": "FAILED", "error": error, "probe": None}

    if not output_path.exists() or output_path.stat().st_size == 0:
        error = "FFmpeg terminó OK pero no produjo un archivo de salida válido"
        plan["output"] = {"status": "FAILED", "relative_path": None, "error": error}
        assembly_plan_path(story_id).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        return {"status": "FAILED", "error": error, "probe": None}

    probe = _probe_output(output_path)
    if probe.get("error"):
        error = f"output escrito pero ffprobe lo rechazó: {probe['error']}"
        plan["output"] = {"status": "FAILED", "relative_path": None, "error": error}
        assembly_plan_path(story_id).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        return {"status": "FAILED", "error": error, "probe": probe}

    if not probe.get("duration_seconds") or probe["duration_seconds"] < _MIN_REASONABLE_DURATION_SECONDS:
        error = f"output escrito pero la duración reportada por ffprobe no es razonable: {probe.get('duration_seconds')!r}"
        plan["output"] = {"status": "FAILED", "relative_path": None, "error": error}
        assembly_plan_path(story_id).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        return {"status": "FAILED", "error": error, "probe": probe}

    relative_output = "videos/final/final_reel.mp4"
    plan["output"] = {"status": "DONE", "relative_path": relative_output, "error": None}
    assembly_plan_path(story_id).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")

    logger.info(
        "Assembly de %s -> %s (%d shots, %d bytes, %.2fs, %sx%s, %s)",
        story_id, relative_output, len(included_shots), output_path.stat().st_size,
        probe.get("duration_seconds") or 0, probe.get("width"), probe.get("height"), probe.get("codec_name"),
    )
    return {"status": "DONE", "relative_path": relative_output, "error": None, "probe": probe, "shots_included": len(included_shots)}


def _job_handler(params: dict[str, Any]) -> dict[str, Any]:
    story_id = params["story_id"]
    return process_assembly_plan(story_id)


register_job_type("assembly_execute")(_job_handler)
