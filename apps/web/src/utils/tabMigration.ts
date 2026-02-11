import type { UnifiedTab } from "../types";

/** Local type for tab migration - represents old panel group format */
interface PanelGroup {
  id: string;
  tabs: UnifiedTab[];
  activeTabId: string | null;
  focused: boolean;
  percentage: number;
}

export function migrateTabKind(kind: string): string {
  if (kind === "tunnel") return "remoteAccess";
  return kind;
}

export function migrateUnifiedTabKind(tab: UnifiedTab): UnifiedTab {
  const migratedKind = migrateTabKind(tab.kind);
  if (migratedKind === tab.kind) return tab;

  // Preserve payload as-is for backward compatibility. We don't depend on tab.data for this panel.
  return { ...tab, kind: migratedKind as any };
}

export function migratePanelGroupTabKinds(group: PanelGroup): PanelGroup {
  const tabs = group.tabs.map(migrateUnifiedTabKind);
  return tabs === group.tabs ? group : { ...group, tabs };
}

export function migratePanelGroupsMapTabKinds(
  map: Record<string, PanelGroup>
): Record<string, PanelGroup> {
  let changed = false;
  const out: Record<string, PanelGroup> = {};
  for (const [id, group] of Object.entries(map)) {
    const migrated = migratePanelGroupTabKinds(group);
    if (migrated !== group) changed = true;
    out[id] = migrated;
  }
  return changed ? out : map;
}
