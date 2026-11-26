import { NextResponse } from "next/server";
import { buildRecapMatch, type EspnSummaryLite } from "@/components/admin/Broadcaster/football/recap";

// Standings of the group/league where a match is played (ESPN summary), for the
// "Tabla de posiciones" graphic. GET /api/football/table?league=col.1&event=123
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league") ?? "";
  const event = searchParams.get("event") ?? "";
  if (!/^[a-z0-9.]+$/i.test(league) || !/^\d+$/.test(event)) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  try {
    const res = await fetch(`${ESPN}/${league}/summary?event=${event}`, { next: { revalidate: 120 } });
    if (!res.ok) throw new Error(`ESPN respondió ${res.status}`);
    const m = buildRecapMatch(league, (await res.json()) as EspnSummaryLite);
    if (!m || !m.table.length) return NextResponse.json({ available: false, rows: [] });
    return NextResponse.json({ available: true, name: m.tableName ?? m.leagueName, league, highlight: [m.home.id, m.away.id], rows: m.table, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error consultando la tabla" }, { status: 502 });
  }
}
