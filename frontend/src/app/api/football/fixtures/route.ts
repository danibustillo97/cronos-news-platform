import { NextResponse } from "next/server";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";
// A 30-day search fans out one request per day; keep the burst on ESPN bounded.
const UPSTREAM_CONCURRENCY = 6;

async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function team(competitor: any) {
  const t = competitor?.team ?? {};
  return {
    id: String(t.id ?? ""),
    name: t.displayName ?? t.name ?? "",
    short: t.abbreviation ?? "",
    logo: t.logo ?? "",
    color: t.color ? `#${t.color}` : "#222222",
    alt: t.alternateColor ? `#${t.alternateColor}` : "#ffffff",
    score: Number(competitor?.score ?? 0) || 0,
    form: competitor?.form ?? "",
    record: competitor?.records?.[0]?.summary ?? "",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league") ?? "";
  if (!/^[a-z0-9.]+$/i.test(league)) return NextResponse.json({ error: "Liga inválida" }, { status: 400 });
  const dates = searchParams.get("dates");
  const match = dates?.match(/^(\d{8})(?:-(\d{8}))?$/);
  // ESPN rejects date ranges for several leagues, so ranges are fanned out one day at a time (max 40).
  const days: string[] = [];
  if (match) {
    const parse = (value: string) => new Date(Date.UTC(+value.slice(0, 4), +value.slice(4, 6) - 1, +value.slice(6, 8)));
    const start = parse(match[1]);
    const end = match[2] ? parse(match[2]) : start;
    for (let day = start; day <= end && days.length < 40; day = new Date(day.getTime() + 86400000)) {
      days.push(day.toISOString().slice(0, 10).replace(/-/g, ""));
    }
  }
  try {
    const queries = days.length ? days.map((day) => `?dates=${day}`) : [""];
    const results = await mapLimited(queries, UPSTREAM_CONCURRENCY, async (query) => {
      try {
        const response = await fetch(`${ESPN}/${league}/scoreboard${query}`, { next: { revalidate: 30 } });
        if (!response.ok) return { events: [] as any[], leagues: [] as any[], failed: true };
        return { ...(await response.json()), failed: false };
      } catch {
        return { events: [] as any[], leagues: [] as any[], failed: true };
      }
    });
    if (results.every((item) => item.failed)) throw new Error("ESPN no respondió");
    const seen = new Set<string>();
    const events = results.flatMap((item) => item.events ?? []).filter((event: any) => !seen.has(String(event.id)) && seen.add(String(event.id)));
    const data = { events, leagues: results.find((item) => item.leagues?.length)?.leagues ?? [] };
    const fixtures = (data.events ?? []).map((event: any) => {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors ?? [];
      const home = competitors.find((item: any) => item.homeAway === "home") ?? competitors[0];
      const away = competitors.find((item: any) => item.homeAway === "away") ?? competitors[1];
      return {
        id: String(event.id),
        league,
        date: event.date,
        state: event.status?.type?.state ?? "pre",
        detail: event.status?.type?.shortDetail ?? "",
        venue: competition?.venue?.fullName ?? "",
        home: team(home),
        away: team(away),
      };
    });
    return NextResponse.json({ league: data.leagues?.[0]?.name ?? league, fixtures });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error consultando partidos" }, { status: 502 });
  }
}
