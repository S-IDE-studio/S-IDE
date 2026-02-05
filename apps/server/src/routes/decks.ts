import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import type { Deck, Workspace } from "../types.js";
import { createHttpError, handleError, readJson } from "../utils/error.js";
import { requireWorkspace } from "./workspaces.js";

export function createDeckRouter(
  db: DatabaseSync,
  workspaces: Map<string, Workspace>,
  decks: Map<string, Deck>
) {
  const router = new Hono();

  const insertDeck = db.prepare(
    "INSERT INTO decks (id, name, root, workspace_id, created_at) VALUES (?, ?, ?, ?, ?)"
  );

  const updateDeckName = db.prepare("UPDATE decks SET name = ? WHERE id = ?");

  function createDeck(name: string | undefined, workspaceId: string): Deck {
    const workspace = requireWorkspace(workspaces, workspaceId);
    const deck: Deck = {
      id: crypto.randomUUID(),
      name: name || `Deck ${decks.size + 1}`,
      root: workspace.path,
      workspaceId,
      createdAt: new Date().toISOString(),
    };
    decks.set(deck.id, deck);
    insertDeck.run(deck.id, deck.name, deck.root, deck.workspaceId, deck.createdAt);
    return deck;
  }

  router.get("/", (c) => {
    return c.json(Array.from(decks.values()));
  });

  router.post("/", async (c) => {
    try {
      const body = await readJson<{ name?: string; workspaceId?: string }>(c);
      const workspaceId = body?.workspaceId;
      if (!workspaceId) {
        throw createHttpError("workspaceId is required", 400);
      }
      const deck = createDeck(body?.name, workspaceId);
      return c.json(deck, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  router.post("/:id", async (c) => {
    try {
      const deckId = c.req.param("id");
      const body = await readJson<{ name?: string }>(c);
      const newName = body?.name;

      if (!newName) {
        throw createHttpError("name is required", 400);
      }

      const deck = decks.get(deckId);
      if (!deck) {
        throw createHttpError("Deck not found", 404);
      }

      deck.name = newName;
      updateDeckName.run(newName, deckId);

      return c.json(deck);
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}
