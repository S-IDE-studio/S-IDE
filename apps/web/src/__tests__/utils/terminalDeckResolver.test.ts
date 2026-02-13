import { describe, expect, it } from "vitest";
import type { Deck, UnifiedTab } from "../../types";
import { resolveDeckIdForNewTerminal } from "../../utils/terminalDeckResolver";

const decks: Deck[] = [
  {
    id: "deck-desktop",
    name: "Desktop Deck",
    root: "C:/Users/rebui/Desktop",
    workspaceId: "ws-desktop",
    createdAt: new Date().toISOString(),
  },
  {
    id: "deck-project",
    name: "Project Deck",
    root: "C:/Users/rebui/Desktop/S-IDE",
    workspaceId: "ws-project",
    createdAt: new Date().toISOString(),
  },
];

describe("resolveDeckIdForNewTerminal", () => {
  it("prefers active deck tab over activeDeckIds order", () => {
    const activePanelTab: UnifiedTab = {
      id: "tab-deck",
      kind: "deck",
      title: "Project Deck",
      data: {
        deck: {
          id: "deck-project",
          name: "Project Deck",
          root: "C:/Users/rebui/Desktop/S-IDE",
          workspaceId: "ws-project",
        },
      },
    };

    const result = resolveDeckIdForNewTerminal({
      activePanelTab,
      decks,
      activeDeckIds: ["deck-desktop", "deck-project"],
      editorWorkspaceId: "ws-project",
    });

    expect(result).toBe("deck-project");
  });

  it("falls back to workspace-matched deck when active deck differs", () => {
    const activePanelTab: UnifiedTab = {
      id: "tab-workspace",
      kind: "workspace",
      title: "S-IDE",
      data: {
        workspace: {
          id: "ws-project",
          path: "C:/Users/rebui/Desktop/S-IDE",
          name: "S-IDE",
        },
      },
    };

    const result = resolveDeckIdForNewTerminal({
      activePanelTab,
      decks,
      activeDeckIds: ["deck-desktop"],
      editorWorkspaceId: "ws-project",
    });

    expect(result).toBe("deck-project");
  });

  it("uses workspaceId from active terminal tab", () => {
    const activePanelTab: UnifiedTab = {
      id: "tab-terminal",
      kind: "terminal",
      title: "Terminal",
      data: {
        terminal: {
          id: "term-1",
          command: "",
          cwd: "C:/Users/rebui/Desktop/S-IDE",
          workspaceId: "ws-project",
        },
      },
    };

    const result = resolveDeckIdForNewTerminal({
      activePanelTab,
      decks,
      activeDeckIds: ["deck-desktop"],
      editorWorkspaceId: null,
    });

    expect(result).toBe("deck-project");
  });
});
