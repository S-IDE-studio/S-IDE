/**
 * Unified Panel Container - VSCode-style panel with tabs, split, and resize
 */

import { useDroppable } from "@dnd-kit/core";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import type { GridLocation, PanelGroup, SplitDirection, TabContextMenuAction } from "../../types";
import { MemoizedDropOverlay } from "./DropOverlay";
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
  onSplitPanel: (direction: SplitDirection) => string; // Returns new panel ID
  onClosePanel: () => void;
  onResize: (delta: number) => void;
  onContextMenuAction: (action: TabContextMenuAction, tabId: string) => void;
  onTabDoubleClick?: (tab: import("../../types").UnifiedTab) => void;
  isDraggingOver?: boolean;
  // Split preview state
  splitDirection?: SplitDirection | null;
  isSplitTarget?: boolean;
  splitTargetLocation?: GridLocation | null;
  // Drag state
  activeDragId?: string | null;
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
      view?: "filetree" | "terminal";
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
  isDraggingOver,
  splitDirection,
  isSplitTarget,
  splitTargetLocation,
  activeDragId,
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
  activeFileId,
  onSelectFile,
  onCloseFile,
}: UnifiedPanelContainerProps) {
  // Find active tab, fallback to first tab if activeTabId is invalid but tabs exist
  const activeTab =
    group.tabs.find((t) => t.id === group.activeTabId) ??
    (group.tabs.length > 0 ? group.tabs[0] : undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Make this panel a droppable target for tabs
  // Note: We don't store rect in data to avoid re-renders
  // Instead, we'll get the element dynamically in handleDragOver
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `group-${group.id}`,
    data: useMemo(
      () => ({
        type: "panel",
        groupId: group.id,
        // Store the element ref so we can get rect dynamically
        element: () => containerRef.current,
      }),
      [group.id]
    ),
  });

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

  // Get container rect and tab height for drop overlay positioning
  const containerRect = useRef<DOMRect | null>(null);
  const tabHeightRef = useRef<number>(0);
  const tabBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && (isSplitTarget || isDraggingOver)) {
      containerRect.current = containerRef.current.getBoundingClientRect();
    }
    // Get tab bar height
    if (tabBarRef.current) {
      tabHeightRef.current = tabBarRef.current.offsetHeight;
    }
  }, [isSplitTarget, isDraggingOver]);

  return (
    <div
      ref={(node) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        setDroppableRef(node);
      }}
      data-group-id={group.id}
      className={`panel-group ${isFocused ? "focused" : ""} ${isDraggingOver ? "drag-over" : ""} ${isSplitTarget && splitDirection ? "split-target" : ""}`}
      onClick={handleContainerClick}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Split Preview Overlay */}
      {isSplitTarget && splitDirection && containerRect.current && (
        <MemoizedDropOverlay
          containerRect={containerRect.current}
          splitDirection={splitDirection}
          tabHeight={tabHeightRef.current}
        />
      )}

      {/* Tab Bar */}
      <div ref={tabBarRef} className="panel-tab-bar">
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
          isDraggingOver={isDraggingOver}
          activeDragId={activeDragId}
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
            updateWorkspaceState={updateWorkspaceState}
            deckState={getDeckState()}
            wsBase={wsBase}
            onDeckViewChange={onDeckViewChange}
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
