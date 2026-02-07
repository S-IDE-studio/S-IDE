/**
 * Drop Overlay - VSCode-style preview overlay for panel split
 * Shows a preview of how the panel will be split during drag
 */

import { memo, useEffect, useRef } from "react";
import type { SplitDirection } from "../../types";

interface DropOverlayProps {
  containerRect: DOMRect;
  splitDirection: SplitDirection | null;
  tabHeight?: number; // Height of tab bar to exclude from drop target
}

export function DropOverlay({ containerRect, splitDirection, tabHeight = 0 }: DropOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const transitionAddedRef = useRef(false);

  // Update overlay position based on split direction
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    if (!splitDirection) {
      // No split - hide overlay
      overlay.style.opacity = "0";
      transitionAddedRef.current = false;
      return;
    }

    // Calculate position based on split direction
    let top = "0";
    let left = "0";
    let width = "100%";
    let height = "100%";

    switch (splitDirection) {
      case "up":
        top = "0";
        left = "0";
        width = "100%";
        height = `calc(50% - ${tabHeight}px)`;
        break;
      case "down":
        top = `calc(50% + ${tabHeight}px)`;
        left = "0";
        width = "100%";
        height = `calc(50% - ${tabHeight}px)`;
        break;
      case "left":
        top = tabHeight > 0 ? `${tabHeight}px` : "0";
        left = "0";
        width = "50%";
        height = tabHeight > 0 ? `calc(100% - ${tabHeight}px)` : "100%";
        break;
      case "right":
        top = tabHeight > 0 ? `${tabHeight}px` : "0";
        left = "50%";
        width = "50%";
        height = tabHeight > 0 ? `calc(100% - ${tabHeight}px)` : "100%";
        break;
    }

    overlay.style.top = top;
    overlay.style.left = left;
    overlay.style.width = width;
    overlay.style.height = height;
    overlay.style.opacity = "1";

    // Add transition class after initial positioning to prevent initial animation
    if (!transitionAddedRef.current) {
      setTimeout(() => {
        overlay.classList.add("overlay-move-transition");
        transitionAddedRef.current = true;
      }, 0);
    }
  }, [splitDirection, tabHeight]);

  if (!splitDirection) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="panel-drop-overlay"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10000,
        opacity: 0,
      }}
    />
  );
}

export const MemoizedDropOverlay = memo(DropOverlay);
