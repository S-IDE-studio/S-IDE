import { memo, useCallback } from "react";
import type { PanelGroup } from "../../types";
import { PanelTabList } from "./PanelTabList";
import { PanelContent } from "./PanelContent";

interface UnifiedPanelContainerProps {
  group: PanelGroup;
  isFocused: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onFocus: () => void;
  // Workspace data
  workspaceStates?: Record<string, {
    tree?: import("../../types").FileTreeNode[];
    treeLoading?: boolean;
    treeError?: string | null;
  }>;
  gitFiles?: import("../../types").GitFileStatus[];
  // Workspace handlers
  onToggleDir?: (node: import("../../types").FileTreeNode) => void;
  onOpenFile?: (node: import("../../types").FileTreeNode) => void;
  onRefreshTree?: () => void;
  onCreateFile?: (parentPath: string, fileName: string) => void;
  onCreateDirectory?: (parentPath: string, dirName: string) => void;
  onDeleteFile?: (filePath: string) => void;
  onDeleteDirectory?: (dirPath: string) => void;
  // Deck/Terminal data
  deckStates?: Record<string, {
    terminals?: import("../../types").TerminalSession[];
    terminalGroups?: import("../../types").TerminalGroup[];
    isCreatingTerminal?: boolean;
  }>;
  wsBase?: string;
  // Deck/Terminal handlers
  onDeleteTerminal?: (terminalId: string) => void;
  onReorderTerminals?: (deckId: string, newOrder: import("../../types").TerminalSession[]) => void;
  onCreateTerminal?: () => void;
  onToggleGroupCollapsed?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onRenameGroup?: (groupId: string) => void;
  // Editor handlers
  onChangeFile?: (fileId: string, contents: string) => void;
  onSaveFile?: (fileId: string) => void;
  savingFileId?: string | null;
}

export function UnifiedPanelContainer({
  group,
  isFocused,
  onSelectTab,
  onCloseTab,
  onFocus,
  workspaceStates,
  gitFiles,
  onToggleDir,
  onOpenFile,
  onRefreshTree,
  onCreateFile,
  onCreateDirectory,
  onDeleteFile,
  onDeleteDirectory,
  deckStates,
  wsBase,
  onDeleteTerminal,
  onReorderTerminals,
  onCreateTerminal,
  onToggleGroupCollapsed,
  onDeleteGroup,
  onRenameGroup,
  onChangeFile,
  onSaveFile,
  savingFileId,
}: UnifiedPanelContainerProps) {
  const activeTab = group.tabs.find((t) => t.id === group.activeTabId);

  const handleContainerClick = useCallback(() => {
    onFocus();
  }, [onFocus]);

  const handleSelectTab = useCallback(
    (tabId: string) => {
      onSelectTab(tabId);
    },
    [onSelectTab]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      onCloseTab(tabId);
    },
    [onCloseTab]
  );

  // Get workspace state for workspace tabs
  const getWorkspaceState = () => {
    if (activeTab?.kind === "workspace" && activeTab.data.workspace) {
      return workspaceStates?.[activeTab.data.workspace.id];
    }
    return undefined;
  };

  // Get deck state for deck/terminal tabs
  const getDeckState = () => {
    if (activeTab?.kind === "deck" && activeTab.data.deck) {
      return deckStates?.[activeTab.data.deck.id];
    }
    return undefined;
  };

  return (
    <div
      className={`panel-group ${isFocused ? "focused" : ""}`}
      onClick={handleContainerClick}
    >
      {/* Tab List */}
      <PanelTabList
        tabs={group.tabs}
        activeTabId={group.activeTabId}
        onTabSelect={handleSelectTab}
        onTabClose={handleCloseTab}
      />

      {/* Content */}
      <div className="panel-content">
        {activeTab ? (
          <PanelContent
            tab={activeTab}
            workspaceState={getWorkspaceState()}
            gitFiles={gitFiles}
            onToggleDir={onToggleDir}
            onOpenFile={onOpenFile}
            onRefreshTree={onRefreshTree}
            onCreateFile={onCreateFile}
            onCreateDirectory={onCreateDirectory}
            onDeleteFile={onDeleteFile}
            onDeleteDirectory={onDeleteDirectory}
            deckState={getDeckState()}
            wsBase={wsBase}
            onDeleteTerminal={onDeleteTerminal}
            onReorderTerminals={onReorderTerminals}
            onCreateTerminal={onCreateTerminal}
            onToggleGroupCollapsed={onToggleGroupCollapsed}
            onDeleteGroup={onDeleteGroup}
            onRenameGroup={onRenameGroup}
            onChangeFile={onChangeFile}
            onSaveFile={onSaveFile}
            savingFileId={savingFileId}
          />
        ) : (
          <div className="panel-empty">
            <p>パネルを選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const MemoizedUnifiedPanelContainer = memo(UnifiedPanelContainer);
