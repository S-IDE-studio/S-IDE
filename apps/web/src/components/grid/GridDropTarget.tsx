/**
 * GridDropTarget - Drag overlay preview for GridView
 * Shows visual feedback when dragging tabs over grid areas
 * Based on VSCode's drop target indicators
 */

import { memo, useMemo } from "react";
import type { SplitDirection } from "../../types";

/**
 * Props for GridDropTarget component
 */
export interface GridDropTargetProps {
  /** Whether the drop target is visible */
  visible: boolean;
  /** Split direction to indicate */
  direction: SplitDirection | null;
  /** Width of the target area */
  width?: number;
  /** Height of the target area */
  height?: number;
  /** Additional class name */
  className?: string;
}

/**
 * Calculate CSS based on split direction
 */
function getDropStyle(
  direction: SplitDirection | null,
  width: number,
  height: number
): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    backgroundColor: "var(--color-accent, #007acc)",
    opacity: 0.2,
    pointerEvents: "none",
    transition: "all 0.15s ease-out",
  };

  if (!direction) {
    return { ...baseStyle, opacity: 0 };
  }

  switch (direction) {
    case "left":
      return {
        ...baseStyle,
        left: 0,
        top: 0,
        bottom: 0,
        width: `${width * 0.5}px`,
      };
    case "right":
      return {
        ...baseStyle,
        right: 0,
        top: 0,
        bottom: 0,
        width: `${width * 0.5}px`,
      };
    case "up":
      return {
        ...baseStyle,
        left: 0,
        top: 0,
        right: 0,
        height: `${height * 0.5}px`,
      };
    case "down":
      return {
        ...baseStyle,
        left: 0,
        bottom: 0,
        right: 0,
        height: `${height * 0.5}px`,
      };
    default:
      return baseStyle;
  }
}

/**
 * Get border indicator style for split direction
 */
function getBorderIndicatorStyle(direction: SplitDirection | null): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    backgroundColor: "var(--color-accent, #007acc)",
    pointerEvents: "none",
    transition: "all 0.15s ease-out",
  };

  if (!direction) {
    return { ...baseStyle, opacity: 0 };
  }

  const thickness = 2;

  switch (direction) {
    case "left":
      return {
        ...baseStyle,
        left: "50%",
        top: 0,
        bottom: 0,
        width: `${thickness}px`,
      };
    case "right":
      return {
        ...baseStyle,
        left: "50%",
        top: 0,
        bottom: 0,
        width: `${thickness}px`,
      };
    case "up":
      return {
        ...baseStyle,
        top: "50%",
        left: 0,
        right: 0,
        height: `${thickness}px`,
      };
    case "down":
      return {
        ...baseStyle,
        top: "50%",
        left: 0,
        right: 0,
        height: `${thickness}px`,
      };
    default:
      return baseStyle;
  }
}

/**
 * GridDropTarget - Visual indicator for drag-drop in GridView
 *
 * Shows:
 * - Highlighted area where the drop will occur
 * - Border indicator for the new sash position
 * - Direction indicator (arrow or label)
 */
export function GridDropTarget({
  visible,
  direction,
  width = 0,
  height = 0,
  className = "",
}: GridDropTargetProps) {
  /**
   * Drop area style
   */
  const dropAreaStyle = useMemo(() => {
    if (!visible || !direction) {
      return { opacity: 0 };
    }
    return getDropStyle(direction, width, height);
  }, [visible, direction, width, height]);

  /**
   * Border indicator style
   */
  const borderIndicatorStyle = useMemo(() => {
    if (!visible || !direction) {
      return { opacity: 0 };
    }
    return getBorderIndicatorStyle(direction);
  }, [visible, direction]);

  /**
   * Direction label
   */
  const directionLabel = useMemo(() => {
    switch (direction) {
      case "left":
        return "←";
      case "right":
        return "→";
      case "up":
        return "↑";
      case "down":
        return "↓";
      default:
        return null;
    }
  }, [direction]);

  if (!visible || !direction) {
    return null;
  }

  return (
    <div className={`grid-drop-target ${className}`}>
      {/* Highlighted drop area */}
      <div className="grid-drop-area" style={dropAreaStyle} />

      {/* Border indicator for new sash */}
      <div className="grid-drop-border" style={borderIndicatorStyle} />

      {/* Direction indicator */}
      {directionLabel && (
        <div
          className="grid-drop-direction"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "24px",
            color: "var(--color-accent, #007acc)",
            pointerEvents: "none",
            fontWeight: "bold",
          }}
        >
          {directionLabel}
        </div>
      )}
    </div>
  );
}

export const MemoizedGridDropTarget = memo(GridDropTarget);
