/**
 * Sash - Draggable resize handle for SplitView
 * Based on VSCode's sash implementation
 */

import { memo, useEffect, useRef, useState } from "react";

export type Orientation = "horizontal" | "vertical";

export interface SashProps {
  orientation: Orientation;
  onDragStart: () => void;
  onDrag: (delta: number) => void;
  onDragEnd: () => void;
  enabled?: boolean;
  size?: number;
  orthogonalSize?: number;
  /** Position in pixels (top for vertical, left for horizontal) */
  position?: number;
}

/**
 * Sash component - resize handle between views in SplitView
 */
export function Sash({
  orientation,
  onDragStart,
  onDrag,
  onDragEnd,
  enabled = true,
  size = 4,
  orthogonalSize,
  position,
}: SashProps) {
  const sashRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isDragging || !enabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!startPosRef.current) return;

      const deltaX = e.clientX - startPosRef.current.x;
      const deltaY = e.clientY - startPosRef.current.y;

      if (orientation === "vertical") {
        onDrag(deltaY);
      } else {
        onDrag(deltaX);
      }

      // Update start position for continuous delta
      startPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      startPosRef.current = null;
      onDragEnd();

      // Remove cursor override
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Set cursor based on orientation
    document.body.style.cursor = orientation === "vertical" ? "ns-resize" : "ew-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [isDragging, orientation, onDrag, onDragEnd, enabled]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    onDragStart();
  };

  // Calculate position and size based on orientation
  const style: React.CSSProperties = {
    position: "absolute",
    background: "transparent",
    transition: "background 0.15s",
    userSelect: "none",
    pointerEvents: enabled ? "auto" : "none",
  };

  if (orientation === "vertical") {
    style.left = "0";
    style.right = "0";
    if (position !== undefined) {
      style.top = `${position}px`;
    }
    style.height = `${size}px`;
    style.cursor = enabled ? "ns-resize" : "default";
    if (orthogonalSize !== undefined) {
      style.width = `${orthogonalSize}px`;
    }
  } else {
    style.top = "0";
    style.bottom = "0";
    if (position !== undefined) {
      style.left = `${position}px`;
    }
    style.width = `${size}px`;
    style.cursor = enabled ? "ew-resize" : "default";
    if (orthogonalSize !== undefined) {
      style.height = `${orthogonalSize}px`;
    }
  }

  return (
    <div
      ref={sashRef}
      className={`sash sash-${orientation} ${isDragging ? "dragging" : ""} ${!enabled ? "disabled" : ""}`}
      style={style}
      onMouseDown={handleMouseDown}
      title={enabled ? "Drag to resize" : undefined}
    />
  );
}

export const MemoizedSash = memo(Sash);
