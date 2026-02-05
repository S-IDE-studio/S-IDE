/**
 * Unit tests for API utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDeck,
  createFile,
  createWorkspace,
  deleteFile,
  getConfig,
  getWsBase,
  getWsToken,
  listDecks,
  listFiles,
  listWorkspaces,
  readFile,
  writeFile,
} from "../../api";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("getWsBase", () => {
  const originalOrigin = window.location.origin;

  afterEach(() => {
    // Restore origin
    Object.defineProperty(window, "location", {
      value: { origin: originalOrigin },
      writable: true,
    });
  });

  it("should use window.location.origin to convert to WebSocket URL", () => {
    // Mock window.location.origin
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:8787" },
      writable: true,
    });

    expect(getWsBase()).toBe("ws://localhost:8787");
  });

  it("should convert HTTPS to WSS", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://example.com" },
      writable: true,
    });

    expect(getWsBase()).toBe("wss://example.com");
  });

  it("should handle custom ports", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "http://example.com:8080" },
      writable: true,
    });

    expect(getWsBase()).toBe("ws://example.com:8080");
  });
});

describe("API endpoints", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Set default origin for API tests
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:8787" },
      writable: true,
    });
  });

  describe("getWsToken", () => {
    it("should fetch WebSocket token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "test-token", authEnabled: true }),
      } as Response);

      const result = await getWsToken();

      expect(result).toEqual({ token: "test-token", authEnabled: true });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/ws-token",
        expect.objectContaining({ credentials: "include" })
      );
    });
  });

  describe("listWorkspaces", () => {
    it("should fetch workspaces list", async () => {
      const mockWorkspaces = [
        { id: "ws-1", name: "Workspace 1", path: "/path1", createdAt: "2024-01-01T00:00:00.000Z" },
        { id: "ws-2", name: "Workspace 2", path: "/path2", createdAt: "2024-01-01T00:00:00.000Z" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkspaces,
      } as Response);

      const result = await listWorkspaces();

      expect(result).toEqual(mockWorkspaces);
    });
  });

  describe("createWorkspace", () => {
    it("should create workspace with path", async () => {
      const mockWorkspace = {
        id: "ws-1",
        name: "New",
        path: "/test",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkspace,
      } as Response);

      const result = await createWorkspace("/test");

      expect(result).toEqual(mockWorkspace);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/workspaces",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining("/test"),
        })
      );
    });
  });

  describe("writeFile", () => {
    it("should write file contents", async () => {
      const mockResponse = { path: "/test.txt", saved: true };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await writeFile("ws-1", "/test.txt", "content");

      expect(result).toEqual(mockResponse);
    });
  });

  describe("deleteFile", () => {
    it("should delete file", async () => {
      const mockResponse = { path: "/test.txt", deleted: true };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await deleteFile("ws-1", "/test.txt");

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/file?"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  describe("createDeck", () => {
    it("should create deck", async () => {
      const mockDeck = {
        id: "deck-1",
        name: "Test Deck",
        workspaceId: "ws-1",
        root: "/test",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeck,
      } as Response);

      const result = await createDeck("Test Deck", "ws-1");

      expect(result).toEqual(mockDeck);
    });
  });

  describe("listFiles", () => {
    it("should list files in directory", async () => {
      const mockFiles = [
        { name: "file.txt", path: "/file.txt", type: "file" },
        { name: "src", path: "/src", type: "dir" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFiles,
      } as Response);

      const result = await listFiles("ws-1", "src");

      expect(result).toEqual(mockFiles);
    });
  });

  describe("readFile", () => {
    it("should read file contents", async () => {
      const mockFile = { path: "/test.txt", contents: "file content" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFile,
      } as Response);

      const result = await readFile("ws-1", "/test.txt");

      expect(result).toEqual(mockFile);
    });
  });

  describe("createFile", () => {
    it("should create new file", async () => {
      const mockResponse = { path: "/new.txt", created: true };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await createFile("ws-1", "/new.txt", "content");

      expect(result).toEqual(mockResponse);
    });
  });

  describe("listDecks", () => {
    it("should list all decks", async () => {
      const mockDecks = [
        {
          id: "deck-1",
          name: "Deck 1",
          root: "/deck1",
          workspaceId: "ws-1",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "deck-2",
          name: "Deck 2",
          root: "/deck2",
          workspaceId: "ws-1",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDecks,
      } as Response);

      const result = await listDecks();

      expect(result).toEqual(mockDecks);
    });
  });

  describe("getConfig", () => {
    it("should fetch server config", async () => {
      const mockConfig = { defaultRoot: "/home/user" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      } as Response);

      const result = await getConfig();

      expect(result).toEqual(mockConfig);
    });
  });
});
