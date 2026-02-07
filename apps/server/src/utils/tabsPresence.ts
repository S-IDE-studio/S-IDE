export interface TabsPresenceTab {
  syncKey: string;
  kind: string;
  title: string;
  data?: unknown;
}

export interface ClientTabsPresence {
  clientId: string;
  updatedAt: number;
  tabs: TabsPresenceTab[];
  activeSyncKey?: string | null;
}

export function buildUnionTabs(presences: ClientTabsPresence[]): TabsPresenceTab[] {
  const map = new Map<string, TabsPresenceTab>();
  for (const p of presences) {
    for (const tab of p.tabs) {
      if (!tab?.syncKey) continue;
      if (!map.has(tab.syncKey)) {
        map.set(tab.syncKey, tab);
      }
    }
  }
  return [...map.values()];
}

export function pruneExpiredPresences(
  store: Map<string, ClientTabsPresence>,
  opts: { now: number; ttlMs: number }
): void {
  for (const [clientId, presence] of store.entries()) {
    if (opts.now - presence.updatedAt > opts.ttlMs) {
      store.delete(clientId);
    }
  }
}

