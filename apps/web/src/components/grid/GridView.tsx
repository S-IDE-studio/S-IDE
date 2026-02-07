/**
 * GridView - VSCode-style grid layout component
 * Renders GridNode tree recursively with resize support
 * Based on VSCode's gridview.ts implementation
 */

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type {
  GridLocation,
  GridNode,
  GridOrientation,
  PanelGroup,
  SplitDirection,
  TabContextMenuAction,
  UnifiedTab,
} from "../../types";
import { isGridBranchNode } from "../../types";
import { GridBranchNodeView } from "./GridBranchNode";
import { GridDropTarget } from "./GridDropTarget";
import { GridLeafNodeView } from "./GridLeafNode";

/**
 * Size constraints for a view within the grid
 */
export interface ViewConstraints {
  readonly minimumWidth: number;
  readonly maximumWidth: number;
  readonly minimumHeight: number;
  readonly maximumHeight: number;
}

/**
 * Default view constraints
 */
export const DEFAULT_VIEW_CONSTRAINTS: ViewConstraints = {
  minimumWidth: 100,
  maximumWidth: Number.POSITIVE_INFINITY,
  minimumHeight: 100,
  maximumHeight: Number.POSITIVE_INFINITY,
};

/**
 * Props for GridView component
 */
export interface GridViewProps {
  /** Root node of the grid tree to render */
  rootNode: GridNode;
  /** Orientation of the root split */
  orientation?: GridOrientation;
  /** Panel groups data indexed by groupId */
  panelGroups: Record<string, PanelGroup>;
  /** Width of the grid container */
  width?: number;
  /** Height of the grid container */
  height?: number;
  /** Callback when layout changes */
  onLayoutChange?: (newGridState: GridNode) => void;
  /** Callback when a panel group is resized */
  onPanelResize?: (groupId: string, width: number, height: number) => void;
  /** Custom view constraints per panel group */
  getViewConstraints?: (groupId: string) => ViewConstraints;
  /** Enable proportional layout (default: true) */
  proportionalLayout?: boolean;
  /** Additional class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Callback when a tab is dropped on the grid */
  onTabDrop?: (
    tabId: string,
    sourceGroupId: string,
    location: GridLocation,
    direction: SplitDirection
  ) => void;
  /** Whether a drag is currently active */
  isDragging?: boolean;
  /** ID of the tab being dragged (for drop target calculation) */
  draggedTabId?: string | null;
  /** Focused panel group ID */
  focusedPanelGroupId?: string | null;
  /** Callback when panel is focused */
  onFocusPanel?: (groupId: string) => void;
  /** Callback when tab is selected */
  onSelectTab?: (groupId: string, tabId: string) => void;
  /** Callback when tab is closed */
  onCloseTab?: (groupId: string, tabId: string) => void;
  /** Callback when tabs are reordered */
  onTabsReorder?: (groupId: string, oldIndex: number, newIndex: number) => void;
  /** Callback when tab is moved to another group */
  onTabMove?: (tabId: string, sourceGroupId: string, targetGroupId: string) => void;
  /** Callback when panel is split */
  onSplitPanel?: (groupId: string, direction: SplitDirection, activeTabId?: string) => string;
  /** Callback when panel is closed */
  onClosePanel?: (groupId: string) => void;
  /** Callback when context menu action is triggered */
  onContextMenuAction?: (action: TabContextMenuAction, groupId: string, tabId: string) => void;
  /** Callback when tab is double-clicked */
  onTabDoubleClick?: (tab: UnifiedTab) => void;
  /** Active deck IDs */
  activeDeckIds?: string[];
  /** Deck data */
  decks?: import("../../types").Deck[];
  /** Workspace states */
  workspaceStates?: Record<string, import("../../types").WorkspaceState>;
  /** Git files */
  gitFiles?: import("../../types").GitFileStatus[];
  /** Workspace handlers */
  onToggleDir?: (node: import("../../types").FileTreeNode) => void;
  onOpenFile?: (node: import("../../types").FileTreeNode) => void;
  onRefreshTree?: () => void;
  onCreateFile?: (parentPath: string, fileName: string) => void;
  onCreateDirectory?: (parentPath: string, dirName: string) => void;
  onDeleteFile?: (filePath: string) => void;
  onDeleteDirectory?: (dirPath: string) => void;
  /** Workspace state updater */
  updateWorkspaceState?: (
    workspaceId: string,
    updater: (state: import("../../types").WorkspaceState) => import("../../types").WorkspaceState
  ) => void;
  /** Deck states */
  deckStates?: Record<string, import("../../types").DeckState>;
  /** WebSocket base URL */
  wsBase?: string;
  /** Terminal handlers */
  onDeleteTerminal?: (terminalId: string) => void;
  onReorderTerminals?: (deckId: string, newOrder: import("../../types").TerminalSession[]) => void;
  onCreateTerminal?: () => void;
  onToggleGroupCollapsed?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onRenameGroup?: (groupId: string) => void;
  onDeckViewChange?: (deckId: string, view: "filetree" | "terminal") => void;
  /** Editor handlers */
  onChangeFile?: (fileId: string, contents: string) => void;
  onSaveFile?: (fileId: string) => void;
  savingFileId?: string | null;
}

