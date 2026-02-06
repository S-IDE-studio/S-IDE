/**
 * GridLeafNode - Leaf node renderer for GridView
 * Renders the actual PanelGroup content
 * Based on VSCode's LeafNode class
 */

import { memo, useEffect, useMemo, useState } from "react";
import type { GridLeafNode as GridLeafNodeType, PanelGroup } from "../../types";
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

  // Render the panel group content
  // TODO: Render actual panel tabs and content using PanelGroup data
  // This will be integrated in Task #8 when connecting to App.tsx
  // For now, we render a placeholder that shows the panel info
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
        {/* Panel content will be rendered here by the parent component */}
        <div style={{ padding: "8px", opacity: 0.5, fontSize: "12px" }}>
          Panel: {panelGroup.id}
          <br />
          Tabs: {panelGroup.tabs.length}
          <br />
          Size: {Math.round(box.width)}x{Math.round(box.height)}
        </div>
      </div>
    </div>
  );
}

export const MemoizedGridLeafNodeView = memo(GridLeafNodeView);
