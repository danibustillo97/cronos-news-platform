"use client";

import { planSync } from "./autoSync";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { FootballHighlight, FootballScoreboard, FootballTeamPlayer } from "../graphicExport";
import { COMPETITIONS, getCompetition } from "./competitions";
import { logoToDataUrl } from "./raster";
import { clockSecondsAt } from "./clock";
import { planTimeline, type TimelineAction, type TimelineEvent, type TimelineSuggestion } from "./timeline";
import { loadLatestFootballBroadcast, saveFootballBroadcast } from "@/lib/footballBroadcastStorage";

export interface Fixture {
  id: string;
  league: string;
  date: string;
  state: "pre" | "in" | "post";
  detail: string;
  venue: string;
  home: TeamInfo;
  away: TeamInfo;
}

export interface TeamInfo {
  id: string;
  name: string;
  short: string;
  logo: string;
  color: string;
  alt: string;
  score: number;
  form: string;
  record: string;
}

export interface MatchEvent {
  id: string;
  kind: "goal" | "yellow" | "red" | "sub";
  team: "home" | "away";
  minute: number;
  player: string;
  detail?: string;
  voided?: boolean;
}

export interface AuditEntry {
  id: string;
  action: string;
  team?: "home" | "away";
  minute: number;
  createdAt: string;
}

const STORAGE_KEY = "nexus-football-match-v2";
const PERIOD_START: Record<FootballScoreboard["period"], number> = { PRE: 0, "1T": 0, HT: 2700, "2T": 2700, ET: 5400, PEN: 7200, FT: 5400 };

export function createMatch(): FootballScoreboard {
  const theme = getCompetition("libertadores");
  return {
    homeTeam: "LOCAL",
    awayTeam: "VISITANTE",
    homeShort: "LOC",
    awayShort: "VIS",
    homeColor: "#1d4ed8",
    awayColor: "#b91c1c",
    homeScore: 0,
    awayScore: 0,
    period: "PRE",
    clockSeconds: 0,
    addedTime: 0,
    homeYellow: 0,
    awayYellow: 0,
    homeRed: 0,
    awayRed: 0,
    homeSubstitutions: 0,
    awaySubstitutions: 0,
    homePossession: 50,
    awayPossession: 50,
    homeShots: 0,
    awayShots: 0,
    competitionId: theme.id,
    competition: theme.name,
    matchStatus: "scheduled",
  };
}

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

interface Persisted {
  match: FootballScoreboard;
  events: MatchEvent[];
  audit: AuditEntry[];
  fixture?: { league: string; id: string } | null;
  /** When the running clock last started (epoch ms); null while stopped. */
  clockStartedAt?: number | null;
  /** ESPN key events already applied or dismissed, so they are not suggested again. */
  espnHandled?: string[];
  /** When this copy was written; decides between the browser copy and the cloud copy. */
  savedAt?: string;
}

export type CloudStatus = "checking" | "off" | "saving" | "saved" | "error";
const CLOUD_DEBOUNCE_MS = 3000;

/** Newer of two saved copies (a copy without a date always loses). */
export function newerCopy<T extends { savedAt?: string }>(local: T | null, remote: T | null): "local" | "remote" | null {
  if (!local && !remote) return null;
  if (!remote) return "local";
  if (!local) return "remote";
  return Date.parse(remote.savedAt ?? "") > Date.parse(local.savedAt ?? "") ? "remote" : "local";
}

