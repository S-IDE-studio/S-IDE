/**
 * Utility functions for unified tab panel system
 * Converts existing data structures to UnifiedTab format
 */

import type { Agent, Deck, Workspace, EditorFile } from "../types";
import type { UnifiedTab, TabKind, PanelGroup, PanelLayout } from "../types";

export function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function generatePanelGroupId(): string {
  return `panel-group-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Convert Agent to UnifiedTab
 */
export function agentToTab(agent: Agent): UnifiedTab {
  return {
    id: generateTabId(),
    kind: 'agent',
    title: agent.name,
    icon: agent.icon,
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
    kind: 'workspace',
    title: name,
    icon: '📁',
    data: { workspace: { id: workspace.id, path: workspace.path, name } },
  };
}

/**
 * Convert Deck to UnifiedTab
 */
export function deckToTab(deck: Deck): UnifiedTab {
  return {
    id: generateTabId(),
    kind: 'deck',
    title: deck.name,
    icon: '📦',
    data: { deck: { id: deck.id, name: deck.name, root: deck.root, workspaceId: deck.workspaceId } },
  };
}

/**
 * Convert Terminal to UnifiedTab
 */
export function terminalToTab(terminal: { id: string; command: string; cwd: string }, deckId: string): UnifiedTab {
  return {
    id: generateTabId(),
    kind: 'terminal',
    title: terminal.command || 'Terminal',
    icon: '⚙️',
    data: { terminal: { id: terminal.id, command: terminal.command, cwd: terminal.cwd } },
  };
}

/**
 * Convert EditorFile to UnifiedTab
 */
export function editorToTab(file: EditorFile): UnifiedTab {
  return {
    id: file.id,
    kind: 'editor',
    title: file.name,
    icon: getFileIcon(file.name).icon,
    dirty: file.dirty,
    data: { editor: file },
  };
}

function getFileIcon(filename: string): { icon: string } {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    ts: 'TS', tsx: 'TSX', js: 'JS', jsx: 'JSX',
    json: '{ }', html: '<>', css: '#', scss: 'S',
    md: 'M↓', py: 'PY', go: 'GO', rs: 'RS',
    java: 'J', sql: 'SQL', yml: 'Y', yaml: 'Y',
    sh: '$', bash: '$', txt: 'TXT',
  };
  return { icon: iconMap[ext] || '📄' };
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
    layout: { direction: 'single', sizes: [100] },
  };
}
