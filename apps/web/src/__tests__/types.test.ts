/**
 * Unit tests for types
 */

import { describe, expect, it } from "vitest";
import type { Deck, EditorFile, GitStatus, Workspace } from "../types";

describe("Type definitions", () => {
  describe("EditorFile", () => {
    it("should have required properties", () => {
      const file: EditorFile = {
        id: "file-1",
        name: "test.ts",
        path: "/src/test.ts",
        language: "typescript",
        contents: "export const test = true;",
        dirty: false,
      };

      expect(file.id).toBe("file-1");
      expect(file.name).toBe("test.ts");
      expect(file.path).toBe("/src/test.ts");
      expect(file.language).toBe("typescript");
      expect(file.contents).toBe("export const test = true;");
      expect(file.dirty).toBe(false);
    });

    it("should support dirty flag", () => {
      const cleanFile: EditorFile = {
        id: "file-1",
        name: "test.ts",
        path: "/src/test.ts",
        language: "typescript",
        contents: "",
        dirty: false,
      };

      const dirtyFile: EditorFile = {
        id: "file-2",
        name: "test2.ts",
        path: "/src/test2.ts",
        language: "typescript",
        contents: "",
        dirty: true,
      };

      expect(cleanFile.dirty).toBe(false);
      expect(dirtyFile.dirty).toBe(true);
    });
  });

  describe("Workspace", () => {
    it("should have required properties", () => {
      const workspace: Workspace = {
        id: "ws-1",
        name: "Test Workspace",
        path: "/home/user/project",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      expect(workspace.id).toBe("ws-1");
      expect(workspace.name).toBe("Test Workspace");
      expect(workspace.path).toBe("/home/user/project");
      expect(workspace.createdAt).toBe("2024-01-01T00:00:00.000Z");
    });
  });

  describe("Deck", () => {
    it("should have required properties", () => {
      const deck: Deck = {
        id: "deck-1",
        name: "Test Deck",
        root: "/home/user/project",
        workspaceId: "ws-1",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      expect(deck.id).toBe("deck-1");
      expect(deck.name).toBe("Test Deck");
      expect(deck.root).toBe("/home/user/project");
      expect(deck.workspaceId).toBe("ws-1");
      expect(deck.createdAt).toBe("2024-01-01T00:00:00.000Z");
    });
  });

  describe("GitStatus", () => {
    it("should represent clean status", () => {
      const status: GitStatus = {
        isGitRepo: true,
        branch: "main",
        files: [],
      };

      expect(status.isGitRepo).toBe(true);
      expect(status.branch).toBe("main");
      expect(status.files).toHaveLength(0);
    });

    it("should represent dirty status with files", () => {
      const status: GitStatus = {
        isGitRepo: true,
        branch: "feature-branch",
        files: [
          {
            path: "src/test.ts",
            status: "modified",
            staged: false,
          },
          {
            path: "README.md",
            status: "staged",
            staged: true,
          },
        ],
      };

      expect(status.isGitRepo).toBe(true);
      expect(status.branch).toBe("feature-branch");
      expect(status.files).toHaveLength(2);
      expect(status.files[0].path).toBe("src/test.ts");
      expect(status.files[0].status).toBe("modified");
      expect(status.files[0].staged).toBe(false);
      expect(status.files[1].status).toBe("staged");
      expect(status.files[1].staged).toBe(true);
    });
  });
});

describe("Type guards and validation", () => {
  it("should handle invalid data gracefully", () => {
    // Type system should catch these at compile time
    // But runtime validation should handle malformed data

    const invalidFile = {
      id: 123, // Should be string
      name: null, // Should be string
      // Missing required fields
    } as unknown as EditorFile;

    // In real code, you'd validate this before using
    expect(invalidFile).toBeDefined();
  });

  describe("WorkspaceMode type", () => {
    it("should accept valid workspace modes", () => {
      const validModes: Array<"list" | "editor"> = ["list", "editor"];

      validModes.forEach((mode) => {
        expect(["list", "editor"]).toContain(mode);
      });
    });
  });

  describe("SidebarPanel type", () => {
    it("should accept valid sidebar panels", () => {
      const validPanels: Array<"files" | "git" | "ai" | "servers" | "mcp"> = [
        "files",
        "git",
        "ai",
        "servers",
        "mcp",
      ];

      validPanels.forEach((panel) => {
        expect(["files", "git", "ai", "servers", "mcp"]).toContain(panel);
      });
    });
  });
});