export function useFootballMatch() {
  const [match, setMatchState] = useState<FootballScoreboard>(createMatch);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  // match.clockSeconds holds the time at the last start/stop; the clock runs while clockStartedAt is set.
  const [clockStartedAt, setClockStartedAtState] = useState<number | null>(null);
  const running = clockStartedAt !== null;
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const matchRef = useRef(match);
  matchRef.current = match;
  const startedAtRef = useRef<number | null>(null);
  const setClockStartedAt = (value: number | null) => {
    startedAtRef.current = value;
    setClockStartedAtState(value);
  };
  /** Current match time in seconds, derived on demand. */
  const clockNow = useCallback(() => clockSecondsAt(matchRef.current.clockSeconds, startedAtRef.current, Date.now()), []);
  const fixtureRef = useRef<{ league: string; id: string } | null>(null);
  const [cloud, setCloud] = useState<{ status: CloudStatus; savedAt?: string }>({ status: "checking" });
  const cloudIdRef = useRef<string | null>(null);
  const cloudErrorShownRef = useRef(false);
  // ESPN live timeline: suggestions the operator applies or dismisses (optionally goals/cards apply alone).
  const [fixtureKey, setFixtureKey] = useState<string | null>(null);
  const [espnSync, setEspnSync] = useState({ enabled: true, auto: false });
  // Automatic mode (default): score, clock, period, cards and events follow the live match by themselves.
  const [autoMode, setAutoMode] = useState(true);
  const [autoStatus, setAutoStatus] = useState<{ at: number; ok: boolean; text: string } | null>(null);
  const [espnPending, setEspnPending] = useState<TimelineSuggestion[]>([]);
  const handledRef = useRef(new Set<string>());
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const apply = (saved: Persisted) => {
    setMatchState({ ...createMatch(), ...saved.match, highlight: undefined });
    setEvents(saved.events ?? []);
    setAudit(saved.audit ?? []);
    fixtureRef.current = saved.fixture ?? null;
    setFixtureKey(saved.fixture ? `${saved.fixture.league}:${saved.fixture.id}` : null);
    handledRef.current = new Set(saved.espnHandled ?? []);
    // A clock that was running keeps counting through a reload, as it does on the pitch.
    setClockStartedAt(typeof saved.clockStartedAt === "number" ? saved.clockStartedAt : null);
  };

  // The browser copy loads at once; the cloud copy (another device, a cleared browser) wins if newer.
  useEffect(() => {
    let local: Persisted | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) local = JSON.parse(raw) as Persisted;
    } catch {
      toast.error("No se pudo recuperar el partido guardado");
    }
    if (local) apply(local);
    setReady(true);
    let cancelled = false;
    loadLatestFootballBroadcast<Persisted>()
      .then((remote) => {
        if (cancelled) return;
        if (!remote) { setCloud({ status: "off" }); return; }
        cloudIdRef.current = remote.id;
        if (newerCopy(local, remote.payload) === "remote") {
          apply(remote.payload);
          toast.info("Partido recuperado de la nube", { description: `${remote.payload.match.homeTeam} vs ${remote.payload.match.awayTeam}` });
        }
        setCloud({ status: "saved", savedAt: remote.payload.savedAt });
      })
      .catch(() => { if (!cancelled) setCloud({ status: "error" }); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const snapshot = (): Persisted => ({
      match: { ...match, highlight: undefined },
      events,
      audit,
      fixture: fixtureRef.current,
      clockStartedAt,
      espnHandled: [...handledRef.current].slice(-300),
      savedAt: new Date().toISOString(),
    });
    const local = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
      } catch {
        toast.error("No se pudo guardar el partido en este navegador");
      }
    }, 400);
    // The cloud copy waits until the startup comparison is done, so it never overwrites a newer one.
    const remote = cloud.status === "checking" ? 0 : window.setTimeout(() => {
      const payload = snapshot();
      setCloud((current) => ({ ...current, status: "saving" }));
      saveFootballBroadcast(cloudIdRef.current, `${payload.match.homeTeam} vs ${payload.match.awayTeam}`, payload.match.competition ?? "", payload)
        .then((id) => {
          if (!id) { setCloud({ status: "off" }); return; }
          cloudIdRef.current = id;
          cloudErrorShownRef.current = false;
          setCloud({ status: "saved", savedAt: payload.savedAt });
        })
        .catch(() => {
          setCloud((current) => ({ ...current, status: "error" }));
          if (!cloudErrorShownRef.current) {
            cloudErrorShownRef.current = true;
            toast.warning("No se pudo guardar el partido en la nube", { description: "Sigue guardado en este navegador; se reintenta con el próximo cambio." });
          }
        });
    }, CLOUD_DEBOUNCE_MS);
    return () => { window.clearTimeout(local); if (remote) window.clearTimeout(remote); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, events, audit, clockStartedAt, ready, cloud.status === "checking"]);

  const setMatch = useCallback((patch: Partial<FootballScoreboard>) => setMatchState((current) => ({ ...current, ...patch })), []);

  const minute = () => Math.floor(clockNow() / 60);
  const log = (action: string, team?: "home" | "away") =>
    setAudit((current) => [...current.slice(-199), { id: newId("audit"), action, team, minute: minute(), createdAt: new Date().toISOString() }]);

  const showHighlight = (highlight: FootballHighlight) => setMatchState((current) => ({ ...current, highlight }));

  const setPeriod = useCallback((period: FootballScoreboard["period"]) => {
    setClockStartedAt(period === "1T" || period === "2T" || period === "ET" ? Date.now() : null);
    setMatchState((current) => ({
      ...current,
      period,
      clockSeconds: PERIOD_START[period],
      addedTime: 0,
      matchStatus: period === "PRE" ? "scheduled" : period === "HT" ? "halftime" : period === "FT" ? "finished" : "live",
    }));
    log(`period_${period}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleClock = useCallback(() => {
    const current = matchRef.current;
    if (current.period === "PRE" || current.period === "HT" || current.period === "FT") {
      toast.info("Elige un periodo de juego para iniciar el reloj");
      return;
    }
    if (startedAtRef.current === null) {
      setClockStartedAt(Date.now());
    } else {
      // Pausing folds the elapsed run into the base time.
      const seconds = clockNow();
      setClockStartedAt(null);
      setMatchState((state) => ({ ...state, clockSeconds: seconds }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetClock = useCallback(() => {
    setClockStartedAt(null);
    setMatchState((current) => ({ ...current, clockSeconds: PERIOD_START[current.period] }));
  }, []);

  const addGoal = useCallback((team: "home" | "away", player = "", atMinute?: number, detail?: string) => {
    const m = matchRef.current;
    const event: MatchEvent = { id: newId("event"), kind: "goal", team, minute: atMinute ?? minute(), player: player || (team === "home" ? m.homeTeam : m.awayTeam), detail };
    setEvents((current) => [...current, event]);
    setMatchState((current) => ({
      ...current,
      [team === "home" ? "homeScore" : "awayScore"]: current[team === "home" ? "homeScore" : "awayScore"] + 1,
      highlight: { kind: "goal", team, player: event.player, minute: event.minute },
    }));
    log("goal_added", team);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undoGoal = useCallback(() => {
    setEvents((current) => {
      const index = [...current].reverse().findIndex((event) => event.kind === "goal" && !event.voided);
      if (index < 0) {
        toast.info("No hay goles para anular");
        return current;
      }
      const target = current[current.length - 1 - index];
      setMatchState((state) => ({
        ...state,
        [target.team === "home" ? "homeScore" : "awayScore"]: Math.max(0, state[target.team === "home" ? "homeScore" : "awayScore"] - 1),
        highlight: { kind: "void", team: target.team, player: target.player, minute: target.minute, detail: "Gol anulado" },
      }));
      setAudit((entries) => [...entries.slice(-199), { id: newId("audit"), action: "goal_undone", team: target.team, minute: minute(), createdAt: new Date().toISOString() }]);
      toast.success("Gol anulado", { description: `${target.player} · ${target.minute}'` });
      return current.map((event) => (event.id === target.id ? { ...event, voided: true } : event));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- minute() only reads refs
  }, []);

  // Voids any logged event (a card or a change entered by mistake) and reverts its counter.
  const voidEvent = useCallback((eventId: string) => {
    setEvents((current) => {
      const target = current.find((event) => event.id === eventId && !event.voided);
      if (!target) return current;
      if (target.kind === "goal") {
        const key = target.team === "home" ? "homeScore" : "awayScore";
        setMatchState((state) => ({ ...state, [key]: Math.max(0, state[key] - 1), highlight: { kind: "void", team: target.team, player: target.player, minute: target.minute, detail: "Gol anulado" } }));
      } else {
        const key = target.kind === "sub"
          ? (target.team === "home" ? "homeSubstitutions" : "awaySubstitutions")
          : (`${target.team}${target.kind === "yellow" ? "Yellow" : "Red"}` as "homeYellow" | "awayYellow" | "homeRed" | "awayRed");
        setMatchState((state) => ({ ...state, [key]: Math.max(0, (state[key] ?? 0) - 1) }));
      }
      setAudit((entries) => [...entries.slice(-199), { id: newId("audit"), action: `${target.kind}_voided`, team: target.team, minute: minute(), createdAt: new Date().toISOString() }]);
      toast.success("Evento anulado", { description: `${target.player} · ${target.minute}'` });
      return current.map((event) => (event.id === target.id ? { ...event, voided: true } : event));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- minute() only reads refs
  }, []);

  const addCard = useCallback((team: "home" | "away", kind: "yellow" | "red", player = "", atMinute?: number) => {
    const m = matchRef.current;
    const key = `${team}${kind === "yellow" ? "Yellow" : "Red"}` as "homeYellow" | "awayYellow" | "homeRed" | "awayRed";
    const event: MatchEvent = { id: newId("event"), kind, team, minute: atMinute ?? minute(), player: player || (team === "home" ? m.homeTeam : m.awayTeam) };
    setEvents((current) => [...current, event]);
    setMatchState((current) => ({ ...current, [key]: current[key] + 1, highlight: { kind, team, player: event.player, minute: event.minute } }));
    log(`${kind}_card`, team);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSubstitution = useCallback((team: "home" | "away", playerOut: string, playerIn: string, atMinute?: number) => {
    const event: MatchEvent = { id: newId("event"), kind: "sub", team, minute: atMinute ?? minute(), player: playerIn || "Entra", detail: playerOut ? `Sale ${playerOut}` : undefined };
    setEvents((current) => [...current, event]);
    const key = team === "home" ? "homeSubstitutions" : "awaySubstitutions";
    setMatchState((current) => ({ ...current, [key]: (current[key] ?? 0) + 1, highlight: { kind: "sub", team, player: event.player, minute: event.minute, detail: event.detail } }));
    log("substitution", team);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showVar = useCallback((detail: string, team: "home" | "away" = "home") => {
    showHighlight({ kind: "var", team, player: detail, minute: minute(), detail });
    log("var", team);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showPlayer = useCallback((team: "home" | "away", player: string, minuteValue: number, detail?: string) => {
    showHighlight({ kind: "goal", team, player, minute: minuteValue, detail });
  }, []);

  const loadSquads = useCallback(async (league: string, home: { id: string; name: string }, away: { id: string; name: string }) => {
    try {
      const fetchSquad = async (team: { id: string; name: string }) => {
        const response = await fetch(`/api/football/squad?league=${encodeURIComponent(league)}&team=${team.id}&name=${encodeURIComponent(team.name)}`);
        if (!response.ok) return { source: null as string | null, players: [] as FootballTeamPlayer[] };
        return await response.json() as { source: string | null; players: FootballTeamPlayer[] };
      };
      const [h, a] = await Promise.all([fetchSquad(home), fetchSquad(away)]);
      setMatchState((current) => ({ ...current, squads: { home: h.players, away: a.players } }));
      if (h.players.length || a.players.length) toast.success(`Plantillas cargadas (${h.players.length} + ${a.players.length})`, { description: `Fuente: ${h.source ?? a.source}` });
      else toast.info("No se encontraron plantillas en las fuentes disponibles");
    } catch {
      toast.error("No se pudieron cargar las plantillas");
    }
  }, []);

  const loadFixture = useCallback(async (fixture: Fixture, competitionId: string) => {
    const theme = getCompetition(competitionId);
    setClockStartedAt(null);
    setLoading(true);
    fixtureRef.current = { league: fixture.league, id: fixture.id };
    setFixtureKey(`${fixture.league}:${fixture.id}`);
    handledRef.current = new Set();
    setEspnPending([]);
    setEvents([]);
    setMatchState({
      ...createMatch(),
      competitionId: theme.id,
      competition: theme.name,
      homeTeam: fixture.home.name,
      awayTeam: fixture.away.name,
      homeShort: fixture.home.short,
      awayShort: fixture.away.short,
      homeColor: fixture.home.color,
      awayColor: fixture.away.color,
      homeForm: fixture.home.form,
      awayForm: fixture.away.form,
      homeRecord: fixture.home.record,
      awayRecord: fixture.away.record,
      kickoff: fixture.date,
      venue: fixture.venue,
    });
    log("fixture_loaded");
    void loadSquads(fixture.league, fixture.home, fixture.away);
    try {
      const [homeLogo, awayLogo] = await Promise.all([
        fixture.home.logo ? logoToDataUrl(fixture.home.logo).catch(() => "") : "",
        fixture.away.logo ? logoToDataUrl(fixture.away.logo).catch(() => "") : "",
      ]);
      setMatchState((current) => ({ ...current, homeLogo: homeLogo || undefined, awayLogo: awayLogo || undefined }));
      const response = await fetch(`/api/football/match?league=${encodeURIComponent(fixture.league)}&event=${fixture.id}`);
      if (response.ok) {
        const detail = await response.json();
        setMatchState((current) => ({
          ...current,
          venue: detail.venue || current.venue,
          city: detail.city,
          referee: detail.referee,
          lineups: detail.lineups,
          formationHome: detail.formation?.home,
          formationAway: detail.formation?.away,
          stats: detail.stats,
          preview: detail.preview ?? current.preview,
        }));
        const noLineups = !detail.lineups?.home?.length;
        toast.success(`${fixture.home.name} vs ${fixture.away.name} cargado`, { description: noLineups ? "Alineaciones aún no publicadas: se actualizan cerca del inicio." : "Alineaciones y estadísticas incluidas." });
      }
    } catch (error) {
      toast.error("Partido cargado con datos incompletos", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshDetail = useCallback(async (silent = false) => {
    const ref = fixtureRef.current;
    if (!ref) {
      if (!silent) toast.info("Carga un partido de la lista para actualizar sus datos");
      return;
    }
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/football/match?league=${encodeURIComponent(ref.league)}&event=${ref.id}`);
      if (!response.ok) throw new Error("ESPN no respondió");
      const detail = await response.json();
      setMatchState((current) => ({
        ...current,
        lineups: detail.lineups?.home?.length ? detail.lineups : current.lineups,
        formationHome: detail.formation?.home || current.formationHome,
        formationAway: detail.formation?.away || current.formationAway,
        stats: detail.stats?.length ? detail.stats : current.stats,
        referee: detail.referee || current.referee,
        preview: detail.preview ?? current.preview,
      }));
      if (!silent) toast.success("Datos del partido actualizados");
    } catch (error) {
      if (!silent) toast.error("No se pudieron actualizar los datos", { description: error instanceof Error ? error.message : undefined });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Cerca del inicio y durante el partido: refresco automático de alineaciones y estadísticas.
  const kickoffAt = match.kickoff;
  const period = match.period;
  useEffect(() => {
    if (!kickoffAt || period === "FT") return;
    const untilKickoff = new Date(kickoffAt).getTime() - Date.now();
    if (Number.isNaN(untilKickoff) || untilKickoff > 3 * 3600000) return;
    const timer = window.setInterval(() => void refreshDetail(true), period === "PRE" ? 120000 : 45000);
    return () => window.clearInterval(timer);
  }, [kickoffAt, period, refreshDetail]);

  const applyAction = (action: TimelineAction) => {
    if (action.type === "goal") addGoal(action.team, action.player, action.minute, action.detail);
    else if (action.type === "card") addCard(action.team, action.card, action.player, action.minute);
    else addSubstitution(action.team, action.playerOut, action.playerIn, action.minute);
  };
  const applySuggestion = (id: string) => {
    const item = espnPending.find((entry) => entry.event.id === id);
    if (!item) return;
    handledRef.current.add(id);
    applyAction(item.action);
    setEspnPending((current) => current.filter((entry) => entry.event.id !== id));
  };
  const dismissSuggestion = (id: string) => {
    handledRef.current.add(id);
    setEspnPending((current) => current.filter((entry) => entry.event.id !== id));
  };
  const applyAllSuggestions = () => {
    espnPending.forEach((item) => { handledRef.current.add(item.event.id); applyAction(item.action); });
    setEspnPending([]);
  };
  const applyRef = useRef(applyAction);
  applyRef.current = applyAction;

  const inPlay = match.period !== "PRE" && match.period !== "FT";
  useEffect(() => {
    const ref = fixtureRef.current;
    if (!fixtureKey || !ref || !espnSync.enabled || !inPlay || autoMode) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/football/timeline?league=${encodeURIComponent(ref.league)}&event=${encodeURIComponent(ref.id)}`);
        if (!response.ok || cancelled) return;
        const data = await response.json() as { events?: TimelineEvent[] };
        if (cancelled) return;
        const plan = planTimeline(data.events ?? [], handledRef.current, eventsRef.current);
        const now = espnSync.auto ? plan.filter((item) => item.auto) : [];
        now.forEach((item) => { handledRef.current.add(item.event.id); applyRef.current(item.action); });
        if (now.length) toast.success(`ESPN: ${now.length} evento(s) aplicado(s)`);
        setEspnPending(plan.filter((item) => !now.includes(item)));
      } catch {
        // ESPN unavailable for a moment: the next poll retries.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 20000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [fixtureKey, espnSync.enabled, espnSync.auto, inPlay, autoMode]);

  // AUTOMATIC MODE: every 15 s the scoreboard copies the live match. The first sync of a match
  // only sets the state (no animation flood); later NEW goals/cards/subs are animated on air.
  const goalRef = useRef(addGoal);
  goalRef.current = addGoal;
  const cardRef = useRef(addCard);
  cardRef.current = addCard;
  const subRef = useRef(addSubstitution);
  subRef.current = addSubstitution;
  useEffect(() => {
    const ref = fixtureRef.current;
    if (!fixtureKey || !ref || !autoMode) return;
    let cancelled = false;
    let first = true;
    const sync = async () => {
      try {
        const response = await fetch(`/api/matches/${encodeURIComponent(ref.league)}/${encodeURIComponent(ref.id)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const detail = await response.json();
        if (cancelled) return;
        const plan = planSync(detail, handledRef.current);
        if (first) {
          plan.eventIds.forEach((id) => handledRef.current.add(id));
        } else {
          for (const e of plan.newEvents) {
            handledRef.current.add(e.id);
            if (e.kind === "goal") goalRef.current(e.team, e.player, e.minute, e.detail);
            else if (e.kind === "sub") subRef.current(e.team, "", e.player, e.minute);
            else cardRef.current(e.team, e.kind, e.player, e.minute);
          }
        }
        first = false;
        setClockStartedAt(plan.running ? Date.now() : null);
        setMatchState((current) => ({
          ...current,
          period: plan.period, clockSeconds: plan.clockSeconds, addedTime: plan.addedTime,
          homeScore: plan.homeScore, awayScore: plan.awayScore,
          homeYellow: plan.homeYellow, awayYellow: plan.awayYellow, homeRed: plan.homeRed, awayRed: plan.awayRed,
          matchStatus: plan.period === "FT" ? "finished" : plan.period === "HT" ? "halftime" : plan.period === "PRE" ? "scheduled" : "live",
        }));
        setAutoStatus({ at: Date.now(), ok: true, text: detail.state === "in" ? `En vivo · ${detail.clock}` : detail.statusText || "Sincronizado" });
      } catch (error) {
        if (!cancelled) setAutoStatus({ at: Date.now(), ok: false, text: error instanceof Error ? error.message : "Sin conexión" });
      }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureKey, autoMode]);

  const newMatch = useCallback(() => {
    setClockStartedAt(null);
    fixtureRef.current = null;
    setFixtureKey(null);
    handledRef.current = new Set();
    setEspnPending([]);
    setMatchState(createMatch());
    setEvents([]);
    setAudit([]);
  }, []);

  return {
    match, events, audit, running, clockStartedAt, clockNow, loading, cloud,
    fixture: fixtureKey ? fixtureRef.current : null,
    hasFixture: fixtureKey !== null, espnSync, setEspnSync, espnPending, applySuggestion, dismissSuggestion, applyAllSuggestions,
    autoMode, setAutoMode, autoStatus,
    setMatch, setPeriod, toggleClock, resetClock, addGoal, undoGoal, voidEvent, addCard, addSubstitution,
    showPlayer, showVar, loadFixture, refreshDetail, newMatch,
    clearHighlight: () => setMatchState((current) => ({ ...current, highlight: undefined })),
    competitions: COMPETITIONS,
  };
}

export type FootballMatchController = ReturnType<typeof useFootballMatch>;
