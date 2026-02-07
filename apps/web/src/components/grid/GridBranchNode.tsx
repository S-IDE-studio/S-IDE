/**
 * GridBranchNode - Branch node renderer for GridView
 * Uses SplitView to arrange children horizontally or vertically
 * Based on VSCode's BranchNode class
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GridBranchNode as GridBranchNodeType, GridNode, GridOrientation } from "../../types";
import { isGridLeafNode } from "../../types";
import type { ViewConstraints } from "./GridView";
import type { SplitViewHandle } from "./SplitView";
import { type IView, LayoutPriority, SplitView } from "./SplitView";

/**
 * Props for GridBranchNodeView component
 */
export interface GridBranchNodeViewProps {
  /** Branch node to render */
  node: GridBranchNodeType;
  /** Orientation of this branch */
  orientation: GridOrientation;
  /** Layout context from parent */
  layoutContext: {
    readonly orthogonalSize: number;
    readonly absoluteOffset: number;
    readonly absoluteOrthogonalOffset: number;
    readonly absoluteSize: number;
    readonly absoluteOrthogonalSize: number;
  };
  /** Callback when layout changes */
  onLayoutChange: (newSizes: number[]) => void;
  /** Renderer for child nodes */
  childRenderer: (child: GridNode, index: number) => React.ReactNode;
  /** Enable proportional layout */
  proportionalLayout?: boolean;
  /** Get view size constraints for child groups */
  getViewConstraints?: (groupId: string) => ViewConstraints;
}

/**
 * Convert orientation to SplitView orientation
 */
function toSplitViewOrientation(orientation: GridOrientation): "horizontal" | "vertical" {
  return orientation;
}

/**
 * GridBranchNodeView - Renders a branch node using SplitView
 *
 * Responsibilities:
 * - Arrange children using SplitView
 * - Handle resize events from sash drag
 * - Propagate layout changes to parent
 * - Calculate size constraints based on children
 */
export function GridBranchNodeView({
  node,
  orientation,
  layoutContext,
  onLayoutChange,
  childRenderer,
  proportionalLayout = true,
  getViewConstraints = () => ({
    minimumWidth: 100,
    maximumWidth: Number.POSITIVE_INFINITY,
    minimumHeight: 100,
    maximumHeight: Number.POSITIVE_INFINITY,
  }),
}: GridBranchNodeViewProps) {
  // Track current view sizes from SplitView
  const [currentViewSizes, setCurrentViewSizes] = useState<number[]>(node.sizes);
  const splitViewRef = useRef<SplitViewHandle | null>(null);

  // Update sizes when node.sizes changes
  // Convert percentage sizes to pixel sizes
  useEffect(() => {
    const pixelSizes = node.sizes.map((size) => (size / 100) * layoutContext.orthogonalSize);
    setCurrentViewSizes(pixelSizes);
  }, [node.sizes, layoutContext.orthogonalSize]);

  /**
   * Calculate minimum size for a child based on its constraints
   * For horizontal orientation: use width constraints
   * For vertical orientation: use height constraints
   */
  const getChildMinimumSize = useCallback(
    (child: GridNode): number => {
      if (isGridLeafNode(child)) {
        const constraints = getViewConstraints(child.groupId);
        return orientation === "horizontal" ? constraints.minimumWidth : constraints.minimumHeight;
      }
      // For branch nodes, use a default minimum
      return 100;
    },
    [orientation, getViewConstraints]
  );

  /**
   * Calculate maximum size for a child based on its constraints
   */
  const getChildMaximumSize = useCallback(
    (child: GridNode): number => {
      if (isGridLeafNode(child)) {
        const constraints = getViewConstraints(child.groupId);
        return orientation === "horizontal" ? constraints.maximumWidth : constraints.maximumHeight;
      }
      return Number.POSITIVE_INFINITY;
    },
    [orientation, getViewConstraints]
  );

  /**
   * Calculate minimum size across all children
   * Use the maximum of minimum sizes to ensure all children fit
   */
  const minimumSize = useMemo(() => {
    return Math.max(100, ...node.children.map((child) => getChildMinimumSize(child)));
  }, [node.children, getChildMinimumSize]);

  /**
   * Calculate maximum size across all children
   * Use the minimum of maximum sizes to respect constraints
   */
  const maximumSize = useMemo(() => {
    const maxSizes = node.children.map((child) => getChildMaximumSize(child));
    const finiteMaxSizes = maxSizes.filter((s) => s < Number.POSITIVE_INFINITY);
    if (finiteMaxSizes.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.min(...finiteMaxSizes);
  }, [node.children, getChildMaximumSize]);

  /**
   * Create IView for each child with proper size constraints
   */
  const views: IView[] = useMemo(() => {
    return node.children.map((child, index) => ({
      id: `child-${index}`,
      element: childRenderer(child, index),
      minimumSize: getChildMinimumSize(child),
      maximumSize: getChildMaximumSize(child),
      priority: LayoutPriority.Normal,
      proportionalLayout: true,
      size: currentViewSizes[index] ?? getChildMinimumSize(child),
    }));
  }, [node.children, childRenderer, currentViewSizes, getChildMinimumSize, getChildMaximumSize]);

  /**
   * Handle layout change from SplitView
   * Convert pixel sizes back to percentages when reporting to parent
   */
  const handleDidChange = useCallback(() => {
    // Get actual current sizes from SplitView
    const actualSizes = splitViewRef.current?.getViewSizes() ?? currentViewSizes;
    setCurrentViewSizes(actualSizes);
    // Convert pixel sizes to percentages for parent
    const percentageSizes = actualSizes.map((size) => (size / layoutContext.orthogonalSize) * 100);
    onLayoutChange(percentageSizes);
  }, [onLayoutChange, layoutContext.orthogonalSize, currentViewSizes]);

  /**
   * Distribute view sizes equally
   */
  const distributeViewSizes = useCallback(() => {
    splitViewRef.current?.distributeViewSizes();
  }, []);

  // Expose imperative methods
  useEffect(() => {
    // Store imperative handle if needed
    return () => {
      splitViewRef.current = null;
    };
  }, []);

  return (
    <SplitView
      ref={splitViewRef}
      orientation={toSplitViewOrientation(orientation)}
      size={layoutContext.orthogonalSize}
      views={views}
      onDidChange={handleDidChange}
      proportionalLayout={proportionalLayout}
      className="grid-branch-node"
    />
  );
}

export const MemoizedGridBranchNodeView = memo(GridBranchNodeView);
