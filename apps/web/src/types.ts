// Import types used internally in this file
import type { EditorFile } from "@side-ide/shared/types";

// Re-export shared types from @side-ide/shared
export type {
  ApiConfig,
  ApiError,
  ApiFileResponse,
  ApiFileSaveResponse,
  ApiTerminalCreateResponse,
  CreateDeckRequest,
  CreateTerminalRequest,
  CreateWorkspaceRequest,
  Deck,
  DeckState,
  EditorFile,
  EditorGroup,
  FileEntryType,
  FileSystemEntry,
  FileTreeNode,
  GetFileRequest,
  GetFilesRequest,
  GetPreviewRequest,
  GitDiff,
  GitFileStatus,
  GitFileStatusCode,
  GitFileStatusWithRepo,
  GitRepoInfo,
  GitStatus,
  GroupLayout,
  MultiRepoGitStatus,
  SaveFileRequest,
  ShellInfo,
  TerminalGroup,
  TerminalSession,
  Workspace,
  WorkspaceState,
} from "@side-ide/shared/types";

// Context Manager API types
export type {
  CompactResponse,
  ContextManagerStatus,
  CreateSessionRequest,
  SnapshotListResponse,
  SnapshotResponse,
} from "./types/context-manager";

export type AppView = "workspace" | "terminal";
export type WorkspaceMode = "list" | "editor";
export type ThemeMode = "light" | "dark";
export type SidebarPanel = "files" | "git" | "ai" | "settings" | "servers" | "mcp";

export interface DragTabData {
  tabId: string;
  sourceGroupId: string;
}

// Editor group actions
export interface EditorGroupActions {
  splitGroup: (groupId: string, direction: "horizontal" | "vertical") => void;
  closeGroup: (groupId: string) => void;
  focusGroup: (groupId: string) => void;
  moveTabToGroup: (tabId: string, fromGroupId: string, toGroupId: string) => void;
  duplicateTabInGroup: (tabId: string, targetGroupId: string) => void;
  reorderTabsInGroup: (groupId: string, tabs: EditorFile[]) => void;
  resizeGroups: (sizes: number[]) => void;
}

export interface UrlState {
  view: AppView;
  workspaceId: string | null;
  deckId: string | null;
  workspaceMode: WorkspaceMode;
}

export interface DeckListItem {
  id: string;
  name: string;
  path: string;
}

// Agent types
export type AgentId = "claude" | "codex" | "copilot" | "cursor" | "kimi";

export interface Agent {
  id: AgentId;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
}

export interface AgentConfig {
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface MCPServer {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  status?: "active" | "inactive" | "error";
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  status?: "active" | "inactive" | "error";
}

// Local server detection types
export interface LocalServer {
  name: string;
  url: string;
  port: number;
  status: string;
  type: string;
}

// Unified Tab Panel System
export type TabKind =
  | "agent" // Agent terminal
  | "workspace" // Workspace (file tree)
  | "deck" // Deck (file editing)
  | "terminal" // Terminal session
  | "editor" // Editor tab (file)
  | "server" // Local server monitor
  | "mcp" // MCP server management
  | "remoteAccess" // Remote access (Tailscale)
  | "tunnel" // Legacy: remote tunnel (migrated to remoteAccess)
  | "serverSettings" // Server settings
  | "agentStatus" // Agent status panel
  | "agentConfig" // Agent config (global)
  | "agentConfigLocal" // Agent config (workspace-specific)
  | "setup"; // Setup panel

export interface UnifiedTab {
  id: string;
  kind: TabKind;
  title: string;
  icon?: string;
  dirty?: boolean;
  pinned?: boolean;
  /**
   * Multi-device tabs sync:
   * - `synced` tabs are mirrored from other clients and should not be persisted or re-advertised.
   * - `syncKey` is a stable identifier used for union/merge across devices.
   */
  synced?: boolean;
  syncKey?: string;
  data: {
    agent?: { id: string; name: string; icon: string };
    workspace?: { id: string; path: string; name: string };
    deck?: { id: string; name: string; root: string; workspaceId: string };
    terminal?: { id: string; command: string; cwd: string; workspaceId?: string };
    editor?: EditorFile;
    server?: { id: string; name: string };
    remoteAccess?: { id: string; name: string };
    tunnel?: { id: string; name: string; url?: string; status?: string }; // Legacy
    mcp?: { id: string; name: string };
    serverSettings?: {};
    agentStatus?: {};
    agentConfig?: {};
    agentConfigLocal?: { workspaceId: string };
    setup?: {};
  };
}


// Tab context menu actions
export type TabContextMenuAction =
  | "close"
  | "closeOthers"
  | "closeToTheRight"
  | "closeToTheLeft"
  | "closeAll"
  | "splitRight"
  | "splitLeft"
  | "splitUp"
  | "splitDown"
  | "pin"
  | "unpin"
  | "duplicate";

/**
 * Direction for splitting panels in the grid.
 * Maps to VSCode's split directions for creating new panel views.
 */
export type SplitDirection = "up" | "down" | "left" | "right";