/**
 * Layout context passed to child nodes
 */
interface LayoutContext {
  readonly orthogonalSize: number;
  readonly absoluteOffset: number;
  readonly absoluteOrthogonalOffset: number;
  readonly absoluteSize: number;
  readonly absoluteOrthogonalSize: number;
}

/**
 * Create initial layout context
 */
function createInitialLayoutContext(
  width: number,
  height: number,
  orientation: GridOrientation
): LayoutContext {
  if (orientation === "horizontal") {
    return {
      orthogonalSize: width,
      absoluteOffset: 0,
      absoluteOrthogonalOffset: 0,
      absoluteSize: height,
      absoluteOrthogonalSize: width,
    };
  }
  return {
    orthogonalSize: height,
    absoluteOffset: 0,
    absoluteOrthogonalOffset: 0,
    absoluteSize: width,
    absoluteOrthogonalSize: height,
  };
}

/**
 * GridView component - VSCode-style grid layout
 *
 * Renders a hierarchical tree of GridNodes:
 * - GridBranchNode: Contains children arranged horizontally or vertically
 * - GridLeafNode: Contains actual panel content
 *
 * Features:
 * - Recursive rendering of the grid tree
 * - Mouse drag resize via sash handles
 * - Minimum/maximum size constraints
 * - Proportional layout distribution
 * - Layout change propagation
 */
