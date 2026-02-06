/**
 * Unified Panel View - VSCode-style panel layout with split and resize
 */

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { memo, useCallback, useMemo, useState } from "react";
import type {
  PanelGroup,
  PanelLayout,
  SplitDirection,
  TabContextMenuAction,
  UnifiedTab,
} from "../../types";
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
  // Workspace state updater
  updateWorkspaceState?: (
    workspaceId: string,
    updater: (state: import("../../types").WorkspaceState) => import("../../types").WorkspaceState
  ) => void;
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
  onDeckViewChange?: (deckId: string, view: "filetree" | "terminal") => void;
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
  updateWorkspaceState,
  deckStates,
  wsBase,
  onDeleteTerminal,
  onReorderTerminals,
  onCreateTerminal,
  onToggleGroupCollapsed,
  onDeleteGroup,
  onRenameGroup,
  onDeckViewChange,
  onChangeFile,
  onSaveFile,
  savingFileId,
}: UnifiedPanelViewProps) {
  const focusedGroupId = groups.find((g) => g.focused)?.id ?? groups[0]?.id;

  // Drag and drop state
  const [activeTab, setActiveTab] = useState<UnifiedTab | null>(null);
  const [activeTabSourceGroup, setActiveTabSourceGroup] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Small delay to prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      // Find the tab across all groups
      for (const group of groups) {
        const tab = group.tabs.find((t) => t.id === active.id);
        if (tab) {
          setActiveTab(tab);
          setActiveTabSourceGroup(group.id);
          break;
        }
      }
    },
    [groups]
  );

  // Handle drag over for panel-to-panel movement
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      // Find which group the droppable target belongs to
      const overId = String(over.id);
      let targetGroupId: string | null = null;

      // Check if dropping on a group container
      for (const group of groups) {
        // The group's droppable id would be `group-${group.id}`
        if (overId === `group-${group.id}`) {
          targetGroupId = group.id;
          break;
        }
        // Check if dropping on a tab within a group
        const tabInGroup = group.tabs.find((t) => t.id === overId);
        if (tabInGroup) {
          targetGroupId = group.id;
          break;
        }
      }

      // If dropping into a different group, set it as target
      if (targetGroupId && targetGroupId !== activeTabSourceGroup && activeTab) {
        // Visual feedback could be added here
      }
    },
    [groups, activeTabSourceGroup, activeTab]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTab(null);
      setActiveTabSourceGroup(null);

      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      // Find source group and tab
      let sourceGroupId: string | null = null;
      let sourceTab: UnifiedTab | null = null;
      let sourceTabIndex = -1;

      for (const group of groups) {
        const tabIndex = group.tabs.findIndex((t) => t.id === activeId);
        if (tabIndex !== -1) {
          sourceGroupId = group.id;
          sourceTab = group.tabs[tabIndex];
          sourceTabIndex = tabIndex;
          break;
        }
      }

      if (!sourceTab || !sourceGroupId) return;

      // Determine target
      let targetGroupId: string | null = null;
      let targetTabIndex = -1;

      // Check if dropping on a group container
      for (const group of groups) {
        if (overId === `group-${group.id}`) {
          targetGroupId = group.id;
          targetTabIndex = group.tabs.length; // Append to end
          break;
        }
        // Check if dropping on a tab
        const tabIndex = group.tabs.findIndex((t) => t.id === overId);
        if (tabIndex !== -1) {
          targetGroupId = group.id;
          targetTabIndex = tabIndex;
          break;
        }
      }

      if (!targetGroupId) return;

      // Same group - reorder tabs
      if (targetGroupId === sourceGroupId) {
        if (targetTabIndex !== sourceTabIndex) {
          onTabsReorder(sourceGroupId, sourceTabIndex, targetTabIndex);
        }
      } else {
        // Different group - move tab between panels
        onTabMove(activeId, sourceGroupId, targetGroupId);
      }
    },
    [groups, onTabsReorder, onTabMove]
  );

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
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
          updateWorkspaceState={updateWorkspaceState}
          deckStates={deckStates}
          wsBase={wsBase}
          onDeleteTerminal={onDeleteTerminal}
          onReorderTerminals={onReorderTerminals}
          onCreateTerminal={onCreateTerminal}
          onToggleGroupCollapsed={onToggleGroupCollapsed}
          onDeleteGroup={onDeleteGroup}
          onRenameGroup={onRenameGroup}
          onDeckViewChange={onDeckViewChange}
          onChangeFile={onChangeFile}
          onSaveFile={onSaveFile}
          savingFileId={savingFileId}
        />
        <DragOverlay>
          {activeTab ? (
            <div className="panel-tab panel-tab-dragging" style={{ cursor: "grabbing" }}>
              <span className="panel-tab-icon">
                {activeTab.icon?.startsWith("/") ? (
                  <img src={activeTab.icon} alt="" className="panel-tab-icon-img" />
                ) : null}
              </span>
              <span className="panel-tab-title">{activeTab.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  // Multiple groups
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
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
            updateWorkspaceState={updateWorkspaceState}
            deckStates={deckStates}
            wsBase={wsBase}
            onDeleteTerminal={onDeleteTerminal}
            onReorderTerminals={onReorderTerminals}
            onCreateTerminal={onCreateTerminal}
            onToggleGroupCollapsed={onToggleGroupCollapsed}
            onDeleteGroup={onDeleteGroup}
            onRenameGroup={onRenameGroup}
            onDeckViewChange={onDeckViewChange}
            onChangeFile={onChangeFile}
            onSaveFile={onSaveFile}
            savingFileId={savingFileId}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTab ? (
          <div className="panel-tab panel-tab-dragging" style={{ cursor: "grabbing" }}>
            <span className="panel-tab-icon">
              {activeTab.icon?.startsWith("/") ? (
                <img src={activeTab.icon} alt="" className="panel-tab-icon-img" />
              ) : null}
            </span>
            <span className="panel-tab-title">{activeTab.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export const MemoizedUnifiedPanelView = memo(UnifiedPanelView);
