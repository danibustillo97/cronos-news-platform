# Matchday Rundown

File: `engine/rundown.ts` (pure, tested) + `RundownPanel` in `engine/ProductionRoom.tsx`.

Block: `name`, `kind`, `phase` (pre / live / post), `offsetMin`, `scheduledAt`, `durationSec`, `status`, `source`, `graphic`,
`action` (graphics | scene | poll | show | none), `dependsOn`, `priority`, `requires`.
States: **Pendiente** (data not available yet) · **Preparado** · **En emisión** · **Completado** · **Omitido** · **Error**.

- **Generated from the real match** when the operator picks a match: pre-match times hang from the real kick-off
  (T-30 opening … T-1 countdown), live blocks start at kick-off (15', 30', 40', 60', 75'), post-match blocks at the final
  whistle (result, timeline, final stats, standings, featured player, final poll, analysis, close).
- **Readiness** comes from data: line-ups block waits until line-ups are published (and the duel that depends on it),
  standings only if the source publishes a table, post blocks only when the match is finished, stats only if available.
- **Editing**: run ▶, skip, repeat, move up/down, delete (dependencies cleaned), add a custom block, regenerate.
- **Runner**: *Auto* starts the next ready block of the current phase whose time has come and finishes it after its
  duration (one at a time); *Manual* never starts by itself. "Siguiente" runs the next ready block. Pausing the
  automation pauses the runner. Phase follows the real match state; full-time switches to post-match (rule).
- Every block action goes through the automation queue (history, retries); a failed task marks the block **Error**
  with the reason (e.g. "La fuente no publicó posiciones").
- Persisted per match (localStorage + Supabase).
