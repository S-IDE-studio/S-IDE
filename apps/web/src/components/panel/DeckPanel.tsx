import { PanelLeft } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import type { FileTreeNode, GitFileStatus, TerminalGroup, TerminalSession } from "../../types";
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
  // View control (optional - if not provided, uses local state)
  view?: "filetree" | "terminal";
  onViewChange?: (view: "filetree" | "terminal") => void;
}

type DeckView = "filetree" | "terminal";

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
  // View control props
  view: controlledView,
  onViewChange,
}: DeckPanelProps) {
  // Use controlled view if provided, otherwise use local state
  const [localView, setLocalView] = useState<DeckView>("filetree");
  const view = controlledView ?? localView;

  // Sync local state when controlled view changes
  useEffect(() => {
    if (controlledView !== undefined) {
      setLocalView(controlledView);
    }
  }, [controlledView]);

  const [sidebarVisible, setSidebarVisible] = useState(true);

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

  const handleSetView = useCallback(
    (newView: DeckView) => {
      if (onViewChange) {
        onViewChange(newView);
      } else {
        setLocalView(newView);
      }
    },
    [onViewChange]
  );

  return (
    <div className="deck-panel-content">
      {/* Sidebar - FileTree */}
      {sidebarVisible && view === "filetree" && (
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
                className={`chip ${view === "filetree" ? "active" : ""}`}
                onClick={() => handleSetView("filetree")}
              >
                Files
              </button>
              <button
                type="button"
                className={`chip ${view === "terminal" ? "active" : ""}`}
                onClick={() => handleSetView("terminal")}
              >
                Terminal
              </button>
            </div>
          </div>
        )}

        {/* FileTree View */}
        {view === "filetree" && sidebarVisible && (
          <div className="deck-placeholder">
            <p>ファイルを開くには、左側のファイルツリーからファイルを選択してください</p>
          </div>
        )}

        {/* Terminal View */}
        {view === "terminal" ? (
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
        ) : null}
      </div>
    </div>
  );
}

// Memoize with custom comparison to prevent unnecessary re-renders
const areEqual = (prevProps: DeckPanelProps, nextProps: DeckPanelProps): boolean => {
  return (
    prevProps.deck.id === nextProps.deck.id &&
    prevProps.deck.name === nextProps.deck.name &&
    prevProps.tree === nextProps.tree &&
    prevProps.treeLoading === nextProps.treeLoading &&
    prevProps.treeError === nextProps.treeError &&
    (prevProps.terminals?.length ?? 0) === (nextProps.terminals?.length ?? 0) &&
    prevProps.isCreatingTerminal === nextProps.isCreatingTerminal &&
    prevProps.view === nextProps.view
  );
};

export const MemoizedDeckPanel = memo(DeckPanel, areEqual);
