import { NextResponse } from "next/server";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const SPORTSDB = "https://www.thesportsdb.com/api/v1/json/123";

interface Player {
  name: string;
  dorsal: number;
  position: "POR" | "DEF" | "MED" | "ATA";
  starter: boolean;
  captain: boolean;
}

function toPosition(value: string | undefined): Player["position"] {
  const text = (value ?? "").toUpperCase();
  if (/^(G|GK|GOAL|POR|ARQ)/.test(text)) return "POR";
  if (/^(CB|LB|RB|D|SW|LWB|RWB|DEF)/.test(text)) return "DEF";
  if (/^(F|ST|CF|LW|RW|SS|A|ATT|FOR|DEL)/.test(text)) return "ATA";
  return "MED";
}

async function fromEspn(league: string, team: string): Promise<Player[]> {
  const response = await fetch(`${ESPN}/${league}/teams/${team}/roster`, { next: { revalidate: 3600 } });
  if (!response.ok) return [];
  const data = await response.json();
  const raw: Array<Record<string, any>> = (data.athletes ?? []).flatMap((item: any) => (item.items ? item.items : [item]));
  return raw
    .map((item) => ({
      name: String(item.displayName ?? item.fullName ?? ""),
      dorsal: Number(item.jersey) || 0,
      position: toPosition(item.position?.abbreviation ?? item.position?.name),
      starter: false,
      captain: false,
    }))
    .filter((player) => player.name);
}

async function fromSportsDb(name: string): Promise<Player[]> {
  const search = await fetch(`${SPORTSDB}/searchteams.php?t=${encodeURIComponent(name)}`, { next: { revalidate: 3600 } });
  if (!search.ok) return [];
  const team = (await search.json()).teams?.[0];
  if (!team?.idTeam) return [];
  const squad = await fetch(`${SPORTSDB}/lookup_all_players.php?id=${team.idTeam}`, { next: { revalidate: 3600 } });
  if (!squad.ok) return [];
  const players: Array<Record<string, any>> = (await squad.json()).player ?? [];
  return players
    .map((item) => ({ name: String(item.strPlayer ?? ""), dorsal: Number(item.strNumber) || 0, position: toPosition(item.strPosition), starter: false, captain: false }))
    .filter((player) => player.name);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league") ?? "";
  const team = searchParams.get("team") ?? "";
  const name = (searchParams.get("name") ?? "").slice(0, 80);
  if (!/^[a-z0-9.]+$/i.test(league) || !/^\d+$/.test(team)) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  const attempts: Array<[string, () => Promise<Player[]>]> = [
    ["ESPN", () => fromEspn(league, team)],
    ["TheSportsDB", () => fromSportsDb(name)],
  ];
  for (const [source, load] of attempts) {
    try {
      const players = await load();
      if (players.length) {
        players.sort((a, b) => (a.dorsal || 99) - (b.dorsal || 99));
        return NextResponse.json({ source, players });
      }
    } catch {
      // try the next source
    }
  }
  return NextResponse.json({ source: null, players: [] });
}
