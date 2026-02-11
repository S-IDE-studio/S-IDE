/**
 * URL and routing utilities
 */

import type { GroupLayout } from "../types";
import { migratePanelGroupsMapTabKinds, migratePanelGroupTabKinds } from "./tabMigration";
import type { UnifiedTab } from "../types";

/** Local type for URL persistence - represents old panel group format */
interface PanelGroup {
  id: string;
  tabs: UnifiedTab[];
  activeTabId: string | null;
  focused: boolean;
  percentage: number;
}

/** Local type for URL persistence - represents old grid state format */
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

type AppView = "workspace" | "terminal";
type WorkspaceMode = "list" | "editor";

export type UrlState = {
  view: AppView;
  workspaceId: string | null;
  deckIds: string[];
  workspaceMode: WorkspaceMode;
};

const STORAGE_KEY = "side-ide-tabs";

/**
 * Tab persistence state stored in localStorage
 * Supports both old format (panelGroups) and new format (gridState)
 */
export type TabPersistState = {
  panelGroups?: PanelGroup[];
  panelLayout?: GroupLayout;
  gridState?: GridState;
  panelGroupsMap?: Record<string, PanelGroup>;
  timestamp: number;
  version?: number; // 1 = old format, 2 = new grid format
};

/**
 * Parses URL search parameters into application state
 */
export function parseUrlState(): UrlState {
  if (typeof window === "undefined") {
    return {
      view: "terminal",
      workspaceId: null,
      deckIds: [],
      workspaceMode: "list",
    };
  }
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get("view");
  const modeParam = params.get("mode");
  const deckParam = params.get("decks") || params.get("deck");
  const deckIds = deckParam ? deckParam.split(",").filter(Boolean) : [];
  return {
    view: viewParam === "workspace" ? "workspace" : "terminal",
    workspaceId: params.get("workspace"),
    deckIds,
    workspaceMode: modeParam === "editor" ? "editor" : "list",
  };
}

/**
 * Save tab state to localStorage (new grid format)
 */
export function saveTabState(
  gridState: GridState,
  panelGroupsMap: Record<string, PanelGroup>
): void;
/**
 * Save tab state to localStorage (old format for backward compatibility)
 */
export function saveTabState(panelGroups: PanelGroup[], panelLayout: GroupLayout): void;
/**
 * Save tab state to localStorage implementation
 */
export function saveTabState(
  gridStateOrGroups: GridState | PanelGroup[],
  panelGroupsMapOrLayout: Record<string, PanelGroup> | GroupLayout
): void {
  if (typeof window === "undefined") return;
  try {
    // Detect which overload was called based on types
    const isGridFormat =
      typeof gridStateOrGroups === "object" &&
      "root" in gridStateOrGroups &&
      "orientation" in gridStateOrGroups;

    if (isGridFormat) {
      // New grid format
      const state: TabPersistState = {
        gridState: gridStateOrGroups as GridState,
        panelGroupsMap: panelGroupsMapOrLayout as Record<string, PanelGroup>,
        timestamp: Date.now(),
        version: 2,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      // Old format (backward compatibility)
      const state: TabPersistState = {
        panelGroups: gridStateOrGroups as PanelGroup[],
        panelLayout: panelGroupsMapOrLayout as GroupLayout,
        timestamp: Date.now(),
        version: 1,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    // Ignore storage errors (e.g., quota exceeded, private mode)
    console.warn("Failed to save tab state:", e);
  }
}

/**
 * Load tab state from localStorage
 * Returns either new grid format or old format for backward compatibility
 */
export function loadTabState():
  | {
      gridState: GridState;
      panelGroupsMap: Record<string, PanelGroup>;
      format: "grid";
    }
  | {
      panelGroups: PanelGroup[];
      panelLayout: GroupLayout;
      format: "old";
    }
  | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state: TabPersistState = JSON.parse(raw);

    // Check for new grid format (version 2)
    if (state.version === 2 || state.gridState) {
      if (!state.gridState || !state.panelGroupsMap) {
        return null;
      }
      return {
        gridState: state.gridState,
        panelGroupsMap: migratePanelGroupsMapTabKinds(state.panelGroupsMap),
        format: "grid",
      };
    }

    // Old format (version 1 or no version field)
    if (
      !Array.isArray(state.panelGroups) ||
      !state.panelLayout ||
      typeof state.panelLayout.direction !== "string"
    ) {
      return null;
    }

    return {
      panelGroups: state.panelGroups.map(migratePanelGroupTabKinds),
      panelLayout: state.panelLayout,
      format: "old",
    };
  } catch (e) {
    // Invalid data in storage
    console.warn("Failed to load tab state:", e);
    return null;
  }
}

/**
 * Clear saved tab state from localStorage
 */
export function clearTabState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear tab state:", e);
  }
}
