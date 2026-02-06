import { PanelLeft } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import type {
  EditorFile,
  FileTreeNode,
  GitFileStatus,
  TerminalGroup,
  TerminalSession,
} from "../../types";
import { EditorPane } from "../EditorPane";
import { FileTree } from "../FileTree";
import { TerminalPane } from "../TerminalPane";

interface DeckPanelProps {
  deck: { id: string; name: string; root: string; workspaceId: string };
  // Workspace state updater
  updateWorkspaceState?: (
    workspaceId: string,
    updater: (state: import("../../types").WorkspaceState) => import("../../types").WorkspaceState
  ) => void;
  // FileTree props
  tree?: FileTreeNode[];
  treeLoading?: boolean;
  treeError?: string | null;
  gitFiles?: GitFileStatus[];
  onToggleDir?: (node: FileTreeNode) => void;
  onOpenFile?: (node: FileTreeNode) => void;
  onRefreshTree?: () => void;
  onCreateFile?: (parentPath: string, fileName: string) => void;
  onCreateDirectory?: (parentPath: string, dirName: string) => void;
  onDeleteFile?: (filePath: string) => void;
  onDeleteDirectory?: (dirPath: string) => void;
  // Editor props
  editorFiles?: EditorFile[];
  activeFileId?: string | null;
  onSelectFile?: (fileId: string) => void;
  onCloseFile?: (fileId: string) => void;
  onChangeFile?: (fileId: string, contents: string) => void;
  onSaveFile?: (fileId: string) => void;
  savingFileId?: string | null;
  // TerminalPane props
  terminals?: TerminalSession[];
  wsBase?: string;
  deckId: string;
  onDeleteTerminal: (terminalId: string) => void;
  onReorderTerminals?: (deckId: string, newOrder: TerminalSession[]) => void;
  terminalGroups?: TerminalGroup[];
  onCreateTerminal?: () => void;
  onToggleGroupCollapsed?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onRenameGroup?: (groupId: string) => void;
  isCreatingTerminal?: boolean;
}

type DeckView = "editor" | "terminal";

