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
  | "tunnel" // Remote tunnel
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
  data: {
    agent?: { id: string; name: string; icon: string };
    workspace?: { id: string; path: string; name: string };
    deck?: { id: string; name: string; root: string; workspaceId: string };
    terminal?: { id: string; command: string; cwd: string; workspaceId?: string };
    editor?: EditorFile;
    server?: { id: string; name: string };
    tunnel?: { id: string; name: string; url?: string; status?: string };
    mcp?: { id: string; name: string };
    serverSettings?: {};
    agentStatus?: {};
    agentConfig?: {};
    agentConfigLocal?: { workspaceId: string };
    setup?: {};
  };
}

export interface PanelGroup {
  id: string;
  tabs: UnifiedTab[];
  activeTabId: string | null;
  focused: boolean;
  percentage: number;
}

export interface PanelLayout {
  direction: "horizontal" | "vertical" | "single";
  sizes: number[];
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

/**
 * Grid orientation - determines how children are arranged.
 * Matches VSCode's Orientation enum from gridview.ts.
 */
export type GridOrientation = "horizontal" | "vertical";

/**
 * Sizing strategy for grid views.
 * Matches VSCode's Sizing from splitview.
 */
export enum Sizing {
  /** Automatically size the view based on its content */
  Auto = "auto",
  /** Split the space equally among siblings */
  Split = "split",
  /** Distribute available space proportionally */
  Distribute = "distribute",
  /** View is invisible but size is cached for restoration */
  Invisible = "invisible",
}

/**
 * Location of a view within the grid.
 * Array of indices representing the path from root to the view.
 * Example: [0, 1, 0] means root's first child's second child's first child.
 *
 * Matches VSCode's GridLocation type from gridview.ts.
 *
 * @example
 * For a grid like:
 *   +-----+---------------+
 *   |  A  |      B        |
 *   +-----+---------+-----+
 *   |        C      |     |
 *   +---------------+  D  |
 *   |        E      |     |
 *   +---------------+-----+
 *
 * Locations are:
 * - A: [0, 0]
 * - B: [0, 1]
 * - C: [1, 0, 0]
 * - D: [1, 1]
 * - E: [1, 0, 1]
 */
export type GridLocation = number[];

/**
 * Leaf node in the grid - contains an actual view (panel group).
 * Corresponds to a PanelGroup in the existing system.
 *
 * Matches VSCode's GridLeafNode interface.
 */
export interface GridLeafNode {
  /** Type discriminator for leaf nodes */
  readonly type: "leaf";
  /** ID of the panel group this leaf represents */
  readonly groupId: string;
  /** Size of this node in the parent's split direction */
  readonly size: number;
  /** Cached visible size when node is hidden (undefined if visible) */
  readonly cachedVisibleSize?: number;
  /** Whether this view is currently maximized */
  readonly maximized?: boolean;
}

/**
 * Branch node in the grid - contains child nodes.
 * Represents a split view that can be horizontal or vertical.
 *
 * Matches VSCode's GridBranchNode interface.
 */
export interface GridBranchNode {
  /** Type discriminator for branch nodes */
  readonly type: "branch";
  /** Orientation of this branch's split (horizontal or vertical) */
  readonly orientation: GridOrientation;
  /** Child nodes (can be branches or leaves) */
  readonly children: GridNode[];
  /** Size of this branch in the parent's split direction */
  readonly size: number;
  /** Size proportions for each child */
  readonly sizes: number[];
}

/**
 * Union type for grid nodes - can be either a branch or a leaf.
 * Matches VSCode's GridNode union type.
 */
export type GridNode = GridBranchNode | GridLeafNode;

/**
 * Type guard to check if a node is a branch node.
 * Matches VSCode's isGridBranchNode function.
 */
export function isGridBranchNode(node: GridNode): node is GridBranchNode {
  return node.type === "branch";
}

/**
 * Type guard to check if a node is a leaf node.
 */
export function isGridLeafNode(node: GridNode): node is GridLeafNode {
  return node.type === "leaf";
}

/**
 * Serialized grid state for persistence.
 * Can be saved to localStorage or database and restored later.
 *
 * Matches VSCode's ISerializedGridView interface.
 */
export interface GridState {
  /** Root node of the grid tree */
  readonly root: GridNode;
  /** Orientation of the root split */
  readonly orientation: GridOrientation;
  /** Width of the entire grid (for restoration) */
  readonly width: number;
  /** Height of the entire grid (for restoration) */
  readonly height: number;
}

/**
 * Box representing the position and size of a grid node.
 * Used during layout calculations.
 *
 * Matches VSCode's Box interface.
 */
export interface GridBox {
  /** Top position in pixels */
  readonly top: number;
  /** Left position in pixels */
  readonly left: number;
  /** Width in pixels */
  readonly width: number;
  /** Height in pixels */
  readonly height: number;
}

/**
 * View size constraints for grid layout.
 * Matches VSCode's IViewSize interface.
 */
export interface GridViewSize {
  readonly width: number;
  readonly height: number;
}
