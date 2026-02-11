/**
 * Dockview layout utilities for migration from grid-based system
 * Handles conversion between grid state format and dockview JSON format
 */

import type { DockviewApi, SerializedDockview } from "dockview";
import { Orientation } from "dockview-core";
import type { UnifiedTab } from "../types";

/** Local types for legacy grid format migration */
interface GridLeafNode {
  readonly type: "leaf";
  readonly groupId: string;
  readonly size: number;
}

interface GridBranchNode {
  readonly type: "branch";
  readonly orientation: "horizontal" | "vertical";
  readonly children: GridNode[];
  readonly size: number;
}

type GridNode = GridBranchNode | GridLeafNode;

interface GridState {
  readonly root: GridNode;
  readonly orientation: "horizontal" | "vertical";
  readonly width: number;
  readonly height: number;
}

interface PanelGroup {
  id: string;
  tabs: UnifiedTab[];
  activeTabId: string | null;
  focused: boolean;
  percentage: number;
}

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
      if (parsed && parsed.panels) {
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
    // Convert orientation from string to Dockview's Orientation enum
    const orientation =
      gridState.orientation === "horizontal" ? Orientation.HORIZONTAL : Orientation.VERTICAL;

    const layout: SerializedDockview = {
      grid: {
        root: {
          type: "branch",
          size: 100,
          data: [],
        },
        height: gridState.height,
        width: gridState.width,
        orientation: orientation,
      },
      panels: {},
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
  rootOrientation: "horizontal" | "vertical"
): void {
  if (node.type === "leaf") {
    // Leaf node - create panel entries for each tab
    const groupId = node.groupId;
    const panelGroup = panelGroupsMap[groupId];

    if (!panelGroup) return;

    // Create panel entries for each tab
    for (const tab of panelGroup.tabs) {
      const tabData = convertTabToDockview(tab);
      if (tabData) {
        layout.panels![tab.id] = {
          id: tab.id,
          tabComponent: "default",
          params: { tab: tabData },
          title: tab.title || "Tab",
        };
      }
    }
  } else {
    // Branch node - this is a split container
    // For simplified migration, just process all children
    for (const child of node.children) {
      processGridNode(
        child,
        node.type === "branch"
          ? `branch-${node.children.map((c) => (c.type === "leaf" ? (c as GridLeafNode).groupId : "branch")).join("-")}`
          : null,
        panelGroupsMap,
        layout,
        rootOrientation
      );
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
