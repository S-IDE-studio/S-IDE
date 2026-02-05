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
        <p>No panels open. Open a file or create a new workspace to get started.</p>
      </div>
    );
  }

  // Single group
  if (layout.direction === "single" || groups.length === 1) {
    const group = groups[0];
    if (!group) {
      return (
        <div className="panel-view-empty">
          <p>No panels open</p>
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
