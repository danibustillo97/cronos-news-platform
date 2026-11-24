"""El ÚNICO módulo del Runtime que sabe cómo invocar LAB. Todo lo demás
(orchestrator, supabase_mirror, main) le pasa nombres de comando y un
item_id, y recibe de vuelta un resultado -- nunca conocen `subprocess`,
`lab.cli` ni el CLI de Claude Code directamente (regla del plan: "El
adapter debe saber cómo contactar al runtime local. NO debe conocer
internamente cómo funciona cada planner del LAB" -- acá, al revés,
Production no conoce subprocess/filesystem/Claude Code/FFmpeg, solo este
adapter).
"""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

LAB_ROOT = Path(__file__).resolve().parents[2]  # .../RPA_NEWS_SCRIPT
LAB_PYTHON = LAB_ROOT / "lab" / ".venv" / "Scripts" / "python.exe"

STAGE_TIMEOUT_SECONDS = 20 * 60  # generación de media / render pueden tardar


@dataclass
class StageResult:
    ok: bool
    returncode: int
    stdout: str
    stderr: str
    parsed: dict | None  # stdout parseado como JSON si el comando lo imprimió así

    def to_dict(self) -> dict:
        return {
            "ok": self.ok, "returncode": self.returncode,
            "stdout": self.stdout[-4000:], "stderr": self.stderr[-4000:],
            "parsed": self.parsed,
        }


def _run(cmd: list[str], timeout: int = STAGE_TIMEOUT_SECONDS) -> StageResult:
    # PYTHONIOENCODING fuerza que EL PROCESO HIJO (lab.cli, su propio
    # intérprete) escriba stdout/stderr en UTF-8 -- sin esto, en Windows
    # el hijo usa el codepage de la consola (cp1252) y un título real con
    # un emoji (ej. 📱) hace que su propio `print(json.dumps(...))` explote
    # con UnicodeEncodeError antes de imprimir nada. `encoding="utf-8"`
    # más abajo es del lado del padre (cómo YO decodifico sus bytes) --
    # son dos capas distintas, hacía falta la del hijo también.
    child_env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    proc = subprocess.run(
        cmd, cwd=str(LAB_ROOT), capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=timeout, env=child_env,
    )
    parsed = None
    stdout = proc.stdout.strip()
    if stdout:
        try:
            parsed = json.loads(stdout)
        except json.JSONDecodeError:
            # Los comandos de lab.cli imprimen un único JSON; si no parsea,
            # puede haber logging mezclado en stdout -- se intenta con la
            # última línea (patrón real de lab.cli: logger a stderr, print a stdout).
            last_line = stdout.splitlines()[-1] if stdout.splitlines() else ""
            try:
                parsed = json.loads(last_line)
            except json.JSONDecodeError:
                parsed = None
    ok = proc.returncode == 0 and not (isinstance(parsed, dict) and parsed.get("error"))
    return StageResult(ok=ok, returncode=proc.returncode, stdout=proc.stdout, stderr=proc.stderr, parsed=parsed)


def run_cli(command: str, *args: str, timeout: int = STAGE_TIMEOUT_SECONDS) -> StageResult:
    """Corre un subcomando determinista real de lab.cli (ingest-item,
    editorial-review, media-generate, render-execute, etc.) -- nunca un
    nombre inventado, siempre uno de los listados en `lab/cli.py`."""
    if not LAB_PYTHON.exists():
        raise RuntimeError(f"No se encontró el intérprete de LAB en {LAB_PYTHON} — ¿está creado lab/.venv?")
    return _run([str(LAB_PYTHON), "-m", "lab.cli", command, *args], timeout=timeout)


def request_discovery_stop(job_id: str) -> StageResult:
    """A real, quick command (just writes a marker file) -- never kills
    the run-scraper subprocess that might still be running for this job."""
    return run_cli("discovery-request-stop", job_id, timeout=10)


def generate_article_image(
    story_id: str, placeholder_id: str, prompt: str, aspect_ratio: str, provider: str | None = None,
) -> StageResult:
    """Genera UNA imagen real para un Artifact (NEXUS backend) fuera del
    pipeline de escenas de video -- ver lab/media/standalone.py. Un
    llamado real a Gemini/Cloudflare toma unos segundos, nunca 20 minutos,
    pero se reusa el mismo timeout largo de _run por consistencia con el
    resto de los comandos determinísticos."""
    args = [story_id, "--placeholder-id", placeholder_id, "--prompt", prompt, "--aspect-ratio", aspect_ratio]
    if provider:
        args += ["--provider", provider]
    return run_cli("media-generate-standalone", *args)

# Deliberadamente NO hay ninguna función acá que invoque `claude -p ...`.
# Las etapas creativas (editorial, media_plan, narrative_direction,
# audio_direction, sequence_plan) las corre un humano en su propia sesión
# de Claude Code -- ver orchestrator.py (Creative Worker contract) y
# report_creative_done.py. El Runtime nunca lanza Claude Code.
