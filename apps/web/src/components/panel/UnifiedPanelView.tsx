/**
 * Unified Panel View - VSCode-style panel layout with split and resize
 */

import { memo, useCallback, useMemo } from "react";
import type { PanelGroup, PanelLayout, SplitDirection, TabContextMenuAction } from "../../types";
import { MemoizedUnifiedPanelContainer } from "./UnifiedPanelContainer";

interface UnifiedPanelViewProps {
  groups: PanelGroup[];
  layout: PanelLayout;
  onSelectTab: (groupId: string, tabId: string) => void;
  onCloseTab: (groupId: string, tabId: string) => void;
  onFocusGroup: (groupId: string) => void;
  onTabsReorder: (groupId: string, oldIndex: number, newIndex: number) => void;
  onTabMove: (tabId: string, sourceGroupId: string, targetGroupId: string) => void;
  onSplitPanel: (groupId: string, direction: SplitDirection) => void;
  onClosePanel: (groupId: string) => void;
  onResizePanel: (groupId: string, delta: number) => void;
  onContextMenuAction: (action: TabContextMenuAction, groupId: string, tabId: string) => void;
  onTabDoubleClick?: (tab: import("../../types").UnifiedTab) => void;
  // Active deck IDs (from title bar selection)
  activeDeckIds?: string[];
  // Deck data for displaying without tabs
  decks?: import("../../types").Deck[];
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

export function UnifiedPanelView({
  groups,
  layout,
  onSelectTab,
  onCloseTab,
  onFocusGroup,
  onTabsReorder,
  onTabMove,
  onSplitPanel,
  onClosePanel,
  onResizePanel,
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
}: UnifiedPanelViewProps) {
  const focusedGroupId = groups.find((g) => g.focused)?.id ?? groups[0]?.id;

  // Determine split capabilities based on current layout and group count
  const canSplitHorizontal = useMemo(() => {
    return layout.direction !== "vertical" && groups.length < 4;
  }, [layout.direction, groups.length]);

  const canSplitVertical = useMemo(() => {
    return layout.direction !== "horizontal" && groups.length < 4;
  }, [layout.direction, groups.length]);

  // Wrap callbacks with groupId
  const createSelectHandler = useCallback(
    (groupId: string) => (tabId: string) => {
      onSelectTab(groupId, tabId);
    },
    [onSelectTab]
  );

  const createCloseHandler = useCallback(
    (groupId: string) => (tabId: string) => {
      onCloseTab(groupId, tabId);
    },
    [onCloseTab]
  );

  const createFocusHandler = useCallback(
    (groupId: string) => () => {
      onFocusGroup(groupId);
    },
    [onFocusGroup]
  );

  const createReorderHandler = useCallback(
    (groupId: string) => (oldIndex: number, newIndex: number) => {
      onTabsReorder(groupId, oldIndex, newIndex);
    },
    [onTabsReorder]
  );

  const createMoveHandler = useCallback(
    (sourceGroupId: string) => (tabId: string, targetGroupId: string) => {
      onTabMove(tabId, sourceGroupId, targetGroupId);
    },
    [onTabMove]
  );

  const createSplitHandler = useCallback(
    (groupId: string) => (direction: SplitDirection) => {
      onSplitPanel(groupId, direction);
    },
    [onSplitPanel]
  );

  const createClosePanelHandler = useCallback(
    (groupId: string) => () => {
      onClosePanel(groupId);
    },
    [onClosePanel]
  );

  const createResizeHandler = useCallback(
    (groupId: string) => (delta: number) => {
      onResizePanel(groupId, delta);
    },
    [onResizePanel]
  );

  const createContextMenuHandler = useCallback(
    (groupId: string) => (action: TabContextMenuAction, tabId: string) => {
      onContextMenuAction(action, groupId, tabId);
    },
    [onContextMenuAction]
  );

  // Empty state
  if (groups.length === 0) {
    return (
      <div className="panel-view-empty">
        <div className="panel-empty-icon">
          <svg
            width={120}
            height={120}
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
        <h1 className="panel-empty-title">S-IDE</h1>
        <p className="panel-empty-description">
          開くには、ワークスペースを追加するか、以下の操作を行います
        </p>
        <div className="panel-empty-shortcuts">
          <div className="panel-empty-shortcut">
            <kbd>Ctrl</kbd> + <kbd>N</kbd>
            <span>新しいワークスペース</span>
          </div>
          <div className="panel-empty-shortcut">
            <kbd>Ctrl</kbd> + <kbd>O</kbd>
            <span>ファイルを開く</span>
          </div>
          <div className="panel-empty-shortcut">
            <kbd>Ctrl</kbd> + <kbd>`</kbd>
            <span>ターミナルを開く</span>
          </div>
        </div>
      </div>
    );
  }

  // Single group
  if (layout.direction === "single" || groups.length === 1) {
    const group = groups[0];
    if (!group) {
      return (
        <div className="panel-view-empty">
          <div className="panel-empty-icon">
            <svg
              width={120}
              height={120}
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
          <h1 className="panel-empty-title">S-IDE</h1>
          <p className="panel-empty-description">
            開くには、ワークスペースを追加するか、以下の操作を行います
          </p>
          <div className="panel-empty-shortcuts">
            <div className="panel-empty-shortcut">
              <kbd>Ctrl</kbd> + <kbd>N</kbd>
              <span>新しいワークスペース</span>
            </div>
            <div className="panel-empty-shortcut">
              <kbd>Ctrl</kbd> + <kbd>O</kbd>
              <span>ファイルを開く</span>
            </div>
            <div className="panel-empty-shortcut">
              <kbd>Ctrl</kbd> + <kbd>`</kbd>
              <span>ターミナルを開く</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <MemoizedUnifiedPanelContainer
        key={group.id}
        group={group}
        isFocused={group.id === focusedGroupId}
        isFirstPanel={true}
        isLastPanel={true}
        canSplitHorizontal={canSplitHorizontal}
        canSplitVertical={canSplitVertical}
        layoutDirection={layout.direction}
        onSelectTab={createSelectHandler(group.id)}
        onCloseTab={createCloseHandler(group.id)}
        onFocus={createFocusHandler(group.id)}
        onTabsReorder={createReorderHandler(group.id)}
        onTabMove={createMoveHandler(group.id)}
        onSplitPanel={createSplitHandler(group.id)}
        onClosePanel={createClosePanelHandler(group.id)}
        onResize={createResizeHandler(group.id)}
        onContextMenuAction={createContextMenuHandler(group.id)}
        onTabDoubleClick={onTabDoubleClick}
        activeDeckIds={activeDeckIds}
        decks={decks}
        workspaceStates={workspaceStates}
        gitFiles={gitFiles}
        onToggleDir={onToggleDir}
        onOpenFile={onOpenFile}
        onRefreshTree={onRefreshTree}
        onCreateFile={onCreateFile}
        onCreateDirectory={onCreateDirectory}
        onDeleteFile={onDeleteFile}
        onDeleteDirectory={onDeleteDirectory}
        deckStates={deckStates}
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
    );
  }

  // Multiple groups
  return (
    <div className={`panel-groups panel-groups-${layout.direction}`}>
      {groups.map((group, index) => (
        <MemoizedUnifiedPanelContainer
          key={group.id}
          group={group}
          isFocused={group.id === focusedGroupId}
          isFirstPanel={index === 0}
          isLastPanel={index === groups.length - 1}
          canSplitHorizontal={canSplitHorizontal}
          canSplitVertical={canSplitVertical}
          layoutDirection={layout.direction}
          onSelectTab={createSelectHandler(group.id)}
          onCloseTab={createCloseHandler(group.id)}
          onFocus={createFocusHandler(group.id)}
          onTabsReorder={createReorderHandler(group.id)}
          onTabMove={createMoveHandler(group.id)}
          onSplitPanel={createSplitHandler(group.id)}
          onClosePanel={createClosePanelHandler(group.id)}
          onResize={createResizeHandler(group.id)}
          onContextMenuAction={createContextMenuHandler(group.id)}
          onTabDoubleClick={onTabDoubleClick}
          activeDeckIds={activeDeckIds}
          decks={decks}
          workspaceStates={workspaceStates}
          gitFiles={gitFiles}
          onToggleDir={onToggleDir}
          onOpenFile={onOpenFile}
          onRefreshTree={onRefreshTree}
          onCreateFile={onCreateFile}
          onCreateDirectory={onCreateDirectory}
          onDeleteFile={onDeleteFile}
          onDeleteDirectory={onDeleteDirectory}
          deckStates={deckStates}
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
      ))}
    </div>
  );
}

export const MemoizedUnifiedPanelView = memo(UnifiedPanelView);
