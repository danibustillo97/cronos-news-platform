// Debate prompts built from REAL match data, ready to become an on-screen vote
// (the audience votes on the portal, results go back on air). Pure + tested.

import type { MatchDetail } from "./analysis";

export interface InsightLite {
  favorite?: { side: "home" | "away" | null; label: string | null; probability: number | null };
  keyPlayers?: { name: string; team: "home" | "away"; stat: string }[];
  story?: string | null;
}

export interface DebatePrompt {
  id: string;
  kind: "poll" | "debate";
  question: string;
  context: string;
  options: { label: string; argument?: string }[];
}

const pct = (n: number) => `${Math.round(n)}%`;

export function debatePrompts(home: string, away: string, detail: MatchDetail | null, insight: InsightLite | null): DebatePrompt[] {
  const out: DebatePrompt[] = [];
  const live = detail?.state === "in";
  const hs = detail?.home.score ?? 0;
  const as = detail?.away.score ?? 0;

  if (!detail || detail.state === "pre" || live) {
    out.push({ id: "winner", kind: "poll", question: `¿Quién gana ${home} vs ${away}?`, context: live ? `Van ${hs}-${as} al ${detail?.clock}` : "Antes del pitazo inicial",
      options: [{ label: home }, { label: "Empate" }, { label: away }] });
  }

  const fav = insight?.favorite;
  if (fav?.side && (fav.probability ?? 0) >= 55) {
    const favName = fav.side === "home" ? home : away;
    const dog = fav.side === "home" ? away : home;
    out.push({ id: "upset", kind: "debate", question: `¿Puede ${dog} dar la sorpresa ante ${favName}?`, context: `El mercado le da ${fav.probability}% a ${favName}`,
      options: [{ label: "Sí, hay batacazo", argument: `${dog} no tiene nada que perder y el fútbol no se juega en las cuotas.` },
        { label: "No, gana el favorito", argument: `${favName} es favorito por algo: ${fav.probability}% según el mercado.` }] });
  }

  const pos = detail?.stats.find((s) => s.key === "possessionPct");
  if (live && pos && Math.abs(pos.home - pos.away) >= 15) {
    const dom = pos.home > pos.away ? home : away;
    const domPct = Math.max(pos.home, pos.away);
    const winning = (pos.home > pos.away && hs > as) || (pos.away > pos.home && as > hs);
    out.push({ id: "possession", kind: "debate", question: winning ? `¿${dom} gana por dominar la pelota?` : `${dom} tiene la pelota (${pct(domPct)}), ¿merece ir ganando?`,
      context: `Posesión ${pct(pos.home)} - ${pct(pos.away)}`,
      options: [{ label: "Sí, la posesión manda", argument: `Con ${pct(domPct)} de la pelota, el rival casi no la toca.` },
        { label: "No, lo que importa es el arco", argument: "Tener la pelota no es lo mismo que hacer daño." }] });
  }

  const lastGoal = [...(detail?.events ?? [])].reverse().find((e) => (e.type === "goal" || e.type === "penalty-goal") && e.player);
  if (lastGoal?.player) {
    out.push({ id: "mvp", kind: "poll", question: `¿${lastGoal.player.name} es la figura del partido?`, context: `Marcó al ${lastGoal.minute}`,
      options: [{ label: "Sí, el mejor" }, { label: "No, hay otro mejor" }] });
  }

  const keyH = insight?.keyPlayers?.find((k) => k.team === "home");
  const keyA = insight?.keyPlayers?.find((k) => k.team === "away");
  if (keyH && keyA) {
    out.push({ id: "duel", kind: "debate", question: `¿Quién pesa más hoy: ${keyH.name} o ${keyA.name}?`, context: `${keyH.name}: ${keyH.stat} · ${keyA.name}: ${keyA.stat}`,
      options: [{ label: keyH.name, argument: keyH.stat }, { label: keyA.name, argument: keyA.stat }] });
  }

  if (detail?.state === "post") {
    out.push({ id: "fair", kind: "poll", question: `¿Fue justo el ${hs}-${as} entre ${home} y ${away}?`, context: "Resultado final",
      options: [{ label: "Sí, justo" }, { label: "No, merecía otro" }] });
  }
  return out;
}
