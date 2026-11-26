# Live Match Engine (critical fix, 26-nov-2026)

## Errors found (root causes)
1. **Yesterday's matches shown as current** — `/api/sports/scoreboard` (backend) calls ESPN *without a date*; ESPN then
   returns its "current matchday", mixing yesterday's games and even older ones (e.g. Atlético-MG vs Boca, 21-nov).
   The broadcaster used that list for "Partidos de hoy", the numbers 1–9 and the multi-screen.
2. **States reduced to pre/in/post** — postponed/cancelled became "finished"; half-time and pauses were not real states.
3. **Days compared in the device's zone** (not Colombia), so late matches could switch day.
4. **One match at a time** — event engine and timeline only followed the active match; the "main" match, the
   multi-screen selection and "what is live" lived in three different places (stage state, localStorage, board).
5. **No central eligibility check** before airing a match-bound graphic or before TAKE.

## What changed
- `engine/matchStatus.ts` — canonical states **SCHEDULED, LIVE, HT, BREAK, FINISHED, POSTPONED, CANCELLED, UNKNOWN**
  from the provider's real status names (`STATUS_FIRST_HALF`, `STATUS_HALFTIME`, `STATUS_FULL_TIME`, `STATUS_POSTPONED`…);
  Colombia days (`America/Bogota`); categories **EN VIVO AHORA · PRÓXIMOS · FINALIZADOS HOY · ANTERIORES**;
  eligibility (`liveEligible`, `usageOf`: live / preview / post / none), `graphicAllowed`, `checkTake`, `reconcile`.
- `/api/football/fixtures` (existing service) now returns `status`, `statusName`, `clock`, `period`.
- `engine/useMatchCenter.ts` — single poller (30 s) of yesterday/today/tomorrow in Colombia for the followed leagues;
  failed read → known states kept as *desactualizado* (never promoted to live); a live match missing from a response is
  verified with its match detail before anything changes. Nothing is persisted as "live".
- `engine/matchSelection.ts` — `activeMatchId` (main), `selectedMatchIds` (live only, ordered), `liveMatchIds` derived;
  module store persisted in localStorage (survives panels, tabs, reloads, data refreshes); matches that stop being live
  leave the selection automatically; the main match stays (post-match). The multi-screen follows the selection.
- Multi-screen (`toMultiScores`) — only live matches; selected ones in the operator's order; DESCANSO / PAUSA labels.
- `useProduction` — every selected live match has its own event store; `mergeTimeline` builds one timeline where each
  event keeps its match, ordered chronologically, without duplicates; finished matches go to *Historial*.
- Central validation in `addToProgram` (every match-bound graphic, any button, key or remote command) and in TAKE.
- UI: new "Partidos de hoy" (select / main / order / number per match, actions per real state), timeline with filter
  per match, mobile "Partidos" tab (select several, change main), calendar grouped by Colombia day and real state.

## Known remaining
- The backend `/api/sports/scoreboard` keeps its date-less behaviour for other consumers (portal); the broadcaster no
  longer uses it. Fixing it there needs a backend restart and a decision about the portal widgets.
