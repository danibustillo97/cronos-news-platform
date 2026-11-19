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
});