export function GridView({
  rootNode,
  orientation = "vertical",
  panelGroups,
  width = 0,
  height = 0,
  onLayoutChange,
  onPanelResize,
  getViewConstraints = () => DEFAULT_VIEW_CONSTRAINTS,
  proportionalLayout = true,
  className = "",
  style: containerStyle,
  onTabDrop,
  isDragging = false,
  draggedTabId = null,
  focusedPanelGroupId,
  onFocusPanel,
  onSelectTab,
  onCloseTab,
  onTabsReorder,
  onTabMove,
  onSplitPanel,
  onClosePanel,
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
}: GridViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutEnabled, setLayoutEnabled] = useState(false);
  const [currentGridState, setCurrentGridState] = useState<GridNode>(rootNode);
  const layoutContextRef = useRef<LayoutContext>(
    createInitialLayoutContext(width, height, orientation)
  );
  // Drop target state (for HTML5 drag-drop - panel splitting)
  const [dropTargetVisible, setDropTargetVisible] = useState(false);
  const [dropDirection, setDropDirection] = useState<SplitDirection | null>(null);
  const [dropLocation, setDropLocation] = useState<GridLocation>([]);

  // dnd-kit drag state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<{
    tab: UnifiedTab;
    groupId: string;
  } | null>(null);

  // Configure dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts
      },
    })
  );

  // Update grid state when prop changes
  useEffect(() => {
    setCurrentGridState(rootNode);
  }, [rootNode]);

  // Update layout context when dimensions change
  useEffect(() => {
    layoutContextRef.current = createInitialLayoutContext(width, height, orientation);
    setLayoutEnabled(true);
  }, [width, height, orientation]);

  // Reset drop target when drag ends
  useEffect(() => {
    if (!isDragging) {
      setDropTargetVisible(false);
      setDropDirection(null);
      setDropLocation([]);
    }
  }, [isDragging]);

  /**
   * Handle layout change from child node
   */
  const handleLayoutChange = useCallback(
    (location: GridLocation, newSizes: number[]) => {
      // Update grid state with new sizes
      const updatedState = updateGridNodeSizes(currentGridState, location, newSizes);
      setCurrentGridState(updatedState);
      onLayoutChange?.(updatedState);
    },
    [currentGridState, onLayoutChange]
  );

  /**
   * Handle panel resize
   */
  const handlePanelResize = useCallback(
    (groupId: string, width: number, height: number) => {
      onPanelResize?.(groupId, width, height);
    },
    [onPanelResize]
  );

  /**
   * Calculate drop direction based on mouse position within a target area
   */
  const calculateDropDirection = useCallback(
    (e: React.DragEvent, targetElement: HTMLElement): SplitDirection | null => {
      const rect = targetElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // Determine which quadrant the mouse is in
      // This gives us the direction for the new split
      if (x < centerX && y < centerY) {
        // Top-left - prefer left for horizontal, up for vertical
        return width > height ? "left" : "up";
      } else if (x >= centerX && y < centerY) {
        // Top-right - prefer right for horizontal, up for vertical
        return width > height ? "right" : "up";
      } else if (x < centerX && y >= centerY) {
        // Bottom-left - prefer left for horizontal, down for vertical
        return width > height ? "left" : "down";
      } else {
        // Bottom-right - prefer right for horizontal, down for vertical
        return width > height ? "right" : "down";
      }
    },
    []
  );

  /**
   * Handle drag over event - show drop target
   */
  const handleDragOver = useCallback(
    (e: React.DragEvent, location: GridLocation) => {
      if (!isDragging || !draggedTabId) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const targetElement = e.currentTarget as HTMLElement;
      const direction = calculateDropDirection(e, targetElement);

      setDropTargetVisible(true);
      setDropDirection(direction);
      setDropLocation(location);
    },
    [isDragging, draggedTabId, calculateDropDirection]
  );

  /**
   * Handle drag leave event - hide drop target when leaving
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only hide if we're actually leaving the container
    const targetElement = e.currentTarget as HTMLElement;
    const rect = targetElement.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    // Check if mouse is outside the element
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDropTargetVisible(false);
      setDropDirection(null);
    }
  }, []);

  /**
   * Handle drop event - execute the drop action
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      if (!isDragging || !draggedTabId || !dropDirection || dropLocation.length === 0) {
        return;
      }

      // Get tab data from drag event
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;

      try {
        const dragData = JSON.parse(data) as { tabId: string; sourceGroupId: string };
        onTabDrop?.(dragData.tabId, dragData.sourceGroupId, dropLocation, dropDirection);
      } catch {
        // Invalid JSON, ignore
      }

      // Reset drop target
      setDropTargetVisible(false);
      setDropDirection(null);
      setDropLocation([]);
    },
    [isDragging, draggedTabId, dropDirection, dropLocation, onTabDrop]
  );

  /**
   * Handle drag start - track active drag for dnd-kit
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as { tab?: UnifiedTab; groupId?: string } | undefined;

    if (data?.tab && data?.groupId) {
      setActiveDragId(active.id as string);
      setActiveDragData({
        tab: data.tab,
        groupId: data.groupId,
      });
    }
  }, []);

  /**
   * Handle drag end - process drop for dnd-kit
   * Detects: tab reordering, tab movement between panels
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const dragData = activeDragData;

      // Reset drag state
      setActiveDragId(null);
      setActiveDragData(null);

      if (!dragData || !over) {
        return;
      }

      const overData = over.data.current as
        | { tab?: UnifiedTab; groupId?: string; type?: string }
        | undefined;

      if (!overData) {
        return;
      }

      // Case 1: Dropped on another tab (reordering or moving)
      if (overData.tab && overData.groupId) {
        const targetTabId = overData.tab.id;
        const targetGroupId = overData.groupId;

        // Same panel: reorder tabs
        if (dragData.groupId === targetGroupId) {
          const sourceGroup = panelGroups[targetGroupId];
          if (!sourceGroup) return;

          const oldIndex = sourceGroup.tabs.findIndex((t) => t.id === dragData.tab.id);
          const newIndex = sourceGroup.tabs.findIndex((t) => t.id === targetTabId);

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            onTabsReorder?.(targetGroupId, oldIndex, newIndex);
          }
        } else {
          // Different panel: move tab to target panel
          onTabMove?.(dragData.tab.id, dragData.groupId, targetGroupId);
        }
        return;
      }

      // Case 2: Dropped on a panel droppable area
      if (overData.type === "panel" && overData.groupId) {
        const targetGroupId = overData.groupId;

        // If different panel, move the tab
        if (dragData.groupId !== targetGroupId) {
          onTabMove?.(dragData.tab.id, dragData.groupId, targetGroupId);
        }
        return;
      }
    },
    [activeDragData, panelGroups, onTabsReorder, onTabMove]
  );

  // Calculate container style
  const containerStyleCombined: React.CSSProperties = {
    ...containerStyle,
    position: "relative",
    width: width > 0 ? `${width}px` : "100%",
    height: height > 0 ? `${height}px` : "100%",
    overflow: "hidden",
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        ref={containerRef}
        className={`grid-view ${className}`}
        style={containerStyleCombined}
        onDragOver={(e) => handleDragOver(e, [])}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {layoutEnabled && (
          <GridRenderer
            node={currentGridState}
            orientation={orientation}
            layoutContext={layoutContextRef.current}
            panelGroups={panelGroups}
            onLayoutChange={handleLayoutChange}
            onPanelResize={handlePanelResize}
            getViewConstraints={getViewConstraints}
            proportionalLayout={proportionalLayout}
            location={[]}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            focusedPanelGroupId={focusedPanelGroupId}
            onFocusPanel={onFocusPanel}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
            onTabsReorder={onTabsReorder}
            onTabMove={onTabMove}
            onSplitPanel={onSplitPanel}
            onClosePanel={onClosePanel}
            onContextMenuAction={onContextMenuAction}
            onTabDoubleClick={onTabDoubleClick}
            isDragging={isDragging}
            draggedTabId={draggedTabId}
            activeDragId={activeDragId}
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
        )}
        {dropTargetVisible && dropDirection && (
          <GridDropTarget
            visible={dropTargetVisible}
            direction={dropDirection}
            width={width}
            height={height}
          />
        )}
      </div>
    </DndContext>
  );
}

/**
 * GridRenderer - Recursive renderer for grid nodes
 */
