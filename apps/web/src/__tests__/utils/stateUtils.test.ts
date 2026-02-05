/**
 * Unit tests for state utilities
 */

import { describe, expect, it } from "vitest";
import { createEmptyDeckState, createEmptyWorkspaceState } from "../../utils/stateUtils";

describe("createEmptyDeckState", () => {
  it("should create empty deck state with correct structure", () => {
    const state = createEmptyDeckState();

    expect(state).toHaveProperty("terminals", []);
    expect(state).toHaveProperty("terminalsLoaded", false);
  });

  it("should create independent deck states", () => {
    const state1 = createEmptyDeckState();
    const state2 = createEmptyDeckState();

    // Mutate one state
    state1.terminals.push({ id: "1", title: "Test" });

    // Other state should be unaffected
    expect(state2.terminals).toHaveLength(0);
    expect(state1.terminals).toHaveLength(1);
  });
});

describe("createEmptyWorkspaceState", () => {
  it("should create empty workspace state with correct structure", () => {
    const state = createEmptyWorkspaceState();

    expect(state).toHaveProperty("tree", []);
    expect(state).toHaveProperty("treeLoading", false);
    expect(state).toHaveProperty("treeError", null);
    expect(state).toHaveProperty("files", []);
    expect(state).toHaveProperty("activeFileId", null);
  });

  it("should create independent workspace states", () => {
    const state1 = createEmptyWorkspaceState();
    const state2 = createEmptyWorkspaceState();

    // Mutate one state
    state1.files.push({
      id: "1",
      name: "test.txt",
      path: "/test.txt",
      language: "text",
      contents: "content",
      dirty: false,
    });

    // Other state should be unaffected
    expect(state2.files).toHaveLength(0);
    expect(state1.files).toHaveLength(1);
  });
});
