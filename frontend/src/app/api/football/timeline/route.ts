import { NextResponse } from "next/server";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";

type Kind = "goal" | "own-goal" | "penalty" | "yellow" | "red" | "sub" | "var" | "other";

function kindOf(type: string, item: any): Kind {
  const text = type.toLowerCase();
  if (text.includes("own goal")) return "own-goal";
  if (text.includes("penalty") && (item.scoringPlay || text.includes("goal"))) return "penalty";
  if (item.scoringPlay || text.startsWith("goal")) return "goal";
  if (text.includes("red")) return "red";
  if (text.includes("yellow")) return "yellow";
  if (text.includes("substitution")) return "sub";
  if (text.includes("var")) return "var";
  return "other";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league") ?? "";
  const event = searchParams.get("event") ?? "";
  if (!/^[a-z0-9.]+$/i.test(league) || !/^\d+$/.test(event)) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  try {
    const response = await fetch(`${ESPN}/${league}/summary?event=${event}`, { next: { revalidate: 10 } });
    if (!response.ok) throw new Error(`ESPN respondió ${response.status}`);
    const data = await response.json();
    const competitors: any[] = data.header?.competitions?.[0]?.competitors ?? [];
    const side = new Map<string, "home" | "away">();
    for (const item of competitors) side.set(String(item.team?.id ?? item.id), item.homeAway === "away" ? "away" : "home");

    const events = (data.keyEvents ?? [])
      .filter((item: any) => item.clock?.displayValue && !/kickoff|start|end|half|period/i.test(item.type?.text ?? ""))
      .map((item: any, index: number) => {
        const kind = kindOf(String(item.type?.text ?? ""), item);
        const players: string[] = (item.participants ?? []).map((p: any) => p.athlete?.displayName).filter(Boolean);
        return {
          id: String(item.id ?? index),
          minute: String(item.clock.displayValue),
          order: Number(item.clock.value) || index,
          kind,
          side: side.get(String(item.team?.id)) ?? null,
          player: players[0] ?? "",
          assist: kind === "sub" ? "" : players[1] ?? "",
          playerOut: kind === "sub" ? players[1] ?? "" : "",
          text: String(item.type?.text ?? ""),
        };
      })
      .filter((item: any) => item.kind !== "other" || item.player)
      .sort((a: any, b: any) => b.order - a.order);

    return NextResponse.json({ events, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error consultando el partido" }, { status: 502 });
  }
}
