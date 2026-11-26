# Automation Engine

Files: `frontend/src/components/admin/Broadcaster/engine/sportsEvents.ts` (Sports Event Engine),
`engine/automation.ts` (rules, scheduler, queue), `engine/useProduction.ts` (wiring), executors in `BroadcasterView.tsx`.

## Sports Event Engine
- Source: `GET /api/matches/{league}/{id}` (FastAPI → ESPN), read every **15 s** for the active match.
- Normalized `SportsEvent`: `id` (source id or `matchId:phase`), `matchId`, `league`, `type` (goal, penalty-goal, own-goal,
  yellow, red, sub, var, kickoff, half-time, second-half, full-time, lineups), `team`, `player`, `assist`, `playerOut`,
  `minute`/`minuteValue`, `source: "espn"`, `firstSeen`/`lastSeen` timestamps, `observations`, `status`, `confidence`.
- **Validation**: `pending` on first sight → `confirmed` after **2 successful reads**; `retracted` when missing in 2
  consecutive reads (e.g. goal disallowed) — final for that id. Phase events are derived from the match state.
- **History baseline**: what exists at the first read of a session is shown but never triggers automation (no late goal
  cards when opening a finished or ongoing match, nor after a reload).
- **Freshness**: `fresh` / `stale` (failed read or > 45 s since the last success) / `unavailable` (never read). The UI
  labels data *Confirmados*, *Desactualizados*, *Sin datos*, and events *confirmado / pendiente / retirado*.
- **Dedupe & recovery**: events keyed by source id; stores persist (localStorage + Supabase) so a reload or an outage never
  repeats events (scenario H tested in unit and browser).

## Rules → tasks
`Rule { id, label, on: Trigger[], mode: "auto" | "approval" | "manual", priority, when?, actions[] }`,
`ActionSpec { kind, label, params?, delayMs?, expiresMs?, maxAttempts? }`.
- Only **confirmed** events of the **active match** trigger rules.
- `auto` → queued and executed; `approval` → *Por aprobar* in the console (✔/✖, phone too), expires after `expiresMs`;
  `manual` → no tasks (the operator acts).
- **Dedupe** key `rule:event:action` (persisted). **Scheduler** tick 1 s, one task at a time by priority.
- **Retries** with exponential backoff (2 s·2ⁿ) up to `maxAttempts` (3), then `failed` (kept in history with the error).
- **Pause / resume** (console, phone), **cancel** queued tasks, **history** (200, persisted 100).
- Automatic graphics respect the priority hierarchy: if a more important graphic is on its layer, the task waits and
  retries ("Esperando: Gol al aire"). Operator actions and approvals always go through.

## Default rules (editable per rule in the console)
| Rule | Trigger | Mode | Actions |
|---|---|---|---|
| Gol confirmado | goal / penalty / own goal | auto | goal card (crest, scorer, minute, assist, fact) → scorer card (+14 s) |
| Análisis tras el gol | goal | approval | timeline · poll "¿Quién gana?" |
| Tarjeta roja | red | auto | card graphic → match stats (+12 s) |
| Tarjeta amarilla | yellow | auto | card graphic |
| Sustitución | sub | auto | sub graphic → incoming player card (+10 s) |
| Alineaciones confirmadas | lineups | approval | line-ups (20 s) |
| Inicio | kickoff | auto | rundown → live · scoreboard |
| Descanso | half-time | auto | half-time result → first-half stats |
| Final | full-time | auto | final result → rundown → post-match (+5 s) |
| Encuesta final | full-time | approval | poll "Figura del partido" (real scorers/starters) |

When the production engine covers the main match, the legacy automatic reactions of `useFootballMatch` step aside
(no duplicate graphics); SFX stay.
