/**
 * Utility functions for unified tab panel system
 * Converts existing data structures to UnifiedTab format
 */

import type {
  Agent,
  Deck,
  EditorFile,
  PanelGroup,
  PanelLayout,
  UnifiedTab,
  Workspace,
} from "../types";

export function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function generatePanelGroupId(): string {
  return `panel-group-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Convert Agent to UnifiedTab
 */
export function agentToTab(
  agent: Agent | { id: string; name: string; icon: string; description?: string; enabled?: boolean }
): UnifiedTab {
  return {
    id: generateTabId(),
    kind: "agent",
    title: agent.name,
    // Icon is rendered by DraggableTab based on kind
    data: { agent: { id: agent.id, name: agent.name, icon: agent.icon } },
  };
}

/**
 * Convert Workspace to UnifiedTab
 */
export function workspaceToTab(workspace: Workspace): UnifiedTab {
  const name = workspace.path.split(/[/\\]/).pop() || workspace.path;
  return {
    id: generateTabId(),
    kind: "workspace",
    title: name,
    // Icon is rendered by DraggableTab based on kind
    data: { workspace: { id: workspace.id, path: workspace.path, name } },
  };
}

/**
 * Convert Deck to UnifiedTab
 */
export function deckToTab(deck: Deck): UnifiedTab {
  return {
    id: generateTabId(),
    kind: "deck",
    title: deck.name,
    // Icon is rendered by DraggableTab based on kind
    data: {
      deck: { id: deck.id, name: deck.name, root: deck.root, workspaceId: deck.workspaceId },
    },
  };
}

/**
 * Convert Terminal to UnifiedTab
 */
export function terminalToTab(
  terminal: { id: string; command: string; cwd: string },
  deckId: string
): UnifiedTab {
  return {
    id: generateTabId(),
    kind: "terminal",
    title: terminal.command || "Terminal",
    // Icon is rendered by DraggableTab based on kind
    data: { terminal: { id: terminal.id, command: terminal.command, cwd: terminal.cwd } },
  };
}

/**
 * Convert EditorFile to UnifiedTab
 * Icon is optional and rendered by DraggableTab based on file extension
 */
export function editorToTab(file: EditorFile): UnifiedTab {
  return {
    id: file.id,
    kind: "editor",
    title: file.name,
    icon: getFileIconString(file.name), // Store file extension for icon mapping
    dirty: file.dirty,
    data: { editor: file },
  };
}

/**
 * Create server list tab
 */
export function serverToTab(): UnifiedTab {
  return {
    id: generateTabId(),
    kind: "server",
    title: "Local Servers",
    // Icon is rendered by DraggableTab based on kind
    data: { server: { id: "local-servers", name: "Local Servers" } },
  };
}

/**
 * Create tunnel management tab
 */
export function tunnelToTab(): UnifiedTab {
  return {
    id: generateTabId(),
    kind: "tunnel",
    title: "Remote Access",
    // Icon is rendered by DraggableTab based on kind
    data: { tunnel: { id: "tunnel", name: "Remote Access" } },
  };
}

/**
 * Get file icon string for mapping to Lucide icons
 * Returns a string identifier that can be used to select the appropriate icon
 */
function getFileIconString(filename: string): string | undefined {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  // Return file type identifier for icon mapping in DraggableTab
  const typeMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    html: "html",
    css: "css",
    scss: "sass",
    md: "markdown",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    sql: "database",
    yml: "yaml",
    yaml: "yaml",
    sh: "terminal",
    bash: "terminal",
    txt: "file",
  };
  return typeMap[ext] || "file";
}

/**
 * Create empty panel group
 */
export function createEmptyPanelGroup(percentage: number = 100): PanelGroup {
  return {
    id: generatePanelGroupId(),
    tabs: [],
    activeTabId: null,
    focused: true,
    percentage,
  };
}

/**
 * Create single panel layout
 */
export function createSinglePanelLayout(): {
  groups: PanelGroup[];
  layout: PanelLayout;
} {
  return {
    groups: [createEmptyPanelGroup(100)],
    layout: { direction: "single", sizes: [100] },
  };
}
