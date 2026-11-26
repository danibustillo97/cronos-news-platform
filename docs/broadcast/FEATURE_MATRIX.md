# Feature matrix

Legend: ✅ operational with real data · 🟡 partial · ⛔ missing · 🔒 needs an external dependency to validate end-to-end.
"Before" = state found in the audit (26-nov-2026). "After" = state at the end of this project, verified (see TESTING.md).

| Area | Feature | Before | After | Notes |
|---|---|---|---|---|
| Sports data | Scheduled / live / finished matches | ✅ | ✅ | fixtures, scoreboard, match detail |
| | Goals, cards, subs from source | ✅ (autoSync) | ✅ | normalized events with id, team, player, minute, source, timestamp |
| | Dedupe, incremental update | 🟡 (handled ids per match) | ✅ | event store keyed by source id |
| | Confirmation / retraction / stale data | ⛔ | ✅ | confirmed after 2 reads; retracted if it disappears; freshness badge |
| | Line-ups, stats, standings | ✅ | ✅ | standings via recap/insights |
| Automation | Rules engine with modes | ⛔ (hard-coded reactions) | ✅ | auto / approval / manual per rule |
| | Scheduler, queue, retries, history, cancel, pause/resume | ⛔ | ✅ | |
| | Goal / red / sub / half-time / full-time reactions | 🟡 | ✅ | full-time switches the rundown to post-match |
| Rundown | Blocks with states, timing, source, graphic, action, deps, priority | ⛔ | ✅ | |
| | Auto generation from real match context | ⛔ | ✅ | only blocks with available data are "ready"; others wait |
| | Edit / reorder / add / delete / repeat / skip / next / pause | ⛔ | ✅ | |
| Audience | Polls create / open / close / live results | 🟡 (debate launcher) | ✅ 🔒 | uses existing admin API (needs admin session) |
| | Debates linked to events | 🟡 | ✅ 🔒 | |
| | Questions / highlighted messages with moderation | ⛔ | ✅ 🔒 | comments of the match polls, moderated before air |
| Graphics | Library (scoreboard, ticker, goal, card, sub, line-ups, stats, duel, poll, result, timeline, recap…) | ✅ | ✅ | + standings, half-time / full-time, featured player |
| | Priority hierarchy (layers) | 🟡 (no-overlap placement) | ✅ | layer exclusivity + priorities |
| | Configurable duration, preview, on-air state | 🟡 | ✅ | |
| Control room | Preview / Program / TAKE / transitions | ✅ | ✅ | |
| | Rundown, event monitor, automation console in the room | ⛔ | ✅ | |
| | Desktop / tablet / mobile specific layouts | 🟡 | ✅ | |
| | Mobile remote control of a desktop studio | ⛔ | ✅ | Supabase Realtime (signed in) or same-device tabs |
| Video | Camera, screen, guests, media, audio, transitions | ✅ | ✅ | unchanged |
| | Clear input / preview / program / rec / stream / connection status | 🟡 | ✅ | |
| | Safe stream controls | 🟡 | ✅ | confirmation before stopping the stream |
| | OBS integration | ⛔ | ⛔ | not present; WHIP gateway is the output |
| Persistence | Production workspace (rundown, rules, history, prefs) | ⛔ | ✅ | localStorage + Supabase row (existing table, RLS) |
| Presenter | Noris 3D | ⛔ | ⛔ | **excluded from this project** (hook only) |
