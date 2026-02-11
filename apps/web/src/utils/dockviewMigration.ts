/**
 * Migration utility for converting legacy grid layout to dockview format.
 *
 * Maps the existing GridState + panelGroupsMap format to dockview's
 * SerializedDockview format for seamless layout migration.
 */

import type { SerializedDockview } from "dockview-core";
import { Orientation } from "dockview-core";
import type { UnifiedTab } from "../types";

/** Local types for legacy grid format migration */
interface GridLeafNode {
  readonly type: "leaf";
  readonly groupId: string;
  readonly size: number;
  readonly cachedVisibleSize?: number;
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

/**
 * Mapping from legacy component kind to dockview component name.
 * TabKind values map directly to dockview component names.
 */
type TabKind = UnifiedTab["kind"];

/**
 * Convert legacy GridOrientation to dockview Orientation enum.
 * Maps "horizontal" to Orientation.HORIZONTAL and "vertical" to Orientation.VERTICAL.
 */
function toDockviewOrientation(orientation: "horizontal" | "vertical"): Orientation {
  return orientation === "horizontal" ? Orientation.HORIZONTAL : Orientation.VERTICAL;
}

/**
 * Map TabKind to dockview component name.
 * In the new system, TabKind values are used directly as component names.
 */
function getComponentName(kind: TabKind): string {
  return kind;
}

/**
 * Determine the renderer type for a tab kind.
 * Terminal and editor panels should use 'always' renderer to maintain state.
 */
function getRendererForTabKind(kind: TabKind): "onlyWhenVisible" | "always" {
  if (kind === "terminal") {
    return "always"; // xterm.js requires persistent DOM
  }
  return "onlyWhenVisible";
}

/**
 * Convert a UnifiedTab to dockview GroupviewPanelState format.
 */
function tabToPanelState(tab: UnifiedTab): {
  id: string;
  contentComponent: string;
  tabComponent?: string;
  title: string;
  renderer?: "onlyWhenVisible" | "always";
  params: {
    tab: UnifiedTab;
  };
} {
  return {
    id: tab.id,
    contentComponent: getComponentName(tab.kind),
    title: tab.title,
    renderer: getRendererForTabKind(tab.kind),
    params: {
      tab,
    },
  };
}

/**
 * Convert a PanelGroup's tabs to dockview panels format.
 * Returns an array of panel states and the active panel ID.
 */
function convertPanelGroupToPanels(group: PanelGroup): {
  panels: Record<string, ReturnType<typeof tabToPanelState>>;
  activePanel: string | undefined;
} {
  const panels: Record<string, ReturnType<typeof tabToPanelState>> = {};

  for (const tab of group.tabs) {
    panels[tab.id] = tabToPanelState(tab);
  }

  return {
    panels,
    activePanel: group.activeTabId ?? undefined,
  };
}

/**
 * Recursively convert GridNode tree to dockview's SerializedGridObject format.
 *
 * Mapping strategy:
 * - GridLeafNode (type: "leaf") → SerializedGridObject with type: "leaf"
 * - GridBranchNode (type: "branch") → SerializedGridObject with type: "branch"
 * - groupId in leaf nodes references the PanelGroup for tab data
 * - size values are preserved as-is
 * - cachedVisibleSize maps to visible flag (undefined = true)
 */
function convertGridNode(
  node: GridNode,
  panelGroupsMap: Record<string, PanelGroup>
): {
  type: "leaf" | "branch";
  data: string | { size?: number; visible?: boolean }[];
  size?: number;
  visible?: boolean;
} {
  if (node.type === "leaf") {
    // Leaf node: contains a reference to a PanelGroup
    const group = panelGroupsMap[node.groupId];
    if (!group) {
      // If group not found, create an empty leaf
      return {
        type: "leaf",
        data: node.groupId,
        size: node.size,
        visible: node.cachedVisibleSize === undefined ? true : undefined,
      };
    }
    return {
      type: "leaf",
      data: node.groupId,
      size: node.size,
      visible: node.cachedVisibleSize === undefined ? true : undefined,
    };
  } else {
    // Branch node: contains children
    const children = node.children.map((child) => convertGridNode(child, panelGroupsMap));
    return {
      type: "branch",
      data: children,
      size: node.size,
    };
  }
}

/**
 * Convert legacy GridState and panelGroupsMap to dockview's SerializedDockview.
 *
 * This function transforms the existing layout format to dockview's serialization
 * format, enabling seamless migration of user layouts.
 *
 * @param gridState - The legacy grid state tree structure
 * @param panelGroupsMap - Map of group IDs to their panel groups with tabs
 * @returns SerializedDockview compatible with dockview's fromJSON method
 */
export function migrateToSerializedDockview(
  gridState: GridState,
  panelGroupsMap: Record<string, PanelGroup>
): SerializedDockview {
  // Convert the grid tree structure
  const rootGridNode = convertGridNode(gridState.root, panelGroupsMap);

  // Collect all panels from all groups
  const panels: Record<
    string,
    {
      id: string;
      contentComponent: string;
      tabComponent?: string;
      title: string;
      renderer?: "onlyWhenVisible" | "always";
      params: {
        tab: UnifiedTab;
      };
    }
  > = {};

  let activeGroup: string | undefined;

  for (const [groupId, group] of Object.entries(panelGroupsMap)) {
    const { panels: groupPanels } = convertPanelGroupToPanels(group);
    Object.assign(panels, groupPanels);

    // Track the focused group as the active group
    if (group.focused) {
      activeGroup = groupId;
    }
  }

  // Build the SerializedDockview structure
  return {
    grid: {
      root: rootGridNode as any, // Type assertion for nested structure
      height: gridState.height,
      width: gridState.width,
      orientation: toDockviewOrientation(gridState.orientation),
    },
    panels,
    activeGroup,
  };
}

/**
 * Convert dockview SerializedDockview back to legacy format.
 * This is useful for testing or rollback scenarios.
 *
 * @param serialized - The dockview serialized state
 * @returns Legacy grid state and panel groups map
 */
export function migrateFromSerializedDockview(serialized: SerializedDockview): {
  gridState: GridState;
  panelGroupsMap: Record<string, PanelGroup>;
} {
  const panelGroupsMap: Record<string, PanelGroup> = {};

  // Extract tabs from dockview panels and rebuild PanelGroups
  for (const [panelId, panelState] of Object.entries(serialized.panels)) {
    const tab: UnifiedTab = (panelState.params as { tab: UnifiedTab }).tab;

    // Find or create the group for this panel
    // In dockview, groups are identified by the container, not by a direct ID
    // We need to traverse the grid to find group associations
  }

  // Convert dockview grid back to GridNode tree
  // This requires traversing the serialized grid structure

  // TODO: Implement full reverse migration if needed for rollback
  throw new Error("Reverse migration not yet implemented");
}

/**
 * Validate if a legacy layout can be migrated.
 * Checks for required data structure and references.
 *
 * @param gridState - The legacy grid state
 * @param panelGroupsMap - Map of panel groups
 * @returns true if the layout is valid for migration
 */
export function canMigrateLayout(
  gridState: GridState,
  panelGroupsMap: Record<string, PanelGroup>
): boolean {
  // Check if gridState has valid root
  if (!gridState.root) {
    return false;
  }

  // Check if all group IDs referenced in the grid exist in panelGroupsMap
  function validateNode(node: GridNode): boolean {
    if (node.type === "leaf") {
      return node.groupId in panelGroupsMap;
    } else {
      return node.children.every(validateNode);
    }
  }

  return validateNode(gridState.root);
}

/**
 * Get statistics about a legacy layout before migration.
 * Useful for logging and debugging migration issues.
 *
 * @param gridState - The legacy grid state
 * @param panelGroupsMap - Map of panel groups
 * @returns Statistics about the layout
 */
export function getLayoutStats(
  gridState: GridState,
  panelGroupsMap: Record<string, PanelGroup>
): {
  totalGroups: number;
  totalTabs: number;
  maxDepth: number;
  groupIds: string[];
  tabKinds: Record<string, number>;
} {
  const groupIds = Object.keys(panelGroupsMap);
  let totalTabs = 0;
  const tabKinds: Record<string, number> = {};

  for (const group of Object.values(panelGroupsMap)) {
    totalTabs += group.tabs.length;
    for (const tab of group.tabs) {
      tabKinds[tab.kind] = (tabKinds[tab.kind] || 0) + 1;
    }
  }

  // Calculate tree depth
  function getDepth(node: GridNode, currentDepth = 0): number {
    if (node.type === "leaf") {
      return currentDepth;
    }
    return Math.max(...node.children.map((child) => getDepth(child, currentDepth + 1)));
  }

  return {
    totalGroups: groupIds.length,
    totalTabs,
    maxDepth: getDepth(gridState.root),
    groupIds,
    tabKinds,
  };
}
