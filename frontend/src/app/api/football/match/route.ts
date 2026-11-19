import { NextResponse } from "next/server";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";

const STAT_LABELS: Record<string, string> = {
  possessionPct: "Posesión %",
  totalShots: "Remates",
  shotsOnTarget: "A puerta",
  wonCorners: "Córners",
  foulsCommitted: "Faltas",
  offsides: "Fueras de juego",
  saves: "Atajadas",
  passPct: "Pases %",
};

function position(abbreviation: string | undefined) {
  const value = (abbreviation ?? "").toUpperCase();
  if (value === "G" || value === "GK") return "POR";
  if (/^(CB|LB|RB|D|SW|LWB|RWB)/.test(value)) return "DEF";
  if (/^(F|ST|CF|LW|RW|SS|A)/.test(value)) return "ATA";
  return "MED";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league") ?? "";
  const event = searchParams.get("event") ?? "";
  if (!/^[a-z0-9.]+$/i.test(league) || !/^\d+$/.test(event)) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  try {
    const response = await fetch(`${ESPN}/${league}/summary?event=${event}`, { next: { revalidate: 15 } });
    if (!response.ok) throw new Error(`ESPN respondió ${response.status}`);
    const data = await response.json();
    const rosters: any[] = data.rosters ?? [];
    const side = (homeAway: string) => rosters.find((item) => item.homeAway === homeAway);
    const players = (roster: any) =>
      (roster?.roster ?? []).map((entry: any) => ({
        name: entry.athlete?.displayName ?? "",
        dorsal: Number(entry.jersey) || 0,
        position: position(entry.position?.abbreviation),
        starter: Boolean(entry.starter),
        captain: false,
      }));
    const teams: any[] = data.boxscore?.teams ?? [];
    const statValue = (item: any, name: string) => Number(item?.statistics?.find((stat: any) => stat.name === name)?.displayValue) || 0;
    const homeTeam = teams.find((item) => item.homeAway === "home") ?? teams[0];
    const awayTeam = teams.find((item) => item.homeAway === "away") ?? teams[1];
    const stats = Object.entries(STAT_LABELS)
      .map(([key, label]) => ({ label, home: statValue(homeTeam, key), away: statValue(awayTeam, key) }))
      .filter((item) => item.home || item.away);
    const info = data.gameInfo ?? {};
    const odds = data.pickcenter?.[0];
    const homeId = String(homeTeam?.team?.id ?? "");
    const past = (entry: any) => (entry?.events ?? []).slice(0, 5).map((game: any) => ({
      date: game.gameDate ?? "",
      opponent: game.opponent?.displayName ?? "",
      score: game.score ?? "",
      result: game.gameResult === "W" || game.gameResult === "L" || game.gameResult === "D" ? game.gameResult : "",
      competition: String(game.competitionName ?? "").replace(/^\d{4}\s*/, "").trim(),
      home: game.atVs !== "@",
    }));
    const lastFive = data.lastFiveGames ?? [];
    const lastFor = (id: string) => lastFive.find((item: any) => String(item.team?.id) === id);
    const awayId = String(awayTeam?.team?.id ?? "");
    const series = data.seasonseries?.[0];
    const implied = (ml: unknown) => {
      const value = Number(ml);
      if (!Number.isFinite(value) || value === 0) return 0;
      return value > 0 ? 100 / (value + 100) : -value / (-value + 100);
    };
    const probs = odds ? [implied(odds.homeTeamOdds?.moneyLine), implied(odds.drawOdds?.moneyLine), implied(odds.awayTeamOdds?.moneyLine)] : [0, 0, 0];
    const probSum = probs.reduce((a, b) => a + b, 0);
    const leaderList = (teamId: string) => {
      const block = (data.leaders ?? []).find((item: any) => String(item.team?.id) === teamId);
      const wanted: Record<string, string> = { goalsLeaders: "Goles", assistsLeaders: "Asistencias", saves: "Atajadas" };
      return (block?.leaders ?? [])
        .filter((item: any) => wanted[item.name] && item.leaders?.[0])
        .map((item: any) => ({ name: item.leaders[0].athlete?.displayName ?? "", label: wanted[item.name], value: String(item.leaders[0].mainStat?.value ?? "") }));
    };
    const preview = {
      lastFive: { home: past(lastFor(homeId)), away: past(lastFor(awayId)) },
      h2h: {
        summary: series?.summary ?? "",
        games: (series?.events ?? []).slice(0, 5).map((game: any) => {
          const h = game.competitors?.find((item: any) => item.homeAway === "home");
          const a = game.competitors?.find((item: any) => item.homeAway === "away");
          return { date: game.date ?? "", home: h?.team?.displayName ?? "", away: a?.team?.displayName ?? "", score: `${h?.score ?? "-"}-${a?.score ?? "-"}` };
        }),
      },
      odds: odds && probSum > 0 ? {
        provider: odds.provider?.name ?? "",
        home: Math.round((probs[0] / probSum) * 100),
        draw: Math.round((probs[1] / probSum) * 100),
        away: Math.round((probs[2] / probSum) * 100),
        overUnder: Number(odds.overUnder) || 0,
      } : null,
      leaders: { home: leaderList(homeId), away: leaderList(awayId) },
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json({
      venue: info.venue?.fullName ?? "",
      city: info.venue?.address?.city ?? "",
      attendance: Number(info.attendance) || 0,
      referee: info.officials?.[0]?.displayName ?? "",
      broadcast: (data.broadcasts ?? []).map((item: any) => item.media?.shortName).filter(Boolean).join(", "),
      lineups: { home: players(side("home")), away: players(side("away")) },
      formation: { home: side("home")?.formation ?? "", away: side("away")?.formation ?? "" },
      stats,
      odds: odds ? { details: odds.details ?? "", overUnder: String(odds.overUnder ?? "") } : null,
      preview,
      headlines: (data.news?.articles ?? []).slice(0, 4).map((item: any) => item.headline).filter(Boolean),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error consultando el partido" }, { status: 502 });
  }
}
