/**
 * URL and routing utilities
 */

import type { GroupLayout, PanelGroup } from "../types";

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
 */
export type TabPersistState = {
  panelGroups: PanelGroup[];
  panelLayout: GroupLayout;
  timestamp: number;
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
 * Save tab state to localStorage
 */
export function saveTabState(panelGroups: PanelGroup[], panelLayout: GroupLayout): void {
  if (typeof window === "undefined") return;
  try {
    const state: TabPersistState = {
      panelGroups,
      panelLayout,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Ignore storage errors (e.g., quota exceeded, private mode)
    console.warn("Failed to save tab state:", e);
  }
}

/**
 * Load tab state from localStorage
 */
export function loadTabState(): { panelGroups: PanelGroup[]; panelLayout: GroupLayout } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state: TabPersistState = JSON.parse(raw);

    // Validate state structure (basic check)
    if (
      !Array.isArray(state.panelGroups) ||
      !state.panelLayout ||
      typeof state.panelLayout.direction !== "string"
    ) {
      return null;
    }

    return {
      panelGroups: state.panelGroups,
      panelLayout: state.panelLayout,
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
