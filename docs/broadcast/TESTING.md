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

## Live Match Engine (critical fix) — required cases
Automated (`engine/liveMatch.test.ts`, 14 tests, all passing): 1 yesterday's finished match never in EN VIVO ·
2 scheduled → PRÓXIMOS · 3 being played → EN VIVO · 4 half-time stays eligible and shows DESCANSO · 5 finished leaves
EN VIVO · 6 three matches selected / removed / reordered · 7 changing the main match keeps the others · 8 multi-screen
shows exactly the selected live matches in order · 9 events of different matches never mix · 10 no duplicates on refresh ·
11 Colombia time zone (e.g. 01:40 UTC of the 27th is the 26th) · 12 selection survives refreshes; finished matches leave
the live selection · 13 a non-eligible match cannot pass TAKE · 14 a disconnection never turns an old match into a live one.

Browser, with real Europa League matches (26-nov-2026, 16:00 Colombia):
EN VIVO AHORA (10, all DESCANSO, then 46'–48' after the restart), FINALIZADOS HOY (8), PRÓXIMOS (7), ANTERIORES (11),
the 21-nov match gone; 3 matches selected + main changed, kept after switching panels and a data refresh; multi-screen
showed exactly those 3; timeline with one filter per match detected "Segundo tiempo" live; key `E` on a not-started
main match refused centrally ("El partido no ha comenzado"); TAKE of the live multi-screen; selection from a phone
(390 px) reached the PC studio.

## Broadcast Output (salida limpia para KICK)

- Unitarias: `engine/programOutput.test.ts` cubre el ajuste de bitrate en el SDP (solo códecs de
  video, ni audio ni rtx), la preferencia H.264 y la medición real de fps.
- E2E (Playwright fuera del repo, con el módulo real como host): salida sin interfaz ni scroll,
  previa → en vivo → gol → estadística → encuesta → cambio de partido → postpartido sin recargar,
  último cuadro conservado al cerrar el estudio, reconexión automática, detección de un estudio
  congelado por latido y corrida de 3 minutos con fps, cuadros perdidos y memoria. Los resultados
  están en `BROADCAST_OUTPUT.md`.
- Manual con el estudio real: pulsar **Salida**, hacer un TAKE y ver el cambio en la pestaña de
  salida; revisar en el tooltip del botón los fps medidos en tu equipo.

