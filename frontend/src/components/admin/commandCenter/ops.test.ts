import { describe, expect, it } from "vitest";
import { campaignTotals, feedHealth, monetizationChecks, opsAlerts, seoProblems, type FeedRow } from "./ops";
import type { AdProviderConfig } from "@/lib/adConfig";

const NOW = new Date("2026-11-27T18:00:00.000Z");
const row = (id: string, hoursAgo: number, patch: Partial<FeedRow> = {}): FeedRow => ({
  id, title: "Millonarios vence a Nacional y se mete en la final", slug: id,
  excerpt: "Un resumen suficientemente largo para la meta descripción de la noticia publicada hoy.", summary: null,
  image_url: "https://img.test/a.jpg", category: "Fútbol",
  published_at: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(), ...patch,
});

const config = (patch: Partial<AdProviderConfig> = {}): AdProviderConfig => ({
  adsenseEnabled: false, adsensePublisherId: null, adsenseSlots: {}, adsenseDefaultSlot: null,
  adsterraEnabled: false, adsterraScriptUrl: null, adsterraContainerId: null, ga4MeasurementId: null, ...patch,
});

describe("command center: feed", () => {
  it("counts only the last 24 h as feed and the rest as archived", () => {
    const h = feedHealth([row("a", 1), row("b", 23.5), row("c", 25), row("d", 70)], NOW);
    expect(h.inFeed).toBe(2);
    expect(h.archived7d).toBe(2);
    expect(h.minutesSinceLast).toBe(60);
    expect(h.last24h).toHaveLength(24);
    expect(h.last24h[22]).toBe(1); // 1 h ago
    expect(h.last24h[0]).toBe(1);  // 23.5 h ago
  });

  it("flags SEO problems of published stories", () => {
    expect(seoProblems(row("ok", 1))).toEqual([]);
    expect(seoProblems(row("x", 1, { image_url: null, excerpt: null, title: "Corto" }))).toEqual([
      "sin imagen (no sale en Discover)", "título corto (5)", "sin resumen (meta descripción)",
    ]);
  });
});

describe("command center: monetisation", () => {
  it("says exactly what is missing to earn with AdSense", () => {
    const [adsense, adsTxt, ga4] = monetizationChecks(config(), "", []);
    expect(adsense.level).toBe("bad");
    expect(adsTxt.level).toBe("bad");
    expect(ga4.level).toBe("warn");
  });

  it("validates ads.txt against the publisher id", () => {
    const c = config({ adsenseEnabled: true, adsensePublisherId: "ca-pub-123", adsenseDefaultSlot: "999" });
    expect(monetizationChecks(c, "google.com, pub-123, DIRECT, f08c47fec0942fa0", [])[1].level).toBe("ok");
    expect(monetizationChecks(c, "google.com, pub-777, DIRECT", [])[1].level).toBe("warn");
    expect(monetizationChecks(c, "", [])[0].level).toBe("ok");
  });

  it("totals direct campaign impressions and clicks", () => {
    expect(campaignTotals([{ impressions: 200, clicks: 3 }, { impressions: 100, clicks: 0 }])).toEqual({ impressions: 300, clicks: 3, ctr: 1 });
    expect(campaignTotals(null).ctr).toBeNull();
  });
});

describe("command center: alerts", () => {
  it("puts an empty feed and money leaks first", () => {
    const alerts = opsAlerts(feedHealth([], NOW), { enabled: false, maxArticlesPerDay: 10 }, 0, monetizationChecks(config(), "", []));
    expect(alerts[0].level).toBe("bad");
    expect(alerts.map((a) => a.id)).toEqual(expect.arrayContaining(["feed-empty", "auto-off", "money-adsense"]));
  });
});
