/**
 * Unit tests for URL utilities
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseUrlState } from "../../utils/urlUtils";

describe("parseUrlState", () => {
  const originalSearch = window.location.search;

  beforeEach(() => {
    // Mock window.location.search
    delete (window as any).location;
    (window as any).location = { search: "" };
  });

  afterEach(() => {
    (window as any).location = { search: originalSearch };
  });

  it("should return default state for empty URL", () => {
    (window as any).location.search = "";

    const state = parseUrlState();

    expect(state).toEqual({
      view: "terminal",
      workspaceId: null,
      deckIds: [],
      workspaceMode: "list",
    });
  });

  it("should parse workspace ID from URL", () => {
    (window as any).location.search = "?workspace=workspace-123";

    const state = parseUrlState();

    expect(state.workspaceId).toBe("workspace-123");
    expect(state.deckIds).toEqual([]);
  });

  it("should parse single deck ID from URL", () => {
    (window as any).location.search = "?decks=deck-1";

    const state = parseUrlState();

    expect(state.workspaceId).toBe(null);
    expect(state.deckIds).toEqual(["deck-1"]);
  });

  it("should parse multiple deck IDs from URL", () => {
    (window as any).location.search = "?decks=deck-1,deck-2,deck-3";

    const state = parseUrlState();

    expect(state.deckIds).toEqual(["deck-1", "deck-2", "deck-3"]);
  });

  it("should parse both workspace and deck IDs", () => {
    (window as any).location.search = "?workspace=ws-1&decks=deck-1,deck-2";

    const state = parseUrlState();

    expect(state.workspaceId).toBe("ws-1");
    expect(state.deckIds).toEqual(["deck-1", "deck-2"]);
  });

  it("should parse workspace mode", () => {
    (window as any).location.search = "?mode=editor";

    const state = parseUrlState();

    expect(state.workspaceMode).toBe("editor");
  });

  it("should default to list mode when no mode specified", () => {
    (window as any).location.search = "";

    const state = parseUrlState();

    expect(state.workspaceMode).toBe("list");
  });

  it("should handle malformed deck IDs gracefully", () => {
    (window as any).location.search = "?decks=deck-1,,deck-2";

    const state = parseUrlState();

    // Empty strings should be filtered out
    expect(state.deckIds).toEqual(["deck-1", "deck-2"]);
  });

  it("should handle special characters in workspace ID", () => {
    const specialId = "workspace-with_special.chars";

    (window as any).location.search = `?workspace=${encodeURIComponent(specialId)}`;

    const state = parseUrlState();

    expect(state.workspaceId).toBe(specialId);
  });

  it("should handle URL without query parameters", () => {
    (window as any).location.search = "";

    const state = parseUrlState();

    expect(state).toEqual({
      view: "terminal",
      workspaceId: null,
      deckIds: [],
      workspaceMode: "list",
    });
  });

  it("should handle invalid mode parameter", () => {
    (window as any).location.search = "?mode=invalid";

    const state = parseUrlState();

    // Should default to list for invalid mode
    expect(state.workspaceMode).toBe("list");
  });

  describe("security", () => {
    it("should handle XSS attempts in workspace ID", () => {
      const xssAttempts = [
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "'; DROP TABLE workspaces; --",
        "<img src=x onerror=alert('xss')>",
      ];

      for (const attempt of xssAttempts) {
        (window as any).location.search = `?workspace=${encodeURIComponent(attempt)}`;

        const state = parseUrlState();

        // Should be returned as-is (URL encoding protects us)
        // The actual validation should happen when the ID is used
        expect(state.workspaceId).toBe(attempt);
      }
    });

    it("should handle very long URLs", () => {
      const longId = "a".repeat(10000);

      (window as any).location.search = `?workspace=${longId}`;

      // Should not crash
      const state = parseUrlState();

      expect(state.workspaceId).toBe(longId);
    });

    it("should handle many deck IDs", () => {
      const manyIds = Array.from({ length: 100 }, (_, i) => `deck-${i}`).join(",");

      (window as any).location.search = `?decks=${manyIds}`;

      const state = parseUrlState();

      expect(state.deckIds).toHaveLength(100);
    });
  });
});
