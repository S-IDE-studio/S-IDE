import type { PanelGroup, TabKind, UnifiedTab, WorkspaceState } from "../types";

export interface TabsPresenceTab {
  syncKey: string;
  kind: string;
  title: string;
  data?: unknown;
}

function sanitizeForId(input: string): string {
  // Keep it DOM/id-safe and relatively short.
  const safe = input.replace(/[^a-zA-Z0-9:_-]+/g, "_");
  return safe.length > 120 ? safe.slice(0, 120) : safe;
}

export function syncTabIdFromKey(syncKey: string): string {
  return `sync-${sanitizeForId(syncKey)}`;
}

export function isTabKind(kind: string): kind is TabKind {
  return (
    kind === "agent" ||
    kind === "workspace" ||
    kind === "deck" ||
    kind === "terminal" ||
    kind === "editor" ||
    kind === "server" ||
    kind === "mcp" ||
    kind === "remoteAccess" ||
    kind === "tunnel" ||
    kind === "serverSettings" ||
    kind === "agentStatus" ||
    kind === "agentConfig" ||
    kind === "agentConfigLocal" ||
    kind === "setup"
  );
}

function findWorkspaceIdForEditorPath(
  editorPath: string,
  workspaceStates?: Record<string, WorkspaceState>
): string | null {
  if (!workspaceStates) return null;
  for (const [workspaceId, state] of Object.entries(workspaceStates)) {
    if (state?.files?.some((f) => f.path === editorPath)) return workspaceId;
  }
  return null;
}

export function getTabSyncKey(
  tab: UnifiedTab,
  ctx?: { workspaceStates?: Record<string, WorkspaceState> }
): string | null {
  if (tab.syncKey) return tab.syncKey;

  switch (tab.kind) {
    case "workspace":
      return tab.data.workspace?.id ? `workspace:${tab.data.workspace.id}` : null;
    case "deck":
      return tab.data.deck?.id ? `deck:${tab.data.deck.id}` : null;
    case "terminal":
      return tab.data.terminal?.id ? `terminal:${tab.data.terminal.id}` : null;
    case "editor": {
      const path = tab.data.editor?.path;
      if (!path) return null;
      const workspaceId = findWorkspaceIdForEditorPath(path, ctx?.workspaceStates);
      return workspaceId ? `editor:${workspaceId}:${path}` : `editor:${path}`;
    }
    case "server":
      return "server:local";
    case "mcp":
      return "mcp:servers";
    case "remoteAccess":
      return "remoteAccess:tailscale";
    case "serverSettings":
      return "serverSettings";
    case "agentStatus":
      return "agentStatus";
    case "agentConfig":
      return "agentConfig";
    case "agentConfigLocal":
      return tab.data.agentConfigLocal?.workspaceId
        ? `agentConfigLocal:${tab.data.agentConfigLocal.workspaceId}`
        : "agentConfigLocal";
    case "setup":
      return "setup";
    case "agent":
      return tab.data.agent?.id ? `agent:${tab.data.agent.id}` : null;
    case "tunnel":
      // Legacy alias; treat as remoteAccess
      return "remoteAccess:tailscale";
    default:
      return null;
  }
}

export function toPresenceTab(
  tab: UnifiedTab,
  ctx?: { workspaceStates?: Record<string, WorkspaceState> }
): TabsPresenceTab | null {
  const syncKey = getTabSyncKey(tab, ctx);
  if (!syncKey) return null;

  // Keep payload small but reconstructable.
  let data: any = undefined;

  if (tab.kind === "workspace" && tab.data.workspace) data = { workspace: tab.data.workspace };
  if (tab.kind === "deck" && tab.data.deck) data = { deck: tab.data.deck };
  if (tab.kind === "terminal" && tab.data.terminal) data = { terminal: tab.data.terminal };
  if (tab.kind === "editor" && tab.data.editor) {
    const workspaceId = findWorkspaceIdForEditorPath(tab.data.editor.path, ctx?.workspaceStates);
    data = { editor: tab.data.editor, workspaceId };
  }

  return {
    syncKey,
    kind: tab.kind,
    title: tab.title,
    data,
  };
}

export function createSyncedTabFromPresence(p: TabsPresenceTab): UnifiedTab | null {
  if (!p?.syncKey || !p.kind) return null;
  const kind = String(p.kind);
  if (!isTabKind(kind)) return null;

  const id = syncTabIdFromKey(p.syncKey);
  const title = p.title || kind;
  const tab: UnifiedTab = {
    id,
    kind,
    title,
    synced: true,
    syncKey: p.syncKey,
    data: {},
  };

  const data: any = p.data && typeof p.data === "object" ? p.data : undefined;

  if (kind === "workspace" && data?.workspace) tab.data.workspace = data.workspace;
  if (kind === "deck" && data?.deck) tab.data.deck = data.deck;
  if (kind === "terminal" && data?.terminal) tab.data.terminal = data.terminal;
  if (kind === "editor" && data?.editor) tab.data.editor = data.editor;

  if (kind === "remoteAccess") tab.data.remoteAccess = { id: "remote-access", name: "Remote" };
  if (kind === "server") tab.data.server = { id: "local-servers", name: "Local Servers" };
  if (kind === "mcp") tab.data.mcp = { id: "mcp-servers", name: "MCP Servers" };
  if (kind === "serverSettings") tab.data.serverSettings = {};
  if (kind === "agentStatus") tab.data.agentStatus = {};
  if (kind === "agentConfig") tab.data.agentConfig = {};
  if (kind === "setup") tab.data.setup = {};

  return tab;
}

export function listAllTabs(panelGroupsMap: Record<string, PanelGroup>): UnifiedTab[] {
  const tabs: UnifiedTab[] = [];
  for (const group of Object.values(panelGroupsMap)) {
    tabs.push(...(group.tabs || []));
  }
  return tabs;
}
