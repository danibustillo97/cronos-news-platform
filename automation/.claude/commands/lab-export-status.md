---
description: LAB -- muestra el estado del paquete de exportacion (export_manifest.json) de una historia
---

Ejecutá:
```
lab/.venv/Scripts/python.exe -m lab.cli export-status <story_id>
```
(`story_id` viene de `$ARGUMENTS`; pedíselo al usuario si no lo pasó.)

Reportá en una línea o lista corta: estado (`DRAFT`/`READY_FOR_REVIEW`/`EXPORTED`), fecha de exportación si ya se ejecutó, y cuántos elementos hay por `availability`. Si no hay ningún export todavía para esa historia, decíselo directo y sugerí `/lab-production-export`.
