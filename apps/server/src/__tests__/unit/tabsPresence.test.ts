import { describe, expect, it } from "vitest";
import { buildUnionTabs, pruneExpiredPresences } from "../../utils/tabsPresence.js";

describe("tabs presence", () => {
  it("buildUnionTabs returns union by syncKey", () => {
    const presences = [
      {
        clientId: "a",
        updatedAt: 1000,
        tabs: [
          { syncKey: "deck:1", kind: "deck", title: "Deck 1", data: { deckId: "1" } },
          { syncKey: "terminal:t1", kind: "terminal", title: "Terminal", data: { id: "t1" } },
        ],
      },
      {
        clientId: "b",
        updatedAt: 1100,
        tabs: [
          { syncKey: "deck:1", kind: "deck", title: "Deck 1 (dup)", data: { deckId: "1" } },
          { syncKey: "workspace:w1", kind: "workspace", title: "WS", data: { workspaceId: "w1" } },
        ],
      },
    ];

    const union = buildUnionTabs(presences as any);
    const keys = union.map((t: any) => t.syncKey).sort();
    expect(keys).toEqual(["deck:1", "terminal:t1", "workspace:w1"]);
  });

  it("pruneExpiredPresences removes clients older than ttl", () => {
    const map = new Map<string, { clientId: string; updatedAt: number; tabs: any[] }>();
    map.set("a", { clientId: "a", updatedAt: 1000, tabs: [] });
    map.set("b", { clientId: "b", updatedAt: 2000, tabs: [] });

    pruneExpiredPresences(map, { now: 2500, ttlMs: 500 });

    expect(map.has("a")).toBe(false);
    expect(map.has("b")).toBe(true);
  });
});
