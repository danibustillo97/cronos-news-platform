"""
Decide como se ejecuta (o no) el motion declarado por Animation Plan, para
un shot dado, en Assembly. Funcion pura, sin FFmpeg, sin I/O -- misma
disciplina que lab.render.planner.compute_transform_geometry().

Por que "STATIC" es lo unico que se aplica hoy
------------------------------------------------
Ningun artifact upstream define parametros numericos de Ken Burns (escala
inicial/final, direccion de pan): sequence.json/animation_plan.json solo
tienen la etiqueta motion.type (ej. "SLOW_ZOOM_IN") -- nunca un numero.
render_plan.json solo resuelve geometria ESTATICA (fit/cover para que el
aspect ratio coincida), nunca movimiento. El Renderer real (Fase 4.2.5,
lab/render/renderer.py) tampoco ejecuta motion -- su propio docstring lo
dice: "sin motion/Ken-Burns... eso queda para etapas futuras". Es decir,
todo shot ya renderizado en videos/rendered/*.mp4 es, de hecho, un clip
estatico -- Assembly concatena esos clips tal cual existen, no los vuelve a
procesar.

Assembly podria "inventar" una magnitud de zoom/pan (una tabla fija tipo
TARGET_DIMENSIONS) para darle vida al motion declarado -- pero esa
magnitud no vendria respaldada por ningun artifact ni por criterio
editorial real: seria "una intensidad narrativa" fabricada por esta etapa,
justo lo que la disciplina NO INVENTAR del proyecto prohibe, y convertiria
a Assembly en un nuevo Motion Planner (responsabilidad que no le
corresponde). Por eso decide_motion_execution() nunca produce nada mas que
STATIC -- documenta el motion declarado (para trazabilidad, y para que una
futura etapa de Ken Burns real sepa exactamente que shots lo estaban
esperando) sin fingir haberlo ejecutado.
"""

from typing import Any

_REASON_NO_UPSTREAM_PARAMETERS = (
    "Ningún artifact upstream (sequence.json/animation_plan.json/render_plan.json) define "
    "parámetros numéricos de Ken Burns, y el Renderer (Fase 4.2.5) tampoco los ejecuta — solo "
    "geometría estática. Assembly no inventa esa magnitud."
)


def resolve_motion_execution(declared_motion_type: str) -> dict[str, Any]:
    """declared_motion_type: el `motion.type` ya validado de un AnimationShot
    (vocabulario cerrado, MOTION_TYPES de lab.sequence.constants -- esta
    función no lo revalida, solo lo registra tal cual)."""
    return {
        "declared_type": declared_motion_type,
        "applied": "STATIC",
        "reason": _REASON_NO_UPSTREAM_PARAMETERS,
    }
