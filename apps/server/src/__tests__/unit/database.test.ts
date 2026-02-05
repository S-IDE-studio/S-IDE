/**
 * Unit tests for database utilities
 * Tests UUID validation and SQL injection prevention
 */

import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteTerminal,
  saveTerminal,
  updateTerminalBuffer,
  validateUUID,
} from "../../utils/database.js";

describe("validateUUID", () => {
  it("should accept valid UUID v4 format", () => {
    const validUUIDs = [
      "550e8400-e29b-41d4-a716-446655440000",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "01234567-89ab-cdef-0123-456789abcdef",
      "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
    ];

    validUUIDs.forEach((uuid) => {
      expect(() => validateUUID(uuid)).not.toThrow();
    });
  });

  it("should reject invalid UUID formats", () => {
    const invalidUUIDs = [
      "", // empty
      "not-a-uuid", // invalid format
      "550e8400-e29b-41d4-a716", // too short
      "550e8400-e29b-41d4-a716-446655440000-extra", // too long
      "550e8400-e29b-41d4-a716-446655440000 ", // trailing space
      " 550e8400-e29b-41d4-a716-446655440000", // leading space
      "550e8400-e29b-41d4-a716-44665544000x", // invalid character
      "550e8400-e29b-41d4-a716-446655440000-0000", // extra segments
      "../etc/passwd", // path traversal attempt
      "'; DROP TABLE terminals; --", // SQL injection attempt
      "1' OR '1'='1", // SQL injection
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing template injection pattern
      "${7*7}", // template injection
      "<script>alert('xss')</script>", // XSS
      "../../../sensitive", // path traversal
      "NULL", // SQL keyword
      "undefined", // JavaScript keyword
    ];

    invalidUUIDs.forEach((uuid) => {
      expect(() => validateUUID(uuid)).toThrow("Invalid ID format");
    });
  });

  it("should throw descriptive error message", () => {
    expect(() => validateUUID("invalid")).toThrow("Invalid ID format: invalid");
  });
});

describe("saveTerminal with UUID validation", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new DatabaseSync(":memory:");
    // Initialize schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root TEXT NOT NULL,
        workspace_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS terminals (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL,
        title TEXT NOT NULL,
        command TEXT,
        buffer TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it("should save terminal with valid UUIDs", () => {
    const validDeckId = "550e8400-e29b-41d4-a716-446655440000";
    const validTerminalId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

    // Create a deck first
    db.prepare("INSERT INTO decks (id, name, root, workspace_id) VALUES (?, ?, ?, ?)").run(
      validDeckId,
      "Test Deck",
      "/tmp/test",
      validDeckId
    );

    // Should not throw with valid UUIDs
    expect(() => {
      saveTerminal(
        db,
        validTerminalId,
        validDeckId,
        "Test Terminal",
        "bash",
        "2024-01-01T00:00:00Z"
      );
    }).not.toThrow();

    // Verify it was saved
    const saved = db.prepare("SELECT * FROM terminals WHERE id = ?").get(validTerminalId);
    expect(saved).toBeDefined();
  });

  it("should reject terminal with invalid terminal ID", () => {
    const validDeckId = "550e8400-e29b-41d4-a716-446655440000";
    const invalidTerminalId = "'; DROP TABLE terminals; --";

    // Create a deck first
    db.prepare("INSERT INTO decks (id, name, root, workspace_id) VALUES (?, ?, ?, ?)").run(
      validDeckId,
      "Test Deck",
      "/tmp/test",
      validDeckId
    );

    // Should throw with invalid terminal ID
    expect(() => {
      saveTerminal(
        db,
        invalidTerminalId,
        validDeckId,
        "Test Terminal",
        "bash",
        "2024-01-01T00:00:00Z"
      );
    }).toThrow("Invalid ID format");
  });

  it("should reject terminal with invalid deck ID", () => {
    const invalidDeckId = "../../../etc/passwd";
    const validTerminalId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

    // Should throw with invalid deck ID
    expect(() => {
      saveTerminal(
        db,
        validTerminalId,
        invalidDeckId,
        "Test Terminal",
        "bash",
        "2024-01-01T00:00:00Z"
      );
    }).toThrow("Invalid ID format");
  });

  it("should prevent SQL injection via IDs", () => {
    const sqlInjectionId = "550e8400-e29b-41d4'; DROP TABLE terminals; --";

    expect(() => validateUUID(sqlInjectionId)).toThrow();

    // Even if validation were bypassed, prepared statement should prevent injection
    const validDeckId = "550e8400-e29b-41d4-a716-446655440000";
    const validTerminalId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

    db.prepare("INSERT INTO decks (id, name, root, workspace_id) VALUES (?, ?, ?, ?)").run(
      validDeckId,
      "Test Deck",
      "/tmp/test",
      validDeckId
    );

    saveTerminal(db, validTerminalId, validDeckId, "Test Terminal", "bash", "2024-01-01T00:00:00Z");

    // Verify terminals table still exists and has correct structure
    const tableInfo = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='terminals'")
      .get() as { sql: string };
    expect(tableInfo.sql).toContain("CREATE TABLE");
  });
});