interface GridRendererProps {
  node: GridNode;
  orientation: GridOrientation;
  layoutContext: LayoutContext;
  panelGroups: Record<string, PanelGroup>;
  onLayoutChange: (location: GridLocation, newSizes: number[]) => void;
  onPanelResize: (groupId: string, width: number, height: number) => void;
  getViewConstraints: (groupId: string) => ViewConstraints;
  proportionalLayout: boolean;
  location: GridLocation;
  onDragOver: (e: React.DragEvent, location: GridLocation) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  focusedPanelGroupId?: string | null;
  onFocusPanel?: (groupId: string) => void;
  onSelectTab?: (groupId: string, tabId: string) => void;
  onCloseTab?: (groupId: string, tabId: string) => void;
  onTabsReorder?: (groupId: string, oldIndex: number, newIndex: number) => void;
  onTabMove?: (tabId: string, sourceGroupId: string, targetGroupId: string) => void;
  onSplitPanel?: (groupId: string, direction: SplitDirection, activeTabId?: string) => string;
  onClosePanel?: (groupId: string) => void;
  onContextMenuAction?: (action: TabContextMenuAction, groupId: string, tabId: string) => void;
  onTabDoubleClick?: (tab: UnifiedTab) => void;
  isDragging?: boolean;
  draggedTabId?: string | null;
  activeDragId?: string | null;
  activeDeckIds?: string[];
  decks?: import("../../types").Deck[];
  workspaceStates?: Record<string, import("../../types").WorkspaceState>;
  gitFiles?: import("../../types").GitFileStatus[];
  onToggleDir?: (node: import("../../types").FileTreeNode) => void;
  onOpenFile?: (node: import("../../types").FileTreeNode) => void;
  onRefreshTree?: () => void;
  onCreateFile?: (parentPath: string, fileName: string) => void;
  onCreateDirectory?: (parentPath: string, dirName: string) => void;
  onDeleteFile?: (filePath: string) => void;
  onDeleteDirectory?: (dirPath: string) => void;
  updateWorkspaceState?: (
    workspaceId: string,
    updater: (state: import("../../types").WorkspaceState) => import("../../types").WorkspaceState
  ) => void;
  deckStates?: Record<string, import("../../types").DeckState>;
  wsBase?: string;
  onDeleteTerminal?: (terminalId: string) => void;
  onReorderTerminals?: (deckId: string, newOrder: import("../../types").TerminalSession[]) => void;
  onCreateTerminal?: () => void;
  onToggleGroupCollapsed?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onRenameGroup?: (groupId: string) => void;
  onDeckViewChange?: (deckId: string, view: "filetree" | "terminal") => void;
  onChangeFile?: (fileId: string, contents: string) => void;
  onSaveFile?: (fileId: string) => void;
  savingFileId?: string | null;
}

