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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GridLocation,
  PanelGroup,
  PanelLayout,
  SplitDirection,
  TabContextMenuAction,
  UnifiedTab,
} from "../../types";
import { MemoizedUnifiedPanelContainer } from "./UnifiedPanelContainer";

// Split configuration - VSCode style
const SPLIT_THRESHOLD_RATIO = 0.33; // 33% threshold for split zones (like VSCode)
const EDGE_THRESHOLD_RATIO = 0.1; // 10% threshold for edge detection

// Detect which edge of the panel is being hovered based on mouse position
// Uses percentage-based thresholds like VSCode
// Now supports 2D grid splits with orientation awareness
function detectEdgeDirection(
  mouseX: number,
  mouseY: number,
  rect: DOMRect,
  preferSplitVertically: boolean = false,
  orientation?: "horizontal" | "vertical" | "single"
): "left" | "right" | "up" | "down" | null {
  const { left, right, top, bottom, width, height } = rect;
  const relativeX = mouseX - left;
  const relativeY = mouseY - top;

  // Calculate thresholds based on panel size
  const edgeWidthThreshold = width * EDGE_THRESHOLD_RATIO;
  const edgeHeightThreshold = height * EDGE_THRESHOLD_RATIO;
  const splitWidthThreshold = width * SPLIT_THRESHOLD_RATIO;
  const splitHeightThreshold = height * SPLIT_THRESHOLD_RATIO;

  // Check if mouse is in the center area (no split - merge instead)
  if (
    relativeX > edgeWidthThreshold &&
    relativeX < width - edgeWidthThreshold &&
    relativeY > edgeHeightThreshold &&
    relativeY < height - edgeHeightThreshold
  ) {
    return null; // Center area - no split
  }

  // For 2D grid splits, consider the current orientation
  // If in a horizontal split, prefer vertical splits (up/down) for 2D
  // If in a vertical split, prefer horizontal splits (left/right) for 2D
  let preferVertical = preferSplitVertically;
  if (orientation === "horizontal") {
    // Already split horizontally - prefer vertical for 2D
    preferVertical = false;
  } else if (orientation === "vertical") {
    // Already split vertically - prefer horizontal for 2D
    preferVertical = true;
  }

  // Determine split direction based on mouse position and preference
  // VSCode offers larger hitzone for preferred split direction
  if (preferVertical) {
    // User prefers vertical split (left/right):
    // Offer larger hitzone for left/right like:
    // ----------------------------------------------
    // |    |      SPLIT UP      |                  |
    // |    |---------------------|      RIGHT       |
    // |    |       MERGE         |                  |
    // |LEFT|---------------------|                  |
    // |    |     SPLIT DOWN      |                  |
    // ----------------------------------------------
    if (relativeX < splitWidthThreshold) {
      return "left";
    } else if (relativeX > width - splitWidthThreshold) {
      return "right";
    } else if (relativeY < height / 2) {
      return "up";
    } else {
      return "down";
    }
  } else {
    // User prefers horizontal split (up/down):
    // Offer larger hitzone for up/down like:
    // ----------------------------------------------
    // |          SPLIT UP                           |
    // |---------------------------------------------|
    // |   LEFT   |      MERGE        |   RIGHT     |
    // |---------------------------------------------|
    // |         SPLIT DOWN                           |
    // ----------------------------------------------
    if (relativeY < splitHeightThreshold) {
      return "up";
    } else if (relativeY > height - splitHeightThreshold) {
      return "down";
    } else if (relativeX < width / 2) {
      return "left";
    } else {
      return "right";
    }
  }
}

interface UnifiedPanelViewProps {
  groups: PanelGroup[];
  layout: PanelLayout;
  onSelectTab: (groupId: string, tabId: string) => void;
  onCloseTab: (groupId: string, tabId: string) => void;
  onFocusGroup: (groupId: string) => void;
  onTabsReorder: (groupId: string, oldIndex: number, newIndex: number) => void;
  onTabMove: (tabId: string, sourceGroupId: string, targetGroupId: string) => void;
  onSplitPanel: (groupId: string, direction: SplitDirection, activeTabId?: string) => string; // Returns new panel ID
  onClosePanel: (groupId: string) => void;
  onResizePanel: (groupId: string, delta: number) => void;
  onContextMenuAction: (action: TabContextMenuAction, groupId: string, tabId: string) => void;
  onTabDoubleClick?: (tab: import("../../types").UnifiedTab) => void;
  // Grid-based drop handler (for GridView integration)
  onTabDrop?: (
    tabId: string,
    sourceGroupId: string,
    location: GridLocation,
    direction: SplitDirection
  ) => void;
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
  onTabDrop,
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

  // Track global mouse position during drag
  const mousePosition = useRef({ x: 0, y: 0 });

  // Drag and drop state
  const [activeTab, setActiveTab] = useState<UnifiedTab | null>(null);
  const [activeTabSourceGroup, setActiveTabSourceGroup] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [splitDirection, setSplitDirection] = useState<SplitDirection | null>(null);
  const [splitTargetGroupId, setSplitTargetGroupId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Grid-based drop state
  const [splitTargetLocation, setSplitTargetLocation] = useState<GridLocation | null>(null);

  // Track mouse position globally during drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePosition.current = { x: e.clientX, y: e.clientY };
    };

