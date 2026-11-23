#!/usr/bin/env python
"""Reporta al Local Runtime que una etapa creativa terminó -- la mitad
"humana" del contrato del Creative Worker (ver app/orchestrator.py).

Este script NO lanza Claude Code ni corre ninguna skill de LAB. Vos
corrés la skill real vos mismo, en tu propia sesión de Claude Code sobre
RPA_NEWS_SCRIPT (el mismo comando que te muestra GET /creative-jobs o
el "detail" de la etapa en Production Workspace). Cuando termina, corrés
esto para que el Runtime retome el resto del pipeline solo.

Uso:
    python report_creative_done.py <item_id> <stage> --ok
    python report_creative_done.py <item_id> <stage> --fail --error "lo que pasó"

<stage> es el nombre real de la etapa (editorial, media_plan,
narrative_direction, audio_direction, sequence_plan) -- el mismo que
aparece en GET /creative-jobs.
"""
from __future__ import annotations

import argparse
import os
import sys

import httpx

RUNTIME_BASE_URL = os.getenv("RUNTIME_BASE_URL", "http://localhost:8801")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("item_id", help="story_id / item_id de LAB")
    parser.add_argument("stage", help="Nombre de la etapa (ver GET /creative-jobs)")
    parser.add_argument("--ok", action="store_true", help="La skill terminó bien (default)")
    parser.add_argument("--fail", action="store_true", help="La skill falló")
    parser.add_argument("--error", default=None, help="Detalle del error, si --fail")
    args = parser.parse_args()

    if args.fail and args.ok:
        parser.error("--ok y --fail son mutuamente excluyentes")
    ok = not args.fail

    jobs = httpx.get(f"{RUNTIME_BASE_URL}/creative-jobs", timeout=10).json()["jobs"]
    match = next((j for j in jobs if j["item_id"] == args.item_id and j["stage"] == args.stage), None)
    if match is None:
        print(f"No hay ningún job QUEUED para item_id={args.item_id!r} stage={args.stage!r}.")
        print("Jobs pendientes ahora mismo:")
        for j in jobs:
            print(f"  - {j['item_id']} / {j['stage']} -> {j['slash_command']}")
        return 1

    resp = httpx.post(
        f"{RUNTIME_BASE_URL}/productions/{match['production_id']}/creative-stage-done",
        json={"stage": args.stage, "ok": ok, "error": args.error},
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"El Runtime rechazó el reporte: {resp.status_code} {resp.text}")
        return 1

    print(f"Reportado: {args.stage} {'OK' if ok else 'FAILED'} para {args.item_id}. El pipeline sigue solo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