function GridRenderer({
  node,
  orientation,
  layoutContext,
  panelGroups,
  onLayoutChange,
  onPanelResize,
  getViewConstraints,
  proportionalLayout,
  location,
  onDragOver,
  onDragLeave,
  onDrop,
  focusedPanelGroupId,
  onFocusPanel,
  onSelectTab,
  onCloseTab,
  onTabsReorder,
  onTabMove,
  onSplitPanel,
  onClosePanel,
  onContextMenuAction,
  onTabDoubleClick,
  isDragging,
  draggedTabId,
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
}: GridRendererProps) {
  if (isGridBranchNode(node)) {
    return (
      <GridBranchNodeView
        node={node}
        orientation={node.orientation}
        layoutContext={layoutContext}
        onLayoutChange={(sizes) => onLayoutChange(location, sizes)}
        childRenderer={(child, index) => (
          <GridRenderer
            key={index}
            node={child}
            orientation={node.orientation}
            layoutContext={{
              ...layoutContext,
              absoluteOffset: layoutContext.absoluteOffset,
              absoluteOrthogonalOffset: layoutContext.absoluteOrthogonalOffset,
            }}
            panelGroups={panelGroups}
            onLayoutChange={onLayoutChange}
            onPanelResize={onPanelResize}
            getViewConstraints={getViewConstraints}
            proportionalLayout={proportionalLayout}
            location={[...location, index]}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            focusedPanelGroupId={focusedPanelGroupId}
            onFocusPanel={onFocusPanel}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
            onTabsReorder={onTabsReorder}
            onTabMove={onTabMove}
            onSplitPanel={onSplitPanel}
            onClosePanel={onClosePanel}
            onContextMenuAction={onContextMenuAction}
            onTabDoubleClick={onTabDoubleClick}
            isDragging={isDragging}
            draggedTabId={draggedTabId}
            activeDragId={activeDragId}
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
        )}
        proportionalLayout={proportionalLayout}
        getViewConstraints={getViewConstraints}
      />
    );
  }

  // Get the panel group for this leaf, or create a default empty one
  const panelGroup = panelGroups[node.groupId] ?? {
    id: node.groupId,
    tabs: [],
    activeTabId: null,
    focused: false,
    percentage: node.size,
  };

  return (
    <GridLeafNodeView
      node={node}
      layoutContext={layoutContext}
      panelGroup={panelGroup}
      onResize={(width, height) => onPanelResize(node.groupId, width, height)}
      getViewConstraints={getViewConstraints}
      onDragOver={(e) => onDragOver(e, location)}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      isFocused={node.groupId === focusedPanelGroupId}
      onFocus={() => onFocusPanel?.(node.groupId)}
      onSelectTab={onSelectTab}
      onCloseTab={onCloseTab}
      onTabsReorder={onTabsReorder}
      onTabMove={onTabMove}
      onSplitPanel={onSplitPanel}
      onClosePanel={onClosePanel}
      onContextMenuAction={onContextMenuAction}
      onTabDoubleClick={onTabDoubleClick}
      isDraggingOver={isDragging}
      splitDirection={null}
      isSplitTarget={false}
      splitTargetLocation={null}
      activeDragId={activeDragId ?? draggedTabId}
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
      layoutOrientation={orientation}
    />
  );
}

/**
 * Update sizes in a grid node tree at the specified location
 */
function updateGridNodeSizes(node: GridNode, location: GridLocation, newSizes: number[]): GridNode {
  if (location.length === 0) {
    // At the target node
    if (isGridBranchNode(node)) {
      return {
        ...node,
        sizes: newSizes,
      };
    }
    return node;
  }

  if (!isGridBranchNode(node)) {
    return node;
  }

  const [index, ...rest] = location;
  const child = node.children[index];
  if (!child) return node;

  const updatedChild = updateGridNodeSizes(child, rest, newSizes);
  if (updatedChild === child) return node;

  return {
    ...node,
    children: [...node.children.slice(0, index), updatedChild, ...node.children.slice(index + 1)],
  };
}

export const MemoizedGridView = memo(GridView);
