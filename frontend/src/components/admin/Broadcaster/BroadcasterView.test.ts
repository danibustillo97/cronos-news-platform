import { describe, expect, it } from "vitest";
import { exportGraphicHtml, type BroadcastGraphic } from "./graphicExport";

const graphic: BroadcastGraphic = {
  id: "lower",
  name: "Lower third",
  kind: "lower-third",
  title: "Titular",
  subtitle: "Subtítulo",
  accent: "#ef4444",
};

describe("Broadcaster HTML graphics", () => {
  it("exports a transparent, self-contained HTML overlay", () => {
    const html = exportGraphicHtml(graphic);

    expect(html).toContain("background:transparent");
    expect(html).toContain("class=\"lower\"");
    expect(html).toContain("<strong>Titular</strong>");
    expect(html).toContain("<span>Subtítulo</span>");
  });

  it("escapes user-provided HTML and falls back from an invalid accent color", () => {
    const html = exportGraphicHtml({
      ...graphic,
      title: "<script>alert(1)</script>",
      accent: "red; background-image:url(javascript:alert(1))",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("background:#ef4444");
  });

  it("exports football shields inside the responsive scoreboard", () => {
    const html = exportGraphicHtml({
      ...graphic,
      kind: "scoreboard",
      football: {
        homeTeam: "Local",
        awayTeam: "Visitante",
        homeScore: 1,
        awayScore: 0,
        period: "1T",
        clockSeconds: 120,
        addedTime: 0,
        homeYellow: 0,
        awayYellow: 1,
        homeRed: 0,
        awayRed: 0,
        homeLogo: "data:image/svg+xml;base64,home",
        awayLogo: "data:image/svg+xml;base64,away",
      },
    });

    expect(html).toContain("class=\"logo\"");
    expect(html).toContain("data:image/svg+xml;base64,home");
    expect(html).toContain("data:image/svg+xml;base64,away");
  });

  it("exports distinct NEXUS broadcast variants with transparent output", () => {
    const base = {
      ...graphic,
      kind: "scoreboard" as const,
      football: {
        homeTeam: "Local",
        awayTeam: "Visitante",
        homeScore: 2,
        awayScore: 1,
        period: "2T" as const,
        clockSeconds: 4700,
        addedTime: 4,
        homeYellow: 1,
        awayYellow: 0,
        homeRed: 0,
        awayRed: 0,
      },
    };
    const elite = exportGraphicHtml({ ...base, variant: "elite" });
    const compact = exportGraphicHtml({ ...base, variant: "compact" });
    const editorial = exportGraphicHtml({ ...base, variant: "editorial" });

    expect(elite).toContain("class=\"scoreboard elite\"");
    expect(compact).toContain("class=\"scoreboard compact\"");
    expect(editorial).toContain("class=\"scoreboard editorial\"");
    expect(new Set([elite, compact, editorial]).size).toBe(3);
    expect(elite).toContain("background:transparent");
  });
});
