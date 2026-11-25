"""Competition formats: a small knowledge base so every table, preview and
insight explains the competition the same way (and the UI knows a league can
have several groups, e.g. Liga BetPlay's two cuadrangulares).

Pure data + pure helpers; no I/O. Formats describe the CURRENT editions
(2025-26 / 2026); update here when a competition changes its format.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class CompetitionFormat:
    id: str                # ESPN league slug
    name: str
    kind: str              # "liga" | "liga+finales" | "fase-de-liga" | "grupos+eliminatorias"
    teams: int | None
    summary: str           # one paragraph, Spanish, for readers
    stages: tuple[str, ...] = field(default_factory=tuple)


FORMATS: dict[str, CompetitionFormat] = {f.id: f for f in (
    CompetitionFormat(
        "col.1", "Liga BetPlay", "liga+finales", 20,
        "Dos torneos por año (Apertura y Finalización). Fase todos contra todos; los 8 mejores pasan a los "
        "cuadrangulares semifinales (dos grupos de 4, ida y vuelta) y los ganadores de cada grupo juegan la final.",
        ("Todos contra todos", "Cuadrangulares (Grupo A y Grupo B)", "Final"),
    ),
    CompetitionFormat(
        "uefa.champions", "Champions League", "fase-de-liga", 36,
        "Fase de liga única con 36 equipos y 8 partidos cada uno. Del 1.º al 8.º van directo a octavos; "
        "del 9.º al 24.º juegan un playoff; del 25.º al 36.º quedan eliminados.",
        ("Fase de liga", "Playoff", "Octavos", "Cuartos", "Semifinales", "Final"),
    ),
    CompetitionFormat(
        "uefa.europa", "Europa League", "fase-de-liga", 36,
        "Fase de liga con 36 equipos: 1.º-8.º a octavos, 9.º-24.º al playoff, 25.º-36.º eliminados.",
        ("Fase de liga", "Playoff", "Octavos", "Cuartos", "Semifinales", "Final"),
    ),
    CompetitionFormat(
        "conmebol.libertadores", "Copa Libertadores", "grupos+eliminatorias", 32,
        "Fase de grupos (8 grupos de 4): los dos primeros pasan a octavos y el tercero va a la Sudamericana. "
        "Después, eliminación directa a ida y vuelta y final única.",
        ("Fase de grupos", "Octavos", "Cuartos", "Semifinales", "Final única"),
    ),
    CompetitionFormat(
        "conmebol.sudamericana", "Copa Sudamericana", "grupos+eliminatorias", 32,
        "Fase de grupos (8 grupos de 4): el primero va a octavos y el segundo juega un playoff ante los terceros "
        "de la Libertadores. Luego eliminación directa y final única.",
        ("Fase de grupos", "Playoff", "Octavos", "Cuartos", "Semifinales", "Final única"),
    ),
    CompetitionFormat("eng.1", "Premier League", "liga", 20,
                      "20 equipos, 38 fechas. Los primeros van a competiciones europeas y los 3 últimos descienden."),
    CompetitionFormat("esp.1", "LaLiga", "liga", 20,
                      "20 equipos, 38 fechas. Los primeros van a Europa y los 3 últimos descienden."),
    CompetitionFormat("ita.1", "Serie A", "liga", 20,
                      "20 equipos, 38 fechas. Los primeros van a Europa y los 3 últimos descienden."),
    CompetitionFormat("ger.1", "Bundesliga", "liga", 18,
                      "18 equipos, 34 fechas. Descienden 2 directos y el 16.º juega una promoción."),
    CompetitionFormat("fra.1", "Ligue 1", "liga", 18,
                      "18 equipos, 34 fechas. Descienden 2 directos y el 16.º juega una promoción."),
)}


def format_for(league: str) -> CompetitionFormat | None:
    return FORMATS.get(league)


_GROUP = re.compile(r"group\s+([a-z0-9]+)", re.I)


def group_label(raw: str, league: str) -> str:
    """ESPN group names -> Spanish: 'Semifinals - Group A' -> 'Cuadrangular A' (Liga BetPlay), 'Group B' -> 'Grupo B'."""
    raw = (raw or "").strip()
    m = _GROUP.search(raw)
    letter = m.group(1).upper() if m else ""
    if league == "col.1" and ("semifinal" in raw.lower() or "quadrangular" in raw.lower()):
        return f"Cuadrangular {letter}".strip()
    if letter:
        return f"Grupo {letter}"
    lowered = raw.lower()
    if "league phase" in lowered or "league stage" in lowered:
        return "Fase de liga"
    return raw or "Tabla"
