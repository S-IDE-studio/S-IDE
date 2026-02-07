import { useEffect, useMemo, useRef } from "react";
import { postTabsPresence, type TabsPresenceTab } from "../api";
import type { PanelGroup, UnifiedTab, WorkspaceState } from "../types";
import { getOrCreateTabsSyncClientId } from "../utils/clientId";
import { createSyncedTabFromPresence, getTabSyncKey, toPresenceTab } from "../utils/tabsSync";

const HEARTBEAT_MS = 10_000;
const DEBOUNCE_MS = 300;

function getFocusedActiveTab(groups: PanelGroup[]): UnifiedTab | null {
  const focused = groups.find((g) => g.focused) ?? groups[0];
  if (!focused?.activeTabId) return null;
  return focused.tabs.find((t) => t.id === focused.activeTabId) ?? null;
}

export function useTabsPresenceSync(opts: {
  enabled?: boolean;
  panelGroups: PanelGroup[];
  panelGroupsMap: Record<string, PanelGroup>;
  setPanelGroupsMap: React.Dispatch<React.SetStateAction<Record<string, PanelGroup>>>;
  workspaceStates?: Record<string, WorkspaceState>;
}) {
  const enabled = opts.enabled ?? true;
  const clientIdRef = useRef<string>(getOrCreateTabsSyncClientId());
  const lastSignatureRef = useRef<string>("");
  const presenceTabsRef = useRef<TabsPresenceTab[]>([]);
  const panelGroupsRef = useRef<PanelGroup[]>([]);
  const workspaceStatesRef = useRef<Record<string, WorkspaceState> | undefined>(undefined);

  const localPresenceTabs = useMemo(() => {
    const tabs: TabsPresenceTab[] = [];
    for (const group of Object.values(opts.panelGroupsMap)) {
      for (const tab of group.tabs) {
        if (tab.synced) continue; // do not re-advertise mirrored tabs
        const p = toPresenceTab(tab, { workspaceStates: opts.workspaceStates });
        if (p) tabs.push(p as TabsPresenceTab);
      }
    }

    // De-dupe by syncKey
    const seen = new Set<string>();
    const deduped = tabs.filter((t) => {
      if (seen.has(t.syncKey)) return false;
      seen.add(t.syncKey);
      return true;
    });
    return deduped;
  }, [opts.panelGroupsMap, opts.workspaceStates]);

  const signature = useMemo(() => {
    // Keep stable ordering for signature.
    const keys = [...localPresenceTabs.map((t) => t.syncKey)].sort();
    return keys.join("|");
  }, [localPresenceTabs]);

  useEffect(() => {
    presenceTabsRef.current = localPresenceTabs;
  }, [localPresenceTabs]);

  useEffect(() => {
    panelGroupsRef.current = opts.panelGroups;
  }, [opts.panelGroups]);

  useEffect(() => {
    workspaceStatesRef.current = opts.workspaceStates;
  }, [opts.workspaceStates]);

  const sendRef = useRef<() => Promise<void>>(async () => {});
  sendRef.current = async () => {
    const groups = panelGroupsRef.current;
    if (!enabled || groups.length === 0) return;

    const activeTab = getFocusedActiveTab(groups);
    const activeSyncKey = activeTab
      ? getTabSyncKey(activeTab, { workspaceStates: workspaceStatesRef.current })
      : null;

    const outgoingTabs = presenceTabsRef.current;

    try {
      const res = await postTabsPresence({
        clientId: clientIdRef.current,
        activeSyncKey,
        tabs: outgoingTabs,
      });

      const union = Array.isArray(res?.tabs) ? res.tabs : [];
      const unionKeys = new Set<string>(union.map((t) => String(t.syncKey || "")).filter(Boolean));

      opts.setPanelGroupsMap((prev) => {
        const firstGroupId = groups[0]?.id ?? Object.keys(prev)[0];
        if (!firstGroupId || !prev[firstGroupId]) return prev;

        // Build set of existing syncKeys (local + synced)
        const existingKeys = new Set<string>();
        for (const group of Object.values(prev)) {
          for (const tab of group.tabs) {
            const key = getTabSyncKey(tab, { workspaceStates: workspaceStatesRef.current });
            if (key) existingKeys.add(key);
          }
        }

        const unionByKey = new Map<string, TabsPresenceTab>();
        for (const u of union) {
          const k = String(u.syncKey || "");
          if (!k) continue;
          if (!unionByKey.has(k)) unionByKey.set(k, u);
        }

        const tabsToAdd: UnifiedTab[] = [];
        for (const u of union) {
          const k = String(u.syncKey || "");
          if (!k || existingKeys.has(k)) continue;
          const created = createSyncedTabFromPresence(u as any);
          if (created) tabsToAdd.push(created);
        }

        let changed = false;

        const next: Record<string, PanelGroup> = {};
        for (const [groupId, group] of Object.entries(prev)) {
          let groupChanged = false;

          const filteredTabs = group.tabs.filter((t) => {
            if (!t.synced) return true;
            const key = t.syncKey || getTabSyncKey(t, { workspaceStates: workspaceStatesRef.current });
            const keep = key ? unionKeys.has(key) : false;
            if (!keep) groupChanged = true;
            return keep;
          });

          const updatedTabs = filteredTabs.map((t) => {
            if (!t.synced) return t;
            const key = t.syncKey || getTabSyncKey(t, { workspaceStates: workspaceStatesRef.current });
            if (!key) return t;
            const u = unionByKey.get(key);
            if (!u) return t;
            const nextTitle = String(u.title || t.title);
            if (nextTitle !== t.title) {
              groupChanged = true;
              return { ...t, title: nextTitle };
            }
            return t;
          });

          let nextActive = group.activeTabId;
          if (nextActive && !updatedTabs.some((t) => t.id === nextActive)) {
            nextActive = updatedTabs[0]?.id ?? null;
            if (nextActive !== group.activeTabId) groupChanged = true;
          }

          if (groupChanged) {
            changed = true;
            next[groupId] = { ...group, tabs: updatedTabs, activeTabId: nextActive };
          } else {
            next[groupId] = group;
          }
        }

        if (tabsToAdd.length > 0) {
          changed = true;
          const target = next[firstGroupId];
          if (!target) return next;
          next[firstGroupId] = {
            ...target,
            tabs: [...target.tabs, ...tabsToAdd],
            activeTabId: target.activeTabId ?? tabsToAdd[0]?.id ?? null,
          };
        }

        return changed ? next : prev;
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[tabs-sync] presence failed:", err);
      }
    }
  };

  // Heartbeat: set up once (per enable/disable) to keep presence alive and detect union updates.
  useEffect(() => {
    if (!enabled) return;
    if (opts.panelGroups.length === 0) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await sendRef.current();
    };

    // Initial send
    void tick();
    const interval = setInterval(() => void tick(), HEARTBEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, opts.panelGroups.length]);

  // Debounced send on local signature change.
  useEffect(() => {
    if (!enabled) return;
    if (opts.panelGroups.length === 0) return;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    const timeout = setTimeout(() => void sendRef.current(), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [enabled, opts.panelGroups.length, signature]);
}