export function DeckPanel({
  deck,
  updateWorkspaceState,
  // FileTree props
  tree = [],
  treeLoading,
  treeError,
  gitFiles,
  onToggleDir,
  onOpenFile,
  onRefreshTree,
  onCreateFile,
  onCreateDirectory,
  onDeleteFile,
  onDeleteDirectory,
  // Editor props
  editorFiles = [],
  activeFileId = null,
  onSelectFile,
  onCloseFile,
  onChangeFile,
  onSaveFile,
  savingFileId = null,
  // TerminalPane props
  terminals = [],
  wsBase = "",
  deckId,
  onDeleteTerminal,
  onReorderTerminals,
  terminalGroups = [],
  onCreateTerminal,
  onToggleGroupCollapsed,
  onDeleteGroup,
  onRenameGroup,
  isCreatingTerminal = false,
}: DeckPanelProps) {
  const [view, setView] = useState<DeckView>("editor");
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Stabilize callback functions to prevent unnecessary re-renders
  const handleSelectFile = useCallback(
    (fileId: string) => {
      onSelectFile?.(fileId);
    },
    [onSelectFile]
  );

  const handleCloseFile = useCallback(
    (fileId: string) => {
      onCloseFile?.(fileId);
    },
    [onCloseFile]
  );

  const handleChangeFile = useCallback(
    (fileId: string, contents: string) => {
      onChangeFile?.(fileId, contents);
    },
    [onChangeFile]
  );

  const handleSaveFile = useCallback(
    (fileId: string) => {
      onSaveFile?.(fileId);
    },
    [onSaveFile]
  );

  const handleToggleDir = useCallback(
    (node: FileTreeNode) => {
      onToggleDir?.(node);
    },
    [onToggleDir]
  );

  const handleOpenFile = useCallback(
    (node: FileTreeNode) => {
      onOpenFile?.(node);
    },
    [onOpenFile]
  );

  const handleRefreshTree = useCallback(() => {
    onRefreshTree?.();
  }, [onRefreshTree]);

  // Memoize editor files to prevent unnecessary re-renders
  const memoizedEditorFiles = useMemo(() => editorFiles, [editorFiles]);

  return (
    <div className="deck-panel-content">
      {/* File Tree Sidebar */}
      {sidebarVisible && (
        <div className="deck-sidebar">
          <div className="deck-sidebar-header">
            <span className="deck-sidebar-title">{deck.name}</span>
            <button
              type="button"
              className="icon-button"
              onClick={() => setSidebarVisible(false)}
              title="Hide sidebar"
            >
              <PanelLeft size={16} />
            </button>
          </div>
          <FileTree
            root={deck.root}
            entries={tree}
            loading={treeLoading}
            error={treeError}
            onToggleDir={handleToggleDir}
            onOpenFile={handleOpenFile}
            onRefresh={handleRefreshTree}
            onCreateFile={onCreateFile}
            onCreateDirectory={onCreateDirectory}
            onDeleteFile={onDeleteFile}
            onDeleteDirectory={onDeleteDirectory}
            gitFiles={gitFiles}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="deck-main">
        {/* View Toggle */}
        {!sidebarVisible && (
          <div className="deck-header">
            <button
              type="button"
              className="icon-button"
              onClick={() => setSidebarVisible(true)}
              title="Show sidebar"
            >
              <PanelLeft size={16} />
            </button>
            <div className="deck-view-toggle">
              <button
                type="button"
                className={`chip ${view === "editor" ? "active" : ""}`}
                onClick={() => setView("editor")}
              >
                Editor
              </button>
              <button
                type="button"
                className={`chip ${view === "terminal" ? "active" : ""}`}
                onClick={() => setView("terminal")}
              >
                Terminal
              </button>
            </div>
          </div>
        )}

        {/* Editor View */}
        {view === "editor" ? (
          <EditorPane
            files={memoizedEditorFiles}
            activeFileId={activeFileId}
            onSelectFile={handleSelectFile}
            onCloseFile={handleCloseFile}
            onChangeFile={handleChangeFile}
            onSaveFile={handleSaveFile}
            savingFileId={savingFileId}
          />
        ) : (
          <TerminalPane
            terminals={terminals}
            wsBase={wsBase}
            deckId={deckId}
            onDeleteTerminal={onDeleteTerminal}
            onReorderTerminals={onReorderTerminals}
            terminalGroups={terminalGroups}
            onCreateTerminal={onCreateTerminal}
            onToggleGroupCollapsed={onToggleGroupCollapsed}
            onDeleteGroup={onDeleteGroup}
            onRenameGroup={onRenameGroup}
            isCreatingTerminal={isCreatingTerminal}
          />
        )}
      </div>
    </div>
  );
}

// Memoize with custom comparison to prevent unnecessary re-renders
const areEqual = (prevProps: DeckPanelProps, nextProps: DeckPanelProps): boolean => {
  // Compare deck basic info
  if (prevProps.deck.id !== nextProps.deck.id) return false;
  if (prevProps.deck.name !== nextProps.deck.name) return false;

  // Compare tree state
  if (prevProps.tree !== nextProps.tree) return false;
  if (prevProps.treeLoading !== nextProps.treeLoading) return false;
  if (prevProps.treeError !== nextProps.treeError) return false;

  // Compare editor state by length and active file
  const prevFiles = prevProps.editorFiles;
  const nextFiles = nextProps.editorFiles;
  if (prevFiles.length !== nextFiles.length) return false;
  if (prevProps.activeFileId !== nextProps.activeFileId) return false;

  // Check if active file contents changed (by comparing the file object)
  const prevActiveFile = prevFiles.find((f) => f.id === prevProps.activeFileId);
  const nextActiveFile = nextFiles.find((f) => f.id === nextProps.activeFileId);
  if (prevActiveFile?.contents !== nextActiveFile?.contents) return false;
  if (prevActiveFile?.dirty !== nextActiveFile?.dirty) return false;

  // Compare saving state
  if (prevProps.savingFileId !== nextProps.savingFileId) return false;

  // Compare terminal state by length
  if (prevProps.terminals.length !== nextProps.terminals.length) return false;
  if (prevProps.isCreatingTerminal !== nextProps.isCreatingTerminal) return false;

  return true;
};

export const MemoizedDeckPanel = memo(DeckPanel, areEqual);
