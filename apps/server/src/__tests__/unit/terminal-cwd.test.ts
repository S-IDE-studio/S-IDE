import { describe, expect, it } from "vitest";
import { resolveTerminalCwd } from "../../utils/terminal-cwd.js";

describe("resolveTerminalCwd", () => {
  it("prefers workspace path over deck root", () => {
    const deck = {
      id: "deck-1",
      name: "Deck 1",
      root: "/old/deck/root",
      workspaceId: "ws-1",
      createdAt: new Date().toISOString(),
    };
    const workspace = {
      id: "ws-1",
      name: "Workspace",
      path: "/current/workspace/path",
      createdAt: new Date().toISOString(),
    };

    expect(resolveTerminalCwd(deck, workspace)).toBe("/current/workspace/path");
  });

  it("falls back to deck root when workspace is missing", () => {
    const deck = {
      id: "deck-1",
      name: "Deck 1",
      root: "/deck/root",
      workspaceId: "ws-1",
      createdAt: new Date().toISOString(),
    };

    expect(resolveTerminalCwd(deck)).toBe("/deck/root");
  });
});
