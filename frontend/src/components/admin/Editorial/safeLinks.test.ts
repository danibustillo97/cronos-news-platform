import { describe, expect, it } from "vitest";
import { linkLabel, safeHttpUrl } from "./safeLinks";

describe("safe links", () => {
  it("accepts web URLs only", () => {
    expect(safeHttpUrl("https://www.as.com/futbol")).toBe("https://www.as.com/futbol");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<b>x</b>")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });

  it("labels links by host and never throws on bad input", () => {
    expect(linkLabel("https://www.marca.com/a")).toBe("marca.com");
    expect(linkLabel("fuente sin url")).toBe("fuente sin url");
  });
});
