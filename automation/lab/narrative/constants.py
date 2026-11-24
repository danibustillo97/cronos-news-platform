"""
Vocabulario de una sola fuente de verdad para Narrative Direction. Mismo
criterio que lab.sequence.constants: algunos vocabularios los fija
explicitamente el diseno aprobado (EMOTIONS, INTENSITY_LEVELS -- ver
obsidian-vault/CRONOS - Narrative & Audio Direction.md); el resto
(NARRATIVE_FUNCTIONS, *_INTENTIONS) no llego con un enum cerrado desde ese
documento, asi que se fija aca como una decision de diseno razonable y
documentada -- mismo criterio ya usado en TRANSITION_TYPES de
lab.sequence.constants ("el brief solo menciona FADE y CUT como ejemplos").
Extensible sin romper el esquema de narrative_direction.json.
"""

# Vocabulario cerrado tal cual lo declara el diseno aprobado -- incluye
# "..." en el documento original, interpretado como una lista abierta pero
# finita de emociones reconocibles, no como "cualquier string".
EMOTIONS = frozenset({
    "SUSPENSE",
    "TENSION",
    "TRAGEDY",
    "LOW_POINT",
    "TURNING_POINT",
    "HOPE",
    "RISE",
    "VICTORY",
    "NOSTALGIA",
    "BITTERSWEET",
    "CONFLICT",
    "MIXED_FEELINGS",
})

# Ordinal, tal cual lo pide el diseno aprobado -- nunca un float inventado.
INTENSITY_LEVELS = frozenset({"LOW", "MEDIUM", "HIGH"})

# No enumerado en el diseno aprobado -- decision de esta implementacion,
# reutiliza el vocabulario "HOOK -> CLOSING" ya precedente en
# narrative_structure (lab.sequence.planner) y en la skill lab-sequence-planning.
NARRATIVE_FUNCTIONS = frozenset({
    "HOOK",
    "RISING_ACTION",
    "LOW_POINT",
    "TURNING_POINT",
    "CLIMAX",
    "RESOLUTION",
    "CLOSING",
})

# No enumerado en el diseno aprobado -- decision de esta implementacion.
PACING_INTENTIONS = frozenset({"SLOW", "MEDIUM", "FAST"})

VISUAL_RHYTHM_INTENTIONS = frozenset({"STEADY", "ACCELERATING", "DECELERATING"})

# Espejo de INTENSITY_LEVELS -- misma escala ordinal, distinto significado
# (cuanto zoom/pan debería sentirse, no que tan intensa es la emocion).
MOTION_INTENSITY_INTENTIONS = frozenset({"SUBTLE", "MODERATE", "STRONG"})

# Intencion de transicion -- Sequence sigue siendo quien decide el valor
# literal (transition_in/transition_out); esto es la senal editorial que
# informa esa decision, nunca la reemplaza.
TRANSITION_INTENTIONS = frozenset({"ABRUPT", "SOFT", "TIME_PASSING", "NONE"})

# Mood de musica -- espejo deliberado de EMOTIONS (los ejemplos del diseno
# aprobado son "suspense"/"dark_emotional"/"rising"/"triumphant", el mismo
# arco que EMOTIONS), pero vocabulario propio: Audio Direction (no
# implementada) es quien elegiria musica real a partir de esto, y "mood"
# no siempre es literalmente la misma palabra que "emotion" del beat.
MUSIC_INTENTIONS = frozenset({
    "SUSPENSEFUL",
    "TENSE",
    "DARK_EMOTIONAL",
    "RISING",
    "TRIUMPHANT",
    "HOPEFUL",
    "MELANCHOLIC",
    "NEUTRAL",
})

# El silencio es una decision narrativa explicita, no ausencia de dato --
# ver diseno aprobado. NONE = sin intencion particular de silencio/enfasis.
SILENCE_OR_EMPHASIS_VALUES = frozenset({"NONE", "SILENCE", "EMPHASIS"})

NARRATIVE_DIRECTION_STATUS = frozenset({
    "DRAFT",
    "READY_FOR_REVIEW",
    "APPROVED",
    "REJECTED",
})
