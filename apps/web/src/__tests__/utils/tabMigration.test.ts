import { describe, expect, it } from "vitest";
import type { PanelGroup } from "../../types";
import { migratePanelGroupTabKinds } from "../../utils/tabMigration";

describe("migratePanelGroupTabKinds", () => {
  it('migrates legacy kind "tunnel" to "remoteAccess"', () => {
    const input: PanelGroup = {
      id: "group-1",
      activeTabId: "tab-1",
      focused: true,
      percentage: 100,
      tabs: [
        {
          id: "tab-1",
          kind: "tunnel" as any,
          title: "Remote Access",
          data: { tunnel: { id: "tunnel", name: "Remote Access" } },
        },
      ],
    };

    const out = migratePanelGroupTabKinds(input);
    expect(out.tabs[0]?.kind).toBe("remoteAccess");
  });
});
