/**
 * Dockview layout utilities for migration from grid-based system
 * Handles conversion between grid state format and dockview JSON format
 */

import type {
  DockviewApi,
  GridBranchNode,
  GridLeafNode,
  GridNode,
  GridOrientation,
  GridState,
  PanelGroup,
} from "../types";
import type { SerializedDockview } from "dockview";

/** Storage key for dockview layout */
const DOCKVIEW_STORAGE_KEY = "side-ide-dockview-layout";

/** Storage key for legacy grid format (for migration) */
const LEGACY_STORAGE_KEY = "side-ide-tabs";

/**
 * Legacy tab persistence state (grid format)
 */
interface LegacyTabPersistState {
  panelGroups?: PanelGroup[];
  panelLayout?: { direction: string; sizes: number[] };
  gridState?: GridState;
  panelGroupsMap?: Record<string, PanelGroup>;
  timestamp: number;
  version?: number;
}

/**
 * Load dockview layout from localStorage
 * Falls back to legacy grid format and converts it
 */
export function loadDockviewLayout(): SerializedDockview | null {
  if (typeof window === "undefined") return null;

  try {
    // Try loading dockview format first
    const dockviewRaw = localStorage.getItem(DOCKVIEW_STORAGE_KEY);
    if (dockviewRaw) {
      const parsed = JSON.parse(dockviewRaw) as SerializedDockview;
      if (parsed && parsed.panels && parsed.groups) {
        return parsed;
      }
    }

    // Fall back to legacy grid format
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return null;

    const legacyState = JSON.parse(legacyRaw) as LegacyTabPersistState;

    // Check if it's the new grid format (version 2)
    if (legacyState.version === 2 || legacyState.gridState) {
      if (!legacyState.gridState || !legacyState.panelGroupsMap) {
        return null;
      }
      // Convert grid state to dockview layout
      return convertGridStateToDockview(legacyState.gridState, legacyState.panelGroupsMap);
    }

    // Old format (version 1) - would need migration to grid first
    // For now, return null to start fresh
    return null;
  } catch (e) {
    console.warn("Failed to load dockview layout:", e);
    return null;
  }
}

/**
 * Save dockview layout to localStorage
 */
export function saveDockviewLayout(layout: SerializedDockview): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(DOCKVIEW_STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    console.warn("Failed to save dockview layout:", e);
  }
}

/**
 * Clear dockview layout from localStorage
 */
export function clearDockviewLayout(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(DOCKVIEW_STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear dockview layout:", e);
  }
}

/**
 * Convert grid state to dockview layout format
 * This is a one-time migration path for existing users
 */
function convertGridStateToDockview(
  gridState: GridState,
  panelGroupsMap: Record<string, PanelGroup>
): SerializedDockview | null {
  if (!gridState || !panelGroupsMap) return null;

  try {
    const layout: SerializedDockview = {
      panels: {},
      groups: {},
      dimensions: {
        width: gridState.width,
        height: gridState.height,
      },
    };

    // Process grid tree to build dockview layout
    processGridNode(gridState.root, null, panelGroupsMap, layout, gridState.orientation);

    return layout;
  } catch (e) {
    console.error("Failed to convert grid state to dockview:", e);
    return null;
  }
}

/**
 * Recursively process grid nodes to build dockview layout
 */
function processGridNode(
  node: GridNode,
  parentId: string | null,
  panelGroupsMap: Record<string, PanelGroup>,
  layout: SerializedDockview,
  rootOrientation: GridOrientation
): void {
  if (node.type === "leaf") {
    // Leaf node - create a group and add its panels
    const groupId = node.groupId;
    const panelGroup = panelGroupsMap[groupId];

    if (!panelGroup) return;

    // Create group
    layout.groups![groupId] = {
      id: groupId,
      type: "group",
      groups: [groupId],
      activeView: panelGroup.activeTabId || undefined,
      hideHeader: false,
    };

    // Add panels (tabs) to the group
    for (const tab of panelGroup.tabs) {
      const tabData = convertTabToDockview(tab);
      if (tabData) {
        layout.panels![tab.id] = {
          id: tab.id,
          title: tab.title,
          tabComponent: "default",
          view: tab.kind,
          component: tab.kind,
          params: {
            tab: tabData,
          },
          groupId: groupId,
          title: tab.title || "Tab",
        };
      }
    }
  } else {
    // Branch node - this is a split container
    const branchId = `branch-${node.children.map((c) => (c.type === "leaf" ? c.groupId : "branch")).join("-")}`;

    // Determine direction from orientation
    const direction = node.orientation === "horizontal" ? "horizontal" : "vertical";

    // Create branch group
    layout.groups![branchId] = {
      id: branchId,
      type: "branch",
      groups: node.children.map((child) =>
        child.type === "leaf" ? child.groupId : `branch-${child.children.map((c) => (c.type === "leaf" ? c.groupId : "branch")).join("-")}`
      ),
      sizes: node.sizes,
      activeView: undefined,
    };

    // Process children recursively
    for (const child of node.children) {
      processGridNode(child, branchId, panelGroupsMap, layout, rootOrientation);
    }
  }
}

/**
 * Convert a UnifiedTab to dockview params format
 */
function convertTabToDockview(tab: import("../types").UnifiedTab): unknown {
  // Return tab data directly - it's already serializable
  return tab;
}

/**
 * Save layout using dockview API
 * Delegates to api.toJSON() and saves to localStorage
 */
export function persistDockviewLayout(api: DockviewApi): void {
  try {
    const layout = api.toJSON();
    saveDockviewLayout(layout);
  } catch (e) {
    console.warn("Failed to persist dockview layout:", e);
  }
}

/**
 * Restore layout using dockview API
 * Loads from localStorage and delegates to api.fromJSON()
 */
export function restoreDockviewLayout(api: DockviewApi): void {
  try {
    const layout = loadDockviewLayout();
    if (layout) {
      api.fromJSON(layout);
    }
  } catch (e) {
    console.warn("Failed to restore dockview layout:", e);
  }
}

/**
 * Initialize dockview with panels from legacy state
 * Called when dockview is ready to populate initial panels
 */
export function initializeDockviewFromLegacy(
  api: DockviewApi,
  panelGroupsMap: Record<string, PanelGroup>
): void {
  try {
    // Try to restore from dockview format first
    const layout = loadDockviewLayout();
    if (layout) {
      api.fromJSON(layout);
      return;
    }

    // Fall back to legacy panel groups
    if (!panelGroupsMap || Object.keys(panelGroupsMap).length === 0) {
      return;
    }

    // Add panels from the first group (or create empty group)
    const firstGroupId = Object.keys(panelGroupsMap)[0];
    const firstGroup = panelGroupsMap[firstGroupId];

    if (!firstGroup || firstGroup.tabs.length === 0) {
      return;
    }

    // Add tabs to dockview
    for (const tab of firstGroup.tabs) {
      try {
        api.addPanel({
          id: tab.id,
          component: tab.kind,
          title: tab.title,
          params: { tab },
        });
      } catch (e) {
        console.warn(`Failed to add panel ${tab.id}:`, e);
      }
    }
  } catch (e) {
    console.warn("Failed to initialize dockview from legacy:", e);
  }
}
