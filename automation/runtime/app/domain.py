"""Tipos finos del Local Runtime. El Runtime no tiene dominio editorial
propio -- estos son solo los valores que necesita para orquestar y
reportar estado; el conocimiento real de qué es cada etapa vive en LAB
(lab/cli.py, .claude/commands/lab-*.md), no acá.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class StageKind(str, Enum):
    CLAUDE = "claude"           # requiere razonamiento -> claude -p "/comando <id>"
    DETERMINISTIC = "det"       # llama lab.cli directo, sin Claude


@dataclass(frozen=True)
class Stage:
    name: str                    # nombre lógico, el que se guarda en production_jobs.stage
    kind: StageKind
    # Para CLAUDE: el slash command real (.claude/commands/lab-<slash>.md).
    # Para DETERMINISTIC: la lista de subcomandos reales de lab.cli a correr en orden.
    slash_command: str | None = None
    cli_commands: tuple[str, ...] = field(default_factory=tuple)
    optional: bool = False       # si falla/se salta, no aborta la producción entera


# Secuencia real de producción, en orden. Nombres de comandos verificados
# contra .claude/commands/*.md y `lab.cli --help` (lab/cli.py) -- no
# inventados. `editorial` ya incluye understanding+storycraft+narrative
# (guion) y su propio editorial-review, ver .claude/commands/lab-process-news.md.
PIPELINE: tuple[Stage, ...] = (
    Stage("editorial", StageKind.CLAUDE, slash_command="lab-process-news"),
    Stage("media_init", StageKind.DETERMINISTIC, cli_commands=("media-init",)),
    # lab-media-plan escribe media_plan/generation_requests/visual_style.json
    # y corre media-record-plan él mismo (mismo patrón que lab-narrative-direction).
    Stage("media_plan", StageKind.CLAUDE, slash_command="lab-media-plan"),
    Stage("media_generate", StageKind.DETERMINISTIC, cli_commands=("media-generate",)),
    # Capa de intención emocional (distinta de "narrative" editorial, que
    # ya corrió dentro de "editorial") -- necesita media_blueprint.json.
    Stage("narrative_direction", StageKind.CLAUDE, slash_command="lab-narrative-direction",
          optional=True),
    Stage("narrative_review", StageKind.DETERMINISTIC, cli_commands=("narrative-review",),
          optional=True),
    Stage("audio_direction", StageKind.CLAUDE, slash_command="lab-audio-direction", optional=True),
    Stage("audio_review", StageKind.DETERMINISTIC, cli_commands=("audio-review",), optional=True),
    Stage("sequence_plan", StageKind.CLAUDE, slash_command="lab-sequence-plan"),
    Stage("sequence_review", StageKind.DETERMINISTIC, cli_commands=("sequence-review",)),
    Stage("animation_plan", StageKind.DETERMINISTIC, cli_commands=("animation-plan",)),
    Stage("render", StageKind.DETERMINISTIC, cli_commands=("render-plan", "render-execute")),
    Stage("assembly", StageKind.DETERMINISTIC,
          cli_commands=("assembly-plan", "assembly-review", "assembly-execute")),
    Stage("export", StageKind.DETERMINISTIC,
          cli_commands=("export-plan", "export-review", "export-execute")),
)


class ProductionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"
