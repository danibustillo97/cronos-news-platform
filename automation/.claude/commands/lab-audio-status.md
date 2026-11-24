---
description: LAB -- muestra el estado de la direccion de audio (audio_plan.json) de una historia
---

Ejecutá:
```
lab/.venv/Scripts/python.exe -m lab.cli audio-status <story_id>
```
(`story_id` viene de `$ARGUMENTS`; pedíselo al usuario si no lo pasó.)

Reportá en una línea o lista corta: estado (`DRAFT`/`READY_FOR_REVIEW`/`APPROVED`/`REJECTED`), cuántos tracks hay por `role`, y cuántas ventanas de silencio hay. Si no hay ninguna dirección de audio todavía para esa historia, decíselo directo y sugerí `/lab-audio-direction`.
