/**
 * Panel Resize Handle - Draggable handle for resizing panels
 */

import { memo, useEffect, useRef, useState } from "react";

interface PanelResizeHandleProps {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

export function PanelResizeHandle({
  direction,
  onResize,
  onResizeStart,
  onResizeEnd,
}: PanelResizeHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!startPosRef.current) return;

      const deltaX = e.clientX - startPosRef.current.x;
      const deltaY = e.clientY - startPosRef.current.y;

      if (direction === "horizontal") {
        onResize(deltaX);
      } else {
        onResize(deltaY);
      }

      // Update start position for continuous delta
      startPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      startPosRef.current = null;
      onResizeEnd?.();

      // Remove cursor override
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Set cursor based on direction
    document.body.style.cursor = direction === "horizontal" ? "ew-resize" : "ns-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [isResizing, direction, onResize, onResizeEnd]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    onResizeStart?.();
  };

  return (
    <div
      ref={handleRef}
      className={`panel-resize-handle panel-resize-handle-${direction} ${isResizing ? "resizing" : ""}`}
      onMouseDown={handleMouseDown}
      title={
        direction === "horizontal" ? "Drag to resize horizontally" : "Drag to resize vertically"
      }
    />
  );
}

export const MemoizedPanelResizeHandle = memo(PanelResizeHandle);