    // Also track pointer events for better compatibility
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        mousePosition.current = { x: e.clientX, y: e.clientY };
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [isDragging]);

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
          setIsDragging(true);
          break;
        }
      }
    },
    [groups]
  );

  // Handle drag over for panel-to-panel movement and split detection
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over) {
        setDragOverGroupId(null);
        setSplitDirection(null);
        setSplitTargetGroupId(null);
        setSplitTargetLocation(null);
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);

      // Find which group the droppable target belongs to
      let targetGroupId: string | null = null;
      let targetLocation: GridLocation = []; // Default to root location

      // Check if dropping on a group container
      for (const group of groups) {
        if (overId === `group-${group.id}`) {
          targetGroupId = group.id;
          // Calculate location based on group index
          targetLocation = [groups.indexOf(group)];
          break;
        }
        // Check if dropping on a tab within a group
        const tabInGroup = group.tabs.find((t) => t.id === overId);
        if (tabInGroup) {
          targetGroupId = group.id;
          targetLocation = [groups.indexOf(group)];
          break;
        }
      }

      if (!targetGroupId) {
        setDragOverGroupId(null);
        setSplitDirection(null);
        setSplitTargetGroupId(null);
        setSplitTargetLocation(null);
        return;
      }

      // Get mouse position from activatorEvent or fall back to global tracking
      let mouseX = mousePosition.current.x;
      let mouseY = mousePosition.current.y;

      // Try to get mouse position from activatorEvent for more accuracy
      const activator = event.activatorEvent as MouseEvent | PointerEvent | undefined;
      if (activator && "clientX" in activator && "clientY" in activator) {
        mouseX = activator.clientX;
        mouseY = activator.clientY;
      }

      // Detect split direction based on mouse position
      // Find the panel group element directly from the DOM
      const panelGroupElement = document.querySelector(
        `[data-group-id="${targetGroupId}"]`
      ) as HTMLDivElement | null;

      if (panelGroupElement) {
        const rect = panelGroupElement.getBoundingClientRect();

        // Determine preferred split direction based on current layout
        // VSCode uses 'openSideBySideDirection' setting, we use layout direction
        const preferSplitVertically = layout.direction === "vertical";

        // Use the more accurate mouse position with preferred direction
        // Pass the current layout orientation for 2D grid support
        const direction = detectEdgeDirection(
          mouseX,
          mouseY,
          rect,
          preferSplitVertically,
          layout.direction
        );

        // Allow splitting within the same panel when dragging to edge
        // This enables "drag to edge to split" functionality
        if (direction) {
          setSplitDirection(direction);
          setSplitTargetGroupId(targetGroupId);
          setSplitTargetLocation(targetLocation);
          setDragOverGroupId(null);
          return;
        }
      }

      // No split - regular tab move/reorder
      setSplitDirection(null);
      setSplitTargetGroupId(null);
      setSplitTargetLocation(null);

      // Update drag-over state for visual feedback
      if (targetGroupId && targetGroupId !== activeTabSourceGroup) {
        setDragOverGroupId(targetGroupId);
      } else {
        setDragOverGroupId(null);
      }
    },
    [groups, activeTabSourceGroup, layout.direction]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTab(null);
      setActiveTabSourceGroup(null);
      setDragOverGroupId(null);
      setIsDragging(false);

      const shouldSplit = Boolean(splitDirection && (splitTargetGroupId || splitTargetLocation));
      const finalSplitDirection = splitDirection;
      const finalSplitTarget = splitTargetGroupId;
      const finalSplitLocation = splitTargetLocation;

      // Reset split state
      setSplitDirection(null);
      setSplitTargetGroupId(null);
      setSplitTargetLocation(null);

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

      if (!sourceTab || !sourceGroupId) {
        return;
      }

      // Handle grid-based drop first (for GridView integration)
      if (shouldSplit && finalSplitDirection && finalSplitLocation && onTabDrop) {
        // Use the new grid-based drop handler
        onTabDrop(activeId, sourceGroupId, finalSplitLocation, finalSplitDirection);
        return;
      }

      // Handle split first (legacy flat panel system)
      if (shouldSplit && finalSplitDirection && finalSplitTarget && sourceGroupId) {
        // Split the panel and get the new panel ID
        // Pass activeId to move the tab to the new panel
        onSplitPanel(finalSplitTarget, finalSplitDirection, activeId);

        // No need to move tab separately since handleSplitPanel already moved it
        return;
      }

      // Determine target for regular move/reorder
      let targetGroupId: string | null = null;
      let targetTabIndex = -1;

      // Check if dropping on a group container
      for (const group of groups) {
        if (overId === `group-${group.id}`) {
          targetGroupId = group.id;
          targetTabIndex = group.tabs.length;
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
    [
      groups,
      onTabsReorder,
      onTabMove,
      onSplitPanel,
      onTabDrop,
      splitDirection,
      splitTargetGroupId,
      splitTargetLocation,
    ]
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
    (groupId: string) =>
      (direction: SplitDirection): string => {
        // Find the group's active tab ID to move it to the new panel
        const group = groups.find((g) => g.id === groupId);
        const activeTabId = group?.activeTabId ?? undefined;

        // For grid integration, also return the location of this group
        // This allows the grid system to know where to insert the new view
        const groupIndex = groups.findIndex((g) => g.id === groupId);
        const location: GridLocation = groupIndex >= 0 ? [groupIndex] : [];

        // Call the split panel handler
        return onSplitPanel(groupId, direction, activeTabId);
      },
    [onSplitPanel, groups]
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
          isDraggingOver={dragOverGroupId === group.id}
          splitDirection={splitDirection}
          isSplitTarget={splitTargetGroupId === group.id}
          splitTargetLocation={splitTargetLocation}
          activeDragId={activeTab?.id ?? null}
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
            isDraggingOver={dragOverGroupId === group.id}
            splitDirection={splitDirection}
            isSplitTarget={splitTargetGroupId === group.id}
            splitTargetLocation={splitTargetLocation}
            activeDragId={activeTab?.id ?? null}
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
