import { describe, expect, it } from "vitest";
import { backupKey, clearBackup, readBackup, sameDraft, writeBackup } from "./draftBackup";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe("draft backup", () => {
  it("stores and restores a draft per article, with new articles under their own key", () => {
    const store = memoryStorage();
    writeBackup("a1", { title: "Uno" }, store, 1000);
    writeBackup(null, { title: "Nueva" }, store, 2000);
    expect(readBackup("a1", store, 1500)).toEqual({ savedAt: 1000, draft: { title: "Uno" } });
    expect(readBackup(null, store, 2500)?.draft).toEqual({ title: "Nueva" });
    expect(store.data.has(backupKey(null))).toBe(true);
  });

  it("drops copies older than two weeks and unreadable ones", () => {
    const store = memoryStorage();
    writeBackup("old", { title: "x" }, store, 0);
    expect(readBackup("old", store, 15 * 24 * 3600 * 1000)).toBeNull();
    expect(store.data.has(backupKey("old"))).toBe(false);
    store.setItem(backupKey("bad"), "{not json");
    expect(readBackup("bad", store)).toBeNull();
  });

  it("clears after a save and survives a storage that throws", () => {
    const store = memoryStorage();
    writeBackup("a1", { title: "x" }, store);
    clearBackup("a1", store);
    expect(readBackup("a1", store)).toBeNull();
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(() => writeBackup("a1", { title: "x" }, broken)).not.toThrow();
    expect(readBackup("a1", broken)).toBeNull();
  });
});

describe("sameDraft", () => {
  it("ignores field order but not values", () => {
    expect(sameDraft({ a: 1, b: "x" }, { b: "x", a: 1 })).toBe(true);
    expect(sameDraft({ a: 1 }, { a: 2 })).toBe(false);
  });
});
