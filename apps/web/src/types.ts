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
  MultiRepoGitStatus,
  SaveFileRequest,
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

// Editor Groups for VSCode-style tab management
export interface EditorGroup {
  id: string;
  tabs: EditorFile[];
  activeTabId: string | null;
  focused: boolean;
  percentage: number; // Split size percentage (for resize)
}

export interface GroupLayout {
  direction: 'horizontal' | 'vertical' | 'single';
  sizes: number[]; // Size percentages for each group
}

export interface DragTabData {
  tabId: string;
  sourceGroupId: string;
}

// Editor group actions
export interface EditorGroupActions {
  splitGroup: (groupId: string, direction: 'horizontal' | 'vertical') => void;
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
