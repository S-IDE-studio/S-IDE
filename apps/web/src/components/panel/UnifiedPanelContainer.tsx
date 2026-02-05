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
  onTabDoubleClick?: (tab: import("../../types").UnifiedTab) => void;
  // Active deck IDs (from title bar selection)
  activeDeckIds?: string[];
  // Deck data for displaying without tabs
  decks?: import("../../types").Deck[];
  // Workspace data (for editor tabs)
  workspaceStates?: Record<
    string,
    {
      tree?: import("../../types").FileTreeNode[];
      treeLoading?: boolean;
      treeError?: string | null;
      files?: import("../../types").EditorFile[];
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
  // Editor state
  activeFileId?: string | null;
  onSelectFile?: (fileId: string) => void;
  onCloseFile?: (fileId: string) => void;
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
  onTabDoubleClick,
  activeDeckIds,
  decks,
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
  activeFileId,
  onSelectFile,
  onCloseFile,
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

  // Get workspace state for workspace tabs and deck tabs
  const getWorkspaceState = () => {
    if (activeTab?.kind === "workspace" && activeTab.data.workspace) {
      return workspaceStates?.[activeTab.data.workspace.id];
    }
    if (activeTab?.kind === "deck" && activeTab.data.deck) {
      return workspaceStates?.[activeTab.data.deck.workspaceId];
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
          onTabDoubleClick={onTabDoubleClick}
        />

        {/* Panel Controls */}
        {group.tabs.length > 0 && (
          <div className="panel-controls">
            <MemoizedPanelSplitButton
              canSplitVertical={canSplitVertical}
              canSplitHorizontal={canSplitHorizontal}
              canClose={true}
              onSplit={onSplitPanel}
              onClose={onClosePanel}
            />
          </div>
        )}
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
            activeFileId={activeFileId}
            onSelectFile={onSelectFile}
            onCloseFile={onCloseFile}
          />
        ) : (
          <div className="panel-empty panel-view-empty">
            <div className="panel-empty-icon">
              <svg
                width={80}
                height={80}
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="20"
                  y="20"
                  width={80}
                  height={80}
                  rx="4"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M30 40h60M30 60h40M30 80h20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="panel-empty-description">タブを選択してください</p>
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
