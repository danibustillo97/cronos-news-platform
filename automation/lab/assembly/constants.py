"""
Vocabulario de una sola fuente de verdad para Assembly. Mismo criterio que
lab.render.constants: SHOT_DISPOSITION viene directo del diseno aprobado
(obsidian-vault/CRONOS - Assembly.md: "disposition (INCLUDED /
EXCLUDED_NO_ASSET / BLOCKED_NOT_RENDERED)"). El resto son decisiones de
esta implementacion, documentadas en docs/LAB_ASSEMBLY.md.
"""

ASSEMBLY_PLAN_STATUS = frozenset({
    "DRAFT",
    "READY_FOR_REVIEW",
    "APPROVED",
    "REJECTED",
})

# Directo del diseno aprobado -- las 3 disposiciones posibles de un shot.
SHOT_DISPOSITION = frozenset({"INCLUDED", "EXCLUDED_NO_ASSET", "BLOCKED_NOT_RENDERED"})

# v1 solo ejecuta CUT (gratis con el demuxer concat de FFmpeg). FADE/DISSOLVE
# se declaran pero nunca se aplican todavia -- ver lab.assembly.planner
# resolve_transition_execution(). DISSOLVE real necesitaria xfade
# (filter_complex, clips solapados), no el demuxer concat -- etapa futura.
TRANSITION_APPLIED_VALUES = frozenset({"CUT"})

# v1 solo aplica STATIC -- ver lab.assembly.motion para el porque completo.
MOTION_APPLIED_VALUES = frozenset({"STATIC"})

# Estado de la ejecucion real (assembler.py) -- mismo vocabulario que
# RENDER_SHOT_STATUS en lab.render.constants. PENDING hasta que
# assembly-execute corra de verdad.
ASSEMBLY_OUTPUT_STATUS = frozenset({"PENDING", "DONE", "FAILED"})
