/**
 * GridLeafNode - Leaf node renderer for GridView
 * Renders the actual PanelGroup content
 * Based on VSCode's LeafNode class
 */

import { memo, useEffect, useMemo, useState } from "react";
import type {
  GridLeafNode as GridLeafNodeType,
  GridLocation,
  PanelGroup,
  SplitDirection,
  TabContextMenuAction,
} from "../../types";
import { MemoizedUnifiedPanelContainer } from "../panel/UnifiedPanelContainer";
import type { ViewConstraints } from "./GridView";

/**
 * Props for GridLeafNodeView component
 */
export interface GridLeafNodeViewProps {
  /** Leaf node to render */
  node: GridLeafNodeType;
  /** Layout context from parent */
  layoutContext: {
    readonly orthogonalSize: number;
    readonly absoluteOffset: number;
    readonly absoluteOrthogonalOffset: number;
    readonly absoluteSize: number;
    readonly absoluteOrthogonalSize: number;
  };
  /** Panel group data */
  panelGroup: PanelGroup;
  /** Callback when this panel is resized */
  onResize: (width: number, height: number) => void;
  /** Get view size constraints */
  getViewConstraints: (groupId: string) => ViewConstraints;
  /** Drag over event handler */
  onDragOver?: (e: React.DragEvent) => void;
  /** Drag leave event handler */
  onDragLeave?: (e: React.DragEvent) => void;
  /** Drop event handler */
  onDrop?: (e: React.DragEvent) => void;
  /** Whether this is the focused panel */
  isFocused?: boolean;
  /** Callback when panel is focused */
  onFocus?: () => void;
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
  onTabDoubleClick?: (tab: import("../../types").UnifiedTab) => void;
  /** Whether a drag is currently active */
  isDraggingOver?: boolean;
  /** Split preview direction */
  splitDirection?: SplitDirection | null;
  /** Whether this is a split target */
  isSplitTarget?: boolean;
  /** Split target location */
  splitTargetLocation?: GridLocation | null;
  /** ID of the tab being dragged */
  activeDragId?: string | null;
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
  /** Layout orientation */
  layoutOrientation?: "horizontal" | "vertical";
}

/**
 * Calculate box dimensions based on layout context
 */
function calculateBox(
  size: number,
  orthogonalSize: number,
  absoluteOffset: number,
  absoluteOrthogonalOffset: number,
  orientation: "horizontal" | "vertical"
): { top: number; left: number; width: number; height: number } {
  if (orientation === "horizontal") {
    return {
      top: absoluteOffset,
      left: absoluteOrthogonalOffset,
      width: orthogonalSize,
      height: size,
    };
  }
  return {
    top: absoluteOrthogonalOffset,
    left: absoluteOffset,
    width: size,
    height: orthogonalSize,
  };
}

/**
 * GridLeafNodeView - Renders a leaf node (panel group)
 *
 * Responsibilities:
 * - Render the panel group content
 * - Apply size constraints
 * - Notify parent on resize
 * - Cache layout to avoid unnecessary updates
 */
export function GridLeafNodeView({
  node,
  layoutContext,
  panelGroup,
  onResize,
  getViewConstraints,
  onDragOver,
  onDragLeave,
  onDrop,
  isFocused = false,
  onFocus,
  onSelectTab,
  onCloseTab,
  onTabsReorder,
  onTabMove,
  onSplitPanel,
  onClosePanel,
  onContextMenuAction,
  onTabDoubleClick,
  isDraggingOver = false,
  splitDirection,
  isSplitTarget = false,
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
  layoutOrientation = "horizontal",
}: GridLeafNodeViewProps) {
  const [cachedWidth, setCachedWidth] = useState(0);
  const [cachedHeight, setCachedHeight] = useState(0);
  const [cachedTop, setCachedTop] = useState(0);
  const [cachedLeft, setCachedLeft] = useState(0);
  const orientation =
    layoutContext.absoluteSize > layoutContext.absoluteOrthogonalSize ? "horizontal" : "vertical";

  /**
   * Get view constraints for this panel
   */
  const constraints = useMemo(
    () => getViewConstraints(node.groupId),
    [node.groupId, getViewConstraints]
  );

  /**
   * Calculate current box dimensions
   */
  const box = useMemo(() => {
    return calculateBox(
      node.size,
      layoutContext.orthogonalSize,
      layoutContext.absoluteOffset,
      layoutContext.absoluteOrthogonalOffset,
      orientation
    );
  }, [node.size, layoutContext, orientation]);

  /**
   * Notify parent on resize if dimensions changed
   */
  useEffect(() => {
    if (
      box.width !== cachedWidth ||
      box.height !== cachedHeight ||
      box.top !== cachedTop ||
      box.left !== cachedLeft
    ) {
      setCachedWidth(box.width);
      setCachedHeight(box.height);
      setCachedTop(box.top);
      setCachedLeft(box.left);
      onResize(box.width, box.height);
    }
  }, [box, cachedWidth, cachedHeight, cachedTop, cachedLeft, onResize]);

  /**
   * Style for the leaf node container
   */
  const style: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      top: `${box.top}px`,
      left: `${box.left}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      minWidth: `${constraints.minimumWidth}px`,
      maxWidth:
        constraints.maximumWidth === Number.POSITIVE_INFINITY
          ? "none"
          : `${constraints.maximumWidth}px`,
      minHeight: `${constraints.minimumHeight}px`,
      maxHeight:
        constraints.maximumHeight === Number.POSITIVE_INFINITY
          ? "none"
          : `${constraints.maximumHeight}px`,
      overflow: "hidden",
    }),
    [box, constraints]
  );

  // Render the panel group content using UnifiedPanelContainer
  return (
    <div
      className="grid-leaf-node"
      style={style}
      data-group-id={node.groupId}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="grid-leaf-content" style={{ width: "100%", height: "100%" }}>
        <MemoizedUnifiedPanelContainer
          group={panelGroup}
          isFocused={isFocused}
          isFirstPanel={false}
          isLastPanel={false}
          canSplitHorizontal={true}
          canSplitVertical={true}
          layoutDirection={layoutOrientation === "horizontal" ? "horizontal" : "vertical"}
          onSelectTab={(tabId) => onSelectTab?.(node.groupId, tabId)}
          onCloseTab={(tabId) => onCloseTab?.(node.groupId, tabId)}
          onFocus={() => onFocus?.()}
          onTabsReorder={(oldIndex, newIndex) => onTabsReorder?.(node.groupId, oldIndex, newIndex)}
          onTabMove={(tabId, targetGroupId) => onTabMove?.(tabId, node.groupId, targetGroupId)}
          onSplitPanel={(direction) => onSplitPanel?.(node.groupId, direction) ?? ""}
          onClosePanel={() => onClosePanel?.(node.groupId)}
          onResize={() => {}}
          onContextMenuAction={(action, tabId) =>
            onContextMenuAction?.(action, node.groupId, tabId)
          }
          onTabDoubleClick={onTabDoubleClick}
          isDraggingOver={isDraggingOver}
          splitDirection={splitDirection}
          isSplitTarget={isSplitTarget}
          splitTargetLocation={splitTargetLocation}
          activeDragId={activeDragId ?? null}
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
          wsBase={wsBase ?? ""}
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
      </div>
    </div>
  );
}

export const MemoizedGridLeafNodeView = memo(GridLeafNodeView);
