# Mobile control

`< 768 px` shows the **mobile production control** (`MobileControl` in `engine/ProductionRoom.tsx`); `768–1279 px` the
tablet room (monitors + touch side panel: Escaleta / Automatización / Gráficos / Escenas); `≥ 1280 px` the desktop room.

Two sources, switch at the top:
- **Este equipo** — the studio running on the phone itself (its Program monitor stays on top; streaming/recording keep
  working because the canvas stays mounted).
- **Estudio PC** — remote control of the studio running on a computer. Transport (`engine/remoteControl.ts`):
  Supabase Realtime broadcast on a per-user channel when signed in (any device), otherwise `BroadcastChannel`
  (other tabs of the same device). The studio publishes its state every 1.5 s; commands carry the target studio id
  and are validated (`commandFor`) before running.

Tabs (touch targets ≥ 44 px): **Control** (on air / no transmission, REC, phase, score + data freshness, alerts,
Directo/Preparar, TAKE when preparing, Ocultar todo, what is on air, automation pause + approvals, scenes),
**Escaleta** (auto/manual, next block, run a ready block), **Eventos** (confirmed / pending / retracted),
**Gráficos** (toggle), **Audiencia** (launch poll templates, live, result, close).

Security note: the Realtime channel name is derived from the user id (admin session required to open the studio).
For hardened deployments enable Realtime *private channels* with RLS on `realtime.messages`.