describe("updateTerminalBuffer with UUID validation", () => {
  let db: DatabaseSync;
  let validTerminalId: string;
  let validDeckId: string;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE decks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root TEXT NOT NULL,
        workspace_id TEXT NOT NULL
      );
      CREATE TABLE terminals (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL,
        title TEXT NOT NULL,
        command TEXT,
        buffer TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    validDeckId = "550e8400-e29b-41d4-a716-446655440000";
    validTerminalId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

    db.prepare("INSERT INTO decks (id, name, root, workspace_id) VALUES (?, ?, ?, ?)").run(
      validDeckId,
      "Test Deck",
      "/tmp/test",
      validDeckId
    );
    saveTerminal(db, validTerminalId, validDeckId, "Test Terminal", "bash", "2024-01-01T00:00:00Z");
  });

  afterEach(() => {
    db.close();
  });

  it("should update buffer with valid UUID", () => {
    const newBuffer = "Updated content";
    expect(() => updateTerminalBuffer(db, validTerminalId, newBuffer)).not.toThrow();

    const updated = db
      .prepare("SELECT buffer FROM terminals WHERE id = ?")
      .get(validTerminalId) as { buffer: string };
    expect(updated.buffer).toBe(newBuffer);
  });

  it("should reject update with invalid UUID", () => {
    const invalidId = "../etc/passwd";
    expect(() => updateTerminalBuffer(db, invalidId, "content")).toThrow("Invalid ID format");
  });
});

describe("deleteTerminal with UUID validation", () => {
  let db: DatabaseSync;
  let validTerminalId: string;
  let validDeckId: string;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE decks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root TEXT NOT NULL,
        workspace_id TEXT NOT NULL
      );
      CREATE TABLE terminals (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL,
        title TEXT NOT NULL,
        command TEXT,
        buffer TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    validDeckId = "550e8400-e29b-41d4-a716-446655440000";
    validTerminalId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

    db.prepare("INSERT INTO decks (id, name, root, workspace_id) VALUES (?, ?, ?, ?)").run(
      validDeckId,
      "Test Deck",
      "/tmp/test",
      validDeckId
    );
    saveTerminal(db, validTerminalId, validDeckId, "Test Terminal", "bash", "2024-01-01T00:00:00Z");
  });

  afterEach(() => {
    db.close();
  });

  it("should delete terminal with valid UUID", () => {
    expect(() => deleteTerminal(db, validTerminalId)).not.toThrow();

    const deleted = db.prepare("SELECT * FROM terminals WHERE id = ?").get(validTerminalId);
    expect(deleted).toBeUndefined();
  });

  it("should reject delete with invalid UUID", () => {
    const invalidId = "' OR '1'='1";
    expect(() => deleteTerminal(db, invalidId)).toThrow("Invalid ID format");

    // Verify original terminal still exists
    const stillExists = db.prepare("SELECT * FROM terminals WHERE id = ?").get(validTerminalId);
    expect(stillExists).toBeDefined();
  });
});
