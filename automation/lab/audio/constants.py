"""
Vocabulario de una sola fuente de verdad para Audio Direction. Mismo
criterio que lab.narrative.constants: AUDIO_ROLES y DUCKING_PRIORITY_ORDER
vienen directo del diseno aprobado (obsidian-vault/CRONOS - Narrative &
Audio Direction.md: "Capas independientes por role: NARRATION/MUSIC/SFX/
AMBIENCE" y "ducking_rules (prioridad fija: NARRATION > SFX > MUSIC >
AMBIENCE)"). FADE_TYPES y SILENCE_TREATMENTS no llegaron enumerados desde
ese documento (solo se nombraban los conceptos "Fades"/"silence_windows")
-- se fijan aca como decision de esta implementacion, mismo criterio ya
aplicado en lab.narrative.constants para sus propios vocabularios no
enumerados.
"""

# Las 4 capas de audio del diseno aprobado -- cerrado, no se agregan mas
# sin volver a aprobar el diseno.
AUDIO_ROLES = frozenset({"NARRATION", "MUSIC", "SFX", "AMBIENCE"})

# Prioridad de mezcla FIJA -- no es una decision por historia, es la regla
# del diseno aprobado. validate_audio_plan() exige que ducking_rules la
# reproduzca exactamente; nunca se re-decide.
DUCKING_PRIORITY_ORDER = ("NARRATION", "SFX", "MUSIC", "AMBIENCE")

# No enumerado en el diseno aprobado -- decision de esta implementacion,
# mismo criterio que TRANSITION_INTENTIONS en lab.narrative.constants.
FADE_TYPES = frozenset({"NONE", "SOFT", "HARD"})

# Como se manifiesta un silencio declarado en el mix -- no enumerado en el
# diseno aprobado, decision de esta implementacion. FULL_SILENCE = ninguna
# capa suena; AMBIENCE_ONLY = solo ambiente, todo lo demas calla;
# MUSIC_DUCK = la musica baja a un nivel de fondo sin desaparecer.
SILENCE_TREATMENTS = frozenset({"FULL_SILENCE", "AMBIENCE_ONLY", "MUSIC_DUCK"})

AUDIO_PLAN_STATUS = frozenset({
    "DRAFT",
    "READY_FOR_REVIEW",
    "APPROVED",
    "REJECTED",
})
