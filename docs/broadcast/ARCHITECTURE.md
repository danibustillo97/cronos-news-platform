# NEXUS SPORT Broadcast — Architecture

Audited 26-nov-2026 on branch `feature/social-media-studio-v2`. Stack: Next.js 15 (App Router, React 19, TS, Tailwind),
FastAPI backend (Clean Architecture) behind the Next proxy `/api/[...path]` → `:8000`, Supabase (Postgres + Auth +
Realtime), ESPN public APIs as the sports source. Vitest for unit tests. No OBS integration exists.

## 1. Layers and modules

```
Production Control Interface (React)
  admin/page.tsx → BroadcasterHub.tsx (video | radio) → BroadcasterView.tsx (3k lines, state owner)
     ├─ football/FootballStage.tsx      control room (library · PVW/PGM · TAKE · graphics · tabs)  [redesigned in Phase 7]
     ├─ football/MatchRail · DataDeck · AutoShowPanel · AudioBar · OnAirStrip
     └─ engine/ProductionRoom.tsx      NEW — rundown, automation console, event monitor, audience, mobile control
Engines (pure TS, tested, framework-agnostic)                                   [NEW in this project: engine/]
  engine/sportsEvents.ts    Sports Event Engine: normalize, dedupe, confirm/retract, freshness
  engine/automation.ts      Automation Engine: rules → tasks, scheduler, queue, retries, history, pause
  engine/rundown.ts         Matchday Rundown: blocks, generation from real context, editing, runner
  engine/graphicsCatalog.ts Graphics Engine catalogue: layers, priorities, durations, data requirements
  engine/audience.ts        Audience Engagement: polls/debates (admin API), moderated questions (comments)
  engine/remoteControl.ts   Control state + commands over Supabase Realtime / BroadcastChannel
  engine/productionStore.ts Persistence: localStorage + Supabase football_broadcast_matches (RLS)
Existing engines (kept)
  football/autoSync.ts (planSync), useFootballMatch.ts (main-match sync 15 s), liveBoard.ts (all matches 30 s)
  football/designs.ts + raster.ts (HTML→bitmap graphics), placement.ts (no overlaps / camera frames)
  compositor.ts (Program/Preview drawing, transitions), audioMixer.ts, music.ts, sfx.ts
  live/whip.ts (WHIP publish to local MediaMTX gateway → Kick), recorder (MediaRecorder), guest room (WebRTC)
  presenterLayer.ts (future presenter hook — Noris excluded from this project)
Data APIs
  Next routes: /api/football/fixtures · /match · /recap · /timeline · /squad, /api/proxy-image, /api/tts (unused here)
  FastAPI: /api/matches/{league}/{id} (detail), /api/matches/moments, /api/matches/insights/player/{id},
           /api/insights/feed, /api/sports/scoreboard, /api/polls (+/api/admin/polls), /api/social (+/api/admin/comments)
Persistence
  Supabase: football_broadcast_matches (jsonb payload, RLS by user_id) — match workspace + NEW production workspace row
            polls / poll_options / poll_votes, comments (status visible|pending|hidden), reactions
  Browser: IndexedDB media library, localStorage preferences (keys, slots, layout, show messages)
```

## 2. Data flow (live)

```
ESPN ──► FastAPI /api/matches/{l}/{id} (15 s cache) ──► Sports Event Engine (poll 15 s, dedupe, confirm after 2 reads,
                                                         retract, freshness: fresh | stale | unavailable)
                                                              │ confirmed events
                                                              ▼
                                Automation Engine: rules (auto | approval | manual) → tasks → executors
                                                              │                      ▲ approve/reject/pause (operator, phone)
                                                              ▼                      │
                    Graphics Engine (catalogue priorities + designs) → bus (Preview | Program) → compositor → WHIP / REC
                                                              ▲
                     Matchday Rundown (pre / live / post blocks, auto or manual runner) — phase from real match state
```

## 3. Dependencies (no new packages added)

react, next, tailwind, lucide-react, @supabase/supabase-js (Realtime for remote control), three/@react-three/* (present,
not used here), edge-tts-universal (TTS route, not used here). External: ESPN public site API (no key), local MediaMTX
WHIP gateway for streaming.

## 4. Keyboard map (unchanged, documented)

Football stage (capture phase, only when the studio is visible): `1–9` scoreboard of numbered match (again = hide),
`0` hide all, assignable letters (default M J C A E P O K), in *Preparar* `Space` TAKE / `Enter` TAKE with fade.
Studio: `Space`/`Enter` take, `Shift+F` fade to black, `R` record, `F1–F5` football graphics, `Shift+1..9` overlays,
`1–9` preview scene (when the football stage is not capturing), `Delete` removes selection, arrows nudge,
`Esc` retire all. The new production room adds **no single-key shortcuts** (avoids collisions); its actions are buttons
and remote commands.

## 5. Responsive breakpoints

`< 768` mobile control (remote or local), `768–1279` tablet production, `≥ 1280` desktop control room.
