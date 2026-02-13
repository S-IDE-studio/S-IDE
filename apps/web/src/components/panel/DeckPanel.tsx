import { memo } from "react";
import type { FileTreeNode, GitFileStatus, TerminalGroup, TerminalSession } from "../../types";
import { FileTree } from "../FileTree";

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

export function DeckPanel({
  deck,
  updateWorkspaceState: _updateWorkspaceState,
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
  view: _controlledView,
  onViewChange: _onViewChange,
}: DeckPanelProps) {
  void terminals;
  void wsBase;
  void deckId;
  void onDeleteTerminal;
  void onReorderTerminals;
  void terminalGroups;
  void onCreateTerminal;
  void onToggleGroupCollapsed;
  void onDeleteGroup;
  void onRenameGroup;
  void isCreatingTerminal;

  return (
    <div className="deck-panel-content">
      <FileTree
        root={deck.root}
        entries={tree}
        loading={treeLoading}
        error={treeError}
        onToggleDir={(node) => onToggleDir?.(node)}
        onOpenFile={(node) => onOpenFile?.(node)}
        onRefresh={() => onRefreshTree?.()}
        onCreateFile={onCreateFile}
        onCreateDirectory={onCreateDirectory}
        onDeleteFile={onDeleteFile}
        onDeleteDirectory={onDeleteDirectory}
        gitFiles={gitFiles}
        variant="deck"
      />
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
