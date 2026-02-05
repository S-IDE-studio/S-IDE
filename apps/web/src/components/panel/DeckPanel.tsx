import { PanelLeft } from "lucide-react";
import { memo, useState } from "react";
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
            onToggleDir={onToggleDir ?? (() => {})}
            onOpenFile={onOpenFile ?? (() => {})}
            onRefresh={onRefreshTree ?? (() => {})}
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
            files={editorFiles}
            activeFileId={activeFileId}
            onSelectFile={onSelectFile ?? (() => {})}
            onCloseFile={onCloseFile ?? (() => {})}
            onChangeFile={onChangeFile ?? (() => {})}
            onSaveFile={onSaveFile}
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

export const MemoizedDeckPanel = memo(DeckPanel);
