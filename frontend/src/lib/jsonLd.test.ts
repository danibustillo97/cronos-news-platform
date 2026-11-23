import { describe, expect, it } from "vitest";
import { jsonLdScript } from "./jsonLd";

describe("jsonLdScript", () => {
  it("cannot close the surrounding script tag", () => {
    const out = jsonLdScript({ headline: "Gol</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
  });

  it("still parses back to the same data", () => {
    const data = { headline: "A < B && C > D", body: `línea${String.fromCharCode(0x2028)}nueva` };
    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });
});
