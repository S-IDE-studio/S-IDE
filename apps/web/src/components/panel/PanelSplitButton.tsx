/**
 * Panel Split Button - VSCode-style panel split controls
 */

import { Columns3, Rows3, X } from "lucide-react";
import { memo, useRef, useState } from "react";
import type { SplitDirection } from "../../types";

interface PanelSplitButtonProps {
  canSplitVertical: boolean;
  canSplitHorizontal: boolean;
  canClose: boolean;
  onSplit: (direction: SplitDirection) => void;
  onClose: () => void;
}

export function PanelSplitButton({
  canSplitVertical,
  canSplitHorizontal,
  canClose,
  onSplit,
  onClose,
}: PanelSplitButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSplit = (direction: SplitDirection) => {
    setIsMenuOpen(false);
    onSplit(direction);
  };

  const handleClose = () => {
    setIsMenuOpen(false);
    onClose();
  };

  return (
    <div className="panel-split-button-container" ref={menuRef}>
      <button
        type="button"
        className="panel-split-button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        title="Split Panel"
        aria-label="Split Panel"
      >
        <Columns3 size={14} />
      </button>

      {isMenuOpen && (
        <div className="panel-split-menu">
          {canSplitVertical && (
            <button
              type="button"
              className="panel-split-menu-item"
              onClick={() => handleSplit("right")}
              title="Split Right"
            >
              <Columns3 size={14} />
              <span>Split Right</span>
            </button>
          )}
          {canSplitVertical && (
            <button
              type="button"
              className="panel-split-menu-item"
              onClick={() => handleSplit("left")}
              title="Split Left"
            >
              <Columns3 size={14} className="flip-horizontal" />
              <span>Split Left</span>
            </button>
          )}
          {canSplitHorizontal && (
            <button
              type="button"
              className="panel-split-menu-item"
              onClick={() => handleSplit("down")}
              title="Split Down"
            >
              <Rows3 size={14} />
              <span>Split Down</span>
            </button>
          )}
          {canSplitHorizontal && (
            <button
              type="button"
              className="panel-split-menu-item"
              onClick={() => handleSplit("up")}
              title="Split Up"
            >
              <Rows3 size={14} className="flip-vertical" />
              <span>Split Up</span>
            </button>
          )}
          {canClose && (
            <>
              <div className="panel-split-menu-separator" />
              <button
                type="button"
                className="panel-split-menu-item panel-split-menu-item-danger"
                onClick={handleClose}
                title="Close Panel"
              >
                <X size={14} />
                <span>Close Panel</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const MemoizedPanelSplitButton = memo(PanelSplitButton);
