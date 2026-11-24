"""
Audio Direction de LAB (capa nueva, consume Narrative Direction).

Responde "como debe sonar la evolucion emocional de la historia" -- lee
narrative_direction.json (solo lectura, mismo patron que Animation lee
Sequence) y declara, por beat, que capas de audio hacen falta (NARRATION/
MUSIC/SFX/AMBIENCE), ventanas de silencio deliberado, y la regla de
prioridad de mezcla (fija: NARRATION > SFX > MUSIC > AMBIENCE).

Es una capa de DIRECCION, no de generacion: nunca elige proveedor, nunca
descarga musica, nunca ejecuta TTS, nunca genera ni edita ningun archivo de
audio, nunca ejecuta FFmpeg. Todo lo que declara es intencion -- una futura
etapa de ejecucion (fuera de este trabajo) es quien convertiria "Music:
tension creciente en beat_03" en un archivo real.

No modifica narrative_direction.json, sequence.json, animation_plan.json,
render_plan.json, media_blueprint.json ni asset_registry.json -- solo lee
narrative_direction.json.

Ver docs/LAB_AUDIO_DIRECTION.md y obsidian-vault/CRONOS - Narrative & Audio
Direction.md (cronos-news-platform) para el diseno original aprobado.
"""
