# Testing

Run: `cd frontend && npx tsc --noEmit -p . && npx eslint src/components/admin/Broadcaster && npm test`.
`next build` is not run in this project by standing instruction of the owner (dev server only); type check and lint
replace it here.

## Automated (vitest) — 360+ tests, all passing
- `engine/sportsEvents.test.ts` — real ESPN match normalization, confirmation after 2 reads, retraction, phase events,
  history baseline, outage → stale → recovery without duplicates (H), reload without re-emission.
- `engine/automation.test.ts` — confirmed goal end-to-end and dedupe (C), unconfirmed/other match ignored, approval,
  expiry, reject, retries with backoff, pause/resume, manual mode, full-time → post-match (F), persistence.
- `engine/rundown.test.ts` — generation from real context (A), readiness by data, editing, auto/manual runner (B),
  phase scheduling (F). `engine/graphicsCatalog.test.ts` — layer arbitration. `engine/audience.test.ts` — real options.
- `football/eventGraphics.test.ts` — sub, card, timeline, duel, poll result, result card, featured player (real match).

## Browser (Playwright, real data, 26-nov-2026)
| Scenario | Result |
|---|---|
| A — select a match, pre-match generated | ✅ Deportivo Cali vs Bucaramanga: blocks timed from the real kick-off (6:35 p. m.), line-ups *Pendiente* (not published) |
| B — prepare the rundown and start | ✅ "Identificación" → scoreboard DCI vs BUC on air |
| C — confirmed goal updates scoreboard and graphics | ✅ unit/integration (engine + executors); 🔒 no live match during validation |
| D — poll during the live and its results | ✅ real match poll listed, on air, result graphic (0 votes shown as 0); 🔒 creating/closing/moderating needs an admin session (401 outside admin) |
| E — stats and comparisons | ✅ standings (Barcelona 4.º, Sabah 33.º highlighted), result card, featured player, timeline, duel |
| F — finish and post-match | ✅ finished match → phase *Postpartido*, post blocks ready and aired |
| G — control from a phone | ✅ second page at 390 px connected to the PC studio: toggled *Cinta*, *Ocultar todo* cleared the PC |
| H — data source down and back | ✅ "Datos desactualizados" while down, "Datos confirmados" after, 19 events before/after (no duplicates) |

Viewports 360, 390, 430, 768, 1024, 1366, 1920: no horizontal overflow; phones get the mobile control, 768–1279 the
tablet room, ≥ 1280 the desktop room.

## External dependencies that limit end-to-end validation
- A **live match** in a followed league (for scenario C on air).
- An **admin session** (Supabase Auth) for poll creation/closing and comment moderation, and for the cross-device
  Realtime channel (without a session the remote control works between tabs of the same device).
- The local **MediaMTX/WHIP gateway** and stream keys for real transmission (unchanged; not exercised).
