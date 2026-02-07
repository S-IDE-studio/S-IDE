import { describe, expect, it } from "vitest";
import type { UnifiedTab } from "../../types";
import { createSyncedTabFromPresence, getTabSyncKey, syncTabIdFromKey } from "../../utils/tabsSync";

describe("tabsSync", () => {
  it("builds stable sync keys for common tab kinds", () => {
    const workspaceTab: UnifiedTab = {
      id: "t1",
      kind: "workspace",
      title: "WS",
      data: { workspace: { id: "w1", path: "C:/p", name: "p" } },
    };
    expect(getTabSyncKey(workspaceTab)).toBe("workspace:w1");

    const deckTab: UnifiedTab = {
      id: "t2",
      kind: "deck",
      title: "Deck",
      data: { deck: { id: "d1", name: "D", root: "C:/p", workspaceId: "w1" } },
    };
    expect(getTabSyncKey(deckTab)).toBe("deck:d1");

    const terminalTab: UnifiedTab = {
      id: "t3",
      kind: "terminal",
      title: "Terminal",
      data: { terminal: { id: "term1", command: "pwsh", cwd: "C:/p" } },
    };
    expect(getTabSyncKey(terminalTab)).toBe("terminal:term1");
  });

  it("creates synced tabs with deterministic ids", () => {
    const tab = createSyncedTabFromPresence({
      syncKey: "terminal:abc",
      kind: "terminal",
      title: "pwsh",
      data: { terminal: { id: "abc", command: "pwsh", cwd: "C:/" } },
    });
    expect(tab?.synced).toBe(true);
    expect(tab?.syncKey).toBe("terminal:abc");
    expect(tab?.id).toBe(syncTabIdFromKey("terminal:abc"));
  });
});

