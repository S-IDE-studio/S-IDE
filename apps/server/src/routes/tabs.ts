/**
 * Tabs presence and union state for multi-device sync.
 *
 * This keeps a short-lived in-memory map of client -> open tabs snapshot.
 * Clients post their current open tabs; the server returns the union.
 */

import { Hono } from "hono";
import { readJson } from "../utils/error.js";
import type { ClientTabsPresence, TabsPresenceTab } from "../utils/tabsPresence.js";
import { buildUnionTabs, pruneExpiredPresences } from "../utils/tabsPresence.js";

const PRESENCE_TTL_MS = 30_000;

const presences = new Map<string, ClientTabsPresence>();

function normalizeTabs(tabs: unknown): TabsPresenceTab[] {
  if (!Array.isArray(tabs)) return [];
  return tabs
    .filter((t) => t && typeof t === "object")
    .map((t: any) => ({
      syncKey: String(t.syncKey || ""),
      kind: String(t.kind || ""),
      title: String(t.title || ""),
      data: t.data,
    }))
    .filter((t) => t.syncKey && t.kind);
}

export function createTabsRouter() {
  const router = new Hono();

  router.get("/state", (c) => {
    pruneExpiredPresences(presences, { now: Date.now(), ttlMs: PRESENCE_TTL_MS });
    const union = buildUnionTabs([...presences.values()]);
    return c.json({
      tabs: union,
      clients: [...presences.values()].map((p) => ({
        clientId: p.clientId,
        activeSyncKey: p.activeSyncKey ?? null,
        updatedAt: p.updatedAt,
      })),
    });
  });

  router.post("/presence", async (c) => {
    const body = await readJson<{
      clientId?: string;
      activeSyncKey?: string | null;
      tabs?: unknown;
    }>(c);

    const clientId = body?.clientId ? String(body.clientId) : "";
    if (!clientId || clientId.length > 200) {
      return c.json({ error: "clientId is required" }, 400);
    }

    const tabs = normalizeTabs(body?.tabs);
    const presence: ClientTabsPresence = {
      clientId,
      updatedAt: Date.now(),
      tabs,
      activeSyncKey: body?.activeSyncKey ?? null,
    };

    presences.set(clientId, presence);

    pruneExpiredPresences(presences, { now: Date.now(), ttlMs: PRESENCE_TTL_MS });
    const union = buildUnionTabs([...presences.values()]);

    return c.json({ ok: true, tabs: union });
  });

  return router;
}

