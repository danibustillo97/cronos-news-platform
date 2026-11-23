---
description: LAB -- muestra el estado de la direccion narrativa (narrative_direction.json) de una historia
---

Ejecutá:
```
lab/.venv/Scripts/python.exe -m lab.cli narrative-status <story_id>
```
(`story_id` viene de `$ARGUMENTS`; pedíselo al usuario si no lo pasó.)

Reportá en una línea o lista corta: estado (`DRAFT`/`READY_FOR_REVIEW`/`APPROVED`/`REJECTED`), cuántos beats hay, qué arco emocional resultó, y cuántas escenas están cubiertas. Si no hay ninguna dirección narrativa todavía para esa historia, decíselo directo y sugerí `/lab-narrative-direction`.
