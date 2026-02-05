/**
 * Unified Panel Container - VSCode-style panel with tabs, split, and resize
 */

import { memo, useCallback } from "react";
import type { PanelGroup, SplitDirection, TabContextMenuAction } from "../../types";
import { PanelContent } from "./PanelContent";
import { MemoizedPanelResizeHandle } from "./PanelResizeHandle";
import { MemoizedPanelSplitButton } from "./PanelSplitButton";
import { MemoizedPanelTabList } from "./PanelTabList";

interface UnifiedPanelContainerProps {
  group: PanelGroup;
  isFocused: boolean;
  isFirstPanel: boolean;
  isLastPanel: boolean;
  canSplitHorizontal: boolean;
  canSplitVertical: boolean;
  layoutDirection: "horizontal" | "vertical" | "single";
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onFocus: () => void;
  onTabsReorder: (oldIndex: number, newIndex: number) => void;
  onTabMove: (tabId: string, targetGroupId: string) => void;
  onSplitPanel: (direction: SplitDirection) => void;
  onClosePanel: () => void;
  onResize: (delta: number) => void;
  onContextMenuAction: (action: TabContextMenuAction, tabId: string) => void;
  // Workspace data
  workspaceStates?: Record<
    string,
    {
      tree?: import("../../types").FileTreeNode[];
      treeLoading?: boolean;
      treeError?: string | null;
    }
  >;
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
  deckStates?: Record<
    string,
    {
      terminals?: import("../../types").TerminalSession[];
      terminalGroups?: import("../../types").TerminalGroup[];
      isCreatingTerminal?: boolean;
    }
  >;
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
  isFirstPanel,
  isLastPanel,
  canSplitHorizontal,
  canSplitVertical,
  layoutDirection,
  onSelectTab,
  onCloseTab,
  onFocus,
  onTabsReorder,
  onTabMove,
  onSplitPanel,
  onClosePanel,
  onResize,
  onContextMenuAction,
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

  const handleTabsReorder = useCallback(
    (oldIndex: number, newIndex: number) => {
      onTabsReorder(oldIndex, newIndex);
    },
    [onTabsReorder]
  );

  const handleTabMove = useCallback(
    (tabId: string, targetGroupId: string) => {
      onTabMove(tabId, targetGroupId);
    },
    [onTabMove]
  );

  const handleContextMenuAction = useCallback(
    (action: TabContextMenuAction, tabId: string) => {
      onContextMenuAction(action, tabId);
    },
    [onContextMenuAction]
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

  const showResizeHandle = layoutDirection !== "single" && !isLastPanel;
  const resizeDirection = layoutDirection === "horizontal" ? "horizontal" : "vertical";

  return (
    <div
      className={`panel-group ${isFocused ? "focused" : ""}`}
      onClick={handleContainerClick}
      style={{ flex: `${group.percentage}%` }}
    >
      {/* Tab Bar */}
      <div className="panel-tab-bar">
        <MemoizedPanelTabList
          groupId={group.id}
          tabs={group.tabs}
          activeTabId={group.activeTabId}
          onTabSelect={handleSelectTab}
          onTabClose={handleCloseTab}
          onTabsReorder={handleTabsReorder}
          onTabMove={handleTabMove}
          onContextMenuAction={(action, tab) => handleContextMenuAction(action, tab.id)}
        />

        {/* Panel Controls */}
        <div className="panel-controls">
          <MemoizedPanelSplitButton
            canSplitVertical={canSplitVertical}
            canSplitHorizontal={canSplitHorizontal}
            canClose={true}
            onSplit={onSplitPanel}
            onClose={onClosePanel}
          />
        </div>
      </div>

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
            <p>Select a tab to view its content</p>
          </div>
        )}
      </div>

      {/* Resize Handle */}
      {showResizeHandle && (
        <MemoizedPanelResizeHandle direction={resizeDirection} onResize={onResize} />
      )}
    </div>
  );
}

export const MemoizedUnifiedPanelContainer = memo(UnifiedPanelContainer);
