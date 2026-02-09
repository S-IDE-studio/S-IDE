export type FileEntryType = "file" | "dir";
export interface Workspace {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  color?: string;
}
export interface Deck {
  id: string;
  name: string;
  root: string;
  workspaceId: string;
  createdAt: string;
}
export interface FileSystemEntry {
  name: string;
  path: string;
  type: FileEntryType;
}
export interface FileTreeNode extends FileSystemEntry {
  expanded: boolean;
  loading: boolean;
  children?: FileTreeNode[];
}
export interface EditorFile {
  id: string;
  name: string;
  path: string;
  language: string;
  contents: string;
  dirty: boolean;
}
export interface TerminalSession {
  id: string;
  title: string;
  createdAt?: string;
  groupId?: string;
  color?: string;
  tags?: string[];
  parentId?: string;
  shell?: string;
  type?: "default" | "claude" | "codex";
}
export interface TerminalGroup {
  id: string;
  name: string;
  color: string;
  terminalIds: string[];
  collapsed?: boolean;
}
export interface EditorGroup {
  id: string;
  tabs: EditorFile[];
  activeTabId: string | null;
  focused: boolean;
  percentage: number;
}
export interface GroupLayout {
  direction: "horizontal" | "vertical" | "single";
  sizes: number[];
}
export interface WorkspaceState {
  files: EditorFile[];
  activeFileId: string | null;
  tree: FileTreeNode[];
  treeLoading: boolean;
  treeError: string | null;
  editorGroups?: EditorGroup[];
  focusedGroupId?: string | null;
  groupLayout?: GroupLayout;
}
export interface DeckState {
  terminals: TerminalSession[];
  terminalsLoaded: boolean;
  view: "filetree" | "terminal";
}
export interface ApiError {
  error: string;
}
export interface ApiConfig {
  defaultRoot: string;
}
export interface ApiFileResponse {
  path: string;
  contents: string;
}
export interface ApiFileSaveResponse {
  path: string;
  saved: boolean;
}
export interface ApiTerminalCreateResponse {
  id: string;
  title: string;
}
export interface CreateWorkspaceRequest {
  path: string;
  name?: string;
}
export interface CreateDeckRequest {
  name?: string;
  workspaceId: string;
}
export interface CreateTerminalRequest {
  deckId: string;
  title?: string;
  command?: string;
  shellId?: string;
}
export interface ShellInfo {
  id: string;
  name: string;
  path: string;
  args: string[];
  icon?: string;
  category: "default" | "wsl" | "git" | "other";
}
export interface SaveFileRequest {
  workspaceId: string;
  path: string;
  contents: string;
}
export interface GetFileRequest {
  workspaceId: string;
  path: string;
}
export interface GetFilesRequest {
  workspaceId: string;
  path?: string;
}
export interface GetPreviewRequest {
  path: string;
  subpath?: string;
}
export type GitFileStatusCode =
  | "modified"
  | "staged"
  | "untracked"
  | "deleted"
  | "renamed"
  | "conflicted";
export interface GitFileStatus {
  path: string;
  status: GitFileStatusCode;
  staged: boolean;
}
export interface GitStatus {
  isGitRepo: boolean;
  branch: string;
  files: GitFileStatus[];
}
export interface GitDiff {
  original: string;
  modified: string;
  path: string;
}
export interface GitRepoInfo {
  path: string;
  name: string;
  branch: string;
  fileCount: number;
}
export interface GitFileStatusWithRepo extends GitFileStatus {
  repoPath: string;
}
export interface MultiRepoGitStatus {
  repos: GitRepoInfo[];
  files: GitFileStatusWithRepo[];
}
export type AgentId = "claude" | "codex" | "copilot" | "cursor" | "kimi";
export interface AgentConfig {
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  mcpServers?: MCPConfig[];
  skills?: SkillConfig[];
  [key: string]: unknown;
}
export interface MCPConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}
export interface SkillConfig {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map
