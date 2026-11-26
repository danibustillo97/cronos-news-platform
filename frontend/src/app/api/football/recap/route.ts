import { NextResponse } from "next/server";
import { buildRecapMatch, type EspnSummaryLite } from "@/components/admin/Broadcaster/football/recap";

// Recap of a matchday: every FINISHED match of the given date in the given leagues,
// with result, scorers, key stats, how the table looks now, and the narration
// sentences the automatic show puts on screen. All numbers come from ESPN.
//   GET /api/football/recap?date=YYYYMMDD&leagues=uefa.champions,col.1

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const NAMES: Record<string, string> = {
  "uefa.champions": "Champions League", "conmebol.libertadores": "Copa Libertadores", "conmebol.sudamericana": "Copa Sudamericana", "col.1": "Liga BetPlay",
  "uefa.europa": "Europa League", "esp.1": "LaLiga", "eng.1": "Premier League", "ita.1": "Serie A", "ger.1": "Bundesliga", "fra.1": "Ligue 1",
};
const DEFAULT_LEAGUES = ["uefa.champions", "conmebol.libertadores", "conmebol.sudamericana", "col.1", "uefa.europa", "esp.1", "eng.1", "ita.1", "ger.1", "fra.1"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  if (!/^\d{8}$/.test(date)) return NextResponse.json({ error: "Fecha inválida (YYYYMMDD)" }, { status: 400 });
  const leagues = (searchParams.get("leagues") ?? "").split(",").filter((l) => /^[a-z0-9.]+$/i.test(l));
  const wanted = leagues.length ? leagues : DEFAULT_LEAGUES;

  const perLeague = await Promise.all(wanted.map(async (league) => {
    try {
      const board = await fetch(`${ESPN}/${league}/scoreboard?dates=${date}`, { next: { revalidate: 300 } });
      if (!board.ok) return null;
      const data = await board.json();
      const finished = (data.events ?? []).filter((e: any) => e?.status?.type?.state === "post").slice(0, 12);
      if (!finished.length) return null;
      const matches = (await Promise.all(finished.map(async (e: any) => {
        try {
          const res = await fetch(`${ESPN}/${league}/summary?event=${e.id}`, { next: { revalidate: 600 } });
          if (!res.ok) return null;
          return buildRecapMatch(league, (await res.json()) as EspnSummaryLite);
        } catch { return null; }
      }))).filter(Boolean);
      return { league, leagueName: NAMES[league] ?? data.leagues?.[0]?.name ?? league, matches: matches.map((m: any) => ({ ...m, leagueName: NAMES[league] ?? m.leagueName })) };
    } catch { return null; }
  }));

  return NextResponse.json({ date, leagues: perLeague.filter((l) => l && l.matches.length) }, { headers: { "Cache-Control": "public, max-age=120" } });
}
