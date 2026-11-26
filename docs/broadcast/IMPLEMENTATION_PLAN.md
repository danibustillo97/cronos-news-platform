# Implementation plan

Order (as requested): audit → architecture → engines → automation → rundown → audience → graphics → control room →
responsive → integration → tests → docs. Each step lands as working code with tests before the next.

| # | Step | Deliverable | Reuses |
|---|---|---|---|
| 1 | Audit | ARCHITECTURE.md, FEATURE_MATRIX.md | — |
| 2 | Sports Event Engine | `engine/sportsEvents.ts` (+ tests with a real ESPN match, outage/recovery) and `useMatchFeed` | `/api/matches/{l}/{id}`, autoSync parsing ideas |
| 3 | Automation Engine | `engine/automation.ts` (rules, scheduler, queue, dedupe, retries, history, cancel, pause/resume) + default rules | existing reactions (goal card, card, sub, timeline, duel, stats) become executors |
| 4 | Matchday Rundown | `engine/rundown.ts` (generation pre/live/post from real context, editing, auto/manual runner) | scenes, graphics, recap show |
| 5 | Audience | `engine/audience.ts` (admin polls API, comments moderation → on-air graphics) | `/api/admin/polls`, `/api/admin/comments`, poll-result graphic |
| 6 | Graphics | `engine/graphicsCatalog.ts` (layers/priorities/durations), new designs: standings, half-time/full-time, featured player | designs.ts, placement.ts |
| 7 | Control room | `engine/ProductionRoom.tsx` panels (rundown, event monitor, automation console, audience) inside the stage; status strip | FootballStage, design system |
| 8 | Responsive | desktop / tablet / mobile layouts; mobile control screen | — |
| 9 | Remote control + persistence | `engine/remoteControl.ts`, `engine/productionStore.ts` | Supabase client, football_broadcast_matches |
| 10 | Validation | scenarios A–H (TESTING.md), viewport checks 360–1920 | Playwright scripts |
| 11 | Docs | AUTOMATION_ENGINE, GRAPHICS_ENGINE, MATCHDAY_RUNDOWN, MOBILE_CONTROL, TESTING | — |

Out of scope: Noris 3D (only the existing presenter hook stays), production deployment, DB schema changes.
