"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { FootballHighlight, FootballScoreboard, FootballTeamPlayer } from "../graphicExport";
import { COMPETITIONS, getCompetition } from "./competitions";
import { logoToDataUrl } from "./raster";

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
}

export function useFootballMatch() {
  const [match, setMatchState] = useState<FootballScoreboard>(createMatch);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const matchRef = useRef(match);
  matchRef.current = match;
  const fixtureRef = useRef<{ league: string; id: string } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Persisted;
        setMatchState({ ...createMatch(), ...saved.match, highlight: undefined });
        setEvents(saved.events ?? []);
        setAudit(saved.audit ?? []);
        fixtureRef.current = saved.fixture ?? null;
      }
    } catch {
      toast.error("No se pudo recuperar el partido guardado");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ match, events, audit, fixture: fixtureRef.current } satisfies Persisted));
      } catch {
        toast.error("No se pudo guardar el partido en este navegador");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [match, events, audit, ready]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setMatchState((current) => ({ ...current, clockSeconds: current.clockSeconds + 1 })), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const setMatch = useCallback((patch: Partial<FootballScoreboard>) => setMatchState((current) => ({ ...current, ...patch })), []);

  const minute = () => Math.floor(matchRef.current.clockSeconds / 60);
  const log = (action: string, team?: "home" | "away") =>
    setAudit((current) => [...current.slice(-199), { id: newId("audit"), action, team, minute: minute(), createdAt: new Date().toISOString() }]);

  const showHighlight = (highlight: FootballHighlight) => setMatchState((current) => ({ ...current, highlight }));

  const setPeriod = useCallback((period: FootballScoreboard["period"]) => {
    setRunning(false);
    setMatchState((current) => ({
      ...current,
      period,
      clockSeconds: PERIOD_START[period],
      addedTime: 0,
      matchStatus: period === "PRE" ? "scheduled" : period === "HT" ? "halftime" : period === "FT" ? "finished" : "live",
    }));
    log(`period_${period}`);
    if (period === "1T" || period === "2T" || period === "ET") setRunning(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleClock = useCallback(() => {
    const current = matchRef.current;
    if (current.period === "PRE" || current.period === "HT" || current.period === "FT") {
      toast.info("Elige un periodo de juego para iniciar el reloj");
      return;
    }
    setRunning((value) => !value);
  }, []);

  const resetClock = useCallback(() => {
    setRunning(false);
    setMatchState((current) => ({ ...current, clockSeconds: PERIOD_START[current.period] }));
  }, []);

  const addGoal = useCallback((team: "home" | "away", player = "") => {
    const m = matchRef.current;
    const event: MatchEvent = { id: newId("event"), kind: "goal", team, minute: minute(), player: player || (team === "home" ? m.homeTeam : m.awayTeam) };
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
      setAudit((entries) => [...entries.slice(-199), { id: newId("audit"), action: "goal_undone", team: target.team, minute: Math.floor(matchRef.current.clockSeconds / 60), createdAt: new Date().toISOString() }]);
      toast.success("Gol anulado", { description: `${target.player} · ${target.minute}'` });
      return current.map((event) => (event.id === target.id ? { ...event, voided: true } : event));
    });
  }, []);

  const addCard = useCallback((team: "home" | "away", kind: "yellow" | "red", player = "") => {
    const m = matchRef.current;
    const key = `${team}${kind === "yellow" ? "Yellow" : "Red"}` as "homeYellow" | "awayYellow" | "homeRed" | "awayRed";
    const event: MatchEvent = { id: newId("event"), kind, team, minute: minute(), player: player || (team === "home" ? m.homeTeam : m.awayTeam) };
    setEvents((current) => [...current, event]);
    setMatchState((current) => ({ ...current, [key]: current[key] + 1, highlight: { kind, team, player: event.player, minute: event.minute } }));
    log(`${kind}_card`, team);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSubstitution = useCallback((team: "home" | "away", playerOut: string, playerIn: string) => {
    const event: MatchEvent = { id: newId("event"), kind: "sub", team, minute: minute(), player: playerIn || "Entra", detail: playerOut ? `Sale ${playerOut}` : undefined };
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
    setRunning(false);
    setLoading(true);
    fixtureRef.current = { league: fixture.league, id: fixture.id };
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

  const newMatch = useCallback(() => {
    setRunning(false);
    fixtureRef.current = null;
    setMatchState(createMatch());
    setEvents([]);
    setAudit([]);
  }, []);

  return {
    match, events, audit, running, loading,
    setMatch, setPeriod, toggleClock, resetClock, addGoal, undoGoal, addCard, addSubstitution,
    showPlayer, showVar, loadFixture, refreshDetail, newMatch,
    clearHighlight: () => setMatchState((current) => ({ ...current, highlight: undefined })),
    competitions: COMPETITIONS,
  };
}

export type FootballMatchController = ReturnType<typeof useFootballMatch>;
