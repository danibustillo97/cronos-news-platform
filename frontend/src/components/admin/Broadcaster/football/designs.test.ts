import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import type { FootballScoreboard } from "../graphicExport";
import { FOOTBALL_VARIANTS, footballDesignDocument, renderFootballDesign } from "./designs";

const match: FootballScoreboard = {
  homeTeam: "Atlético-MG",
  awayTeam: "Boca Juniors",
  homeShort: "CAM",
  awayShort: "BOC",
  homeColor: "#1a1a1a",
  awayColor: "#0a3d91",
  homeScore: 2,
  awayScore: 1,
  period: "2T",
  clockSeconds: 3721,
  addedTime: 3,
  homeYellow: 2,
  awayYellow: 1,
  homeRed: 0,
  awayRed: 1,
  competitionId: "sudamericana",
  competition: "CONMEBOL Sudamericana · FINAL",
  kickoff: "2026-11-21T22:30:00Z",
  venue: "Metropolitano Roberto Meléndez",
  city: "Barranquilla",
  homeForm: "WWDLW",
  awayForm: "WLWWD",
  highlight: { kind: "goal", team: "home", player: "Hulk", minute: 67 },
  formationHome: "4-3-3",
  scorers: { home: ["Hulk 23'", "Zaracho 67'"], away: ["Cavani 51'"] },
  lineups: {
    home: [
      ["Everson", 22, "POR"], ["Saravia", 2, "DEF"], ["Battaglia", 3, "DEF"], ["Junior Alonso", 6, "DEF"], ["Guilherme Arana", 13, "DEF"],
      ["Otávio", 5, "MED"], ["Alan Franco", 8, "MED"], ["Zaracho", 10, "MED"], ["Paulinho", 7, "ATA"], ["Hulk", 7, "ATA"], ["Deyverson", 9, "ATA"],
    ].map(([name, dorsal, position], i) => ({ name: String(name), dorsal: Number(dorsal), position: position as "POR" | "DEF" | "MED" | "ATA", starter: true, captain: i === 9 }))
      .concat([["Rony", 11], ["Scarpa", 14], ["Mykolenko", 17]].map(([name, dorsal]) => ({ name: String(name), dorsal: Number(dorsal), position: "ATA" as const, starter: false, captain: false }))),
    away: [],
  },
  stats: [{ label: "Posesión %", home: 58, away: 42 }, { label: "Remates", home: 11, away: 6 }, { label: "A puerta", home: 5, away: 2 }],
};

describe("football broadcast designs", () => {
  it("renders every variant with its own fixed size and escaped content", () => {
    const sizes = new Set<string>();
    for (const variant of FOOTBALL_VARIANTS) {
      const design = renderFootballDesign(variant, { ...match, homeTeam: "<b>X</b>" }, "<i>Nombre</i>", "9 · Delantero");
      expect(design.width).toBeGreaterThan(300);
      expect(design.html).not.toContain("<b>X</b>");
      sizes.add(`${variant}:${design.width}x${design.height}`);
    }
    expect(sizes.size).toBe(FOOTBALL_VARIANTS.length);
  });

  it("exports a transparent standalone document scaled to the viewport", () => {
    const html = footballDesignDocument(renderFootballDesign("elite", match), { x: 5, y: 5 }, 1);
    expect(html).toContain("background:transparent");
    expect(html).toContain("innerWidth/1920");
  });

  it("writes preview documents when DESIGN_PREVIEW_DIR is set", () => {
    const dir = process.env.DESIGN_PREVIEW_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    const cells = FOOTBALL_VARIANTS.map((variant) => {
      const design = renderFootballDesign(variant, match, "Hulk", "7 · Delantero");
      const extra = variant === "events" ? ["yellow", "red", "sub", "void"] : [];
      const more = extra.map((kind) => { const d = renderFootballDesign("events", { ...match, highlight: { kind: kind as "yellow", team: "home", player: kind === "sub" ? "Rony" : "Hulk", minute: 67, detail: kind === "sub" ? "Sale Paulinho" : undefined } }); return `<section style="margin:20px"><h4 style="color:#fff;font:14px Arial">${kind}</h4><div style="position:relative;width:${d.width}px;height:${d.height}px">${d.html}</div></section>`; }).join("");
      return more + `<section style="margin:20px"><h4 style="color:#fff;font:14px Arial">${variant}</h4><div style="position:relative;width:${design.width}px;height:${design.height}px">${design.html}</div></section>`;
    }).join("");
    writeFileSync(`${dir}/gallery.html`, `<!doctype html><body style="margin:0;background:#2a6b3a;display:flex;flex-wrap:wrap;width:2000px"><style>.nx{position:relative}</style>${cells}</body>`);
  });
});

describe("designs are valid XML for the rasterizer", () => {
  it("never uses HTML-only entities like &nbsp;", async () => {
    const src = (await import("node:fs")).readFileSync(new URL("./designs.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/&(nbsp|copy|mdash|ndash|hellip);/);
  });
});
