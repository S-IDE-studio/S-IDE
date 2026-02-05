/**
 * Tab Context Menu - VSCode-style right-click menu for tabs
 */

import { Pin, Split, X } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import type { TabContextMenuAction, UnifiedTab } from "../../types";

interface TabContextMenuProps {
  tab: UnifiedTab | null;
  position: { x: number; y: number } | null;
  isVisible: boolean;
  onClose: () => void;
  onAction: (action: TabContextMenuAction, tab: UnifiedTab) => void;
}

interface MenuItem {
  label?: string;
  action?: TabContextMenuAction;
  icon?: React.ReactNode;
  separator?: boolean;
  disabled?: boolean;
}

export function TabContextMenu({
  tab,
  position,
  isVisible,
  onClose,
  onAction,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isVisible, onClose]);

  if (!isVisible || !tab || !position) {
    return null;
  }

  const menuItems: MenuItem[] = [
    { label: "Close", action: "close", icon: <X size={14} /> },
    { label: "Close Others", action: "closeOthers", icon: <X size={14} /> },
    { label: "Close to the Right", action: "closeToTheRight" },
    { label: "Close to the Left", action: "closeToTheLeft" },
    { separator: true },
    { label: "Split Right", action: "splitRight", icon: <Split size={14} /> },
    { label: "Split Left", action: "splitLeft", icon: <Split size={14} /> },
    { label: "Split Up", action: "splitUp" },
    { label: "Split Down", action: "splitDown" },
    { separator: true },
    {
      label: tab.pinned ? "Unpin" : "Pin",
      action: tab.pinned ? "unpin" : "pin",
      icon: <Pin size={14} />,
    },
  ];

  const handleAction = (action: TabContextMenuAction) => {
    onAction(action, tab);
    onClose();
  };

  // Position menu within viewport
  const menuStyle = {
    left: Math.min(position.x, window.innerWidth - 200),
    top: Math.min(position.y, window.innerHeight - 300),
  };

  return (
    <div ref={menuRef} className="tab-context-menu" style={menuStyle}>
      {menuItems.map((item, index) => {
        if (item.separator) {
          return <div key={`sep-${index}`} className="tab-context-menu-separator" />;
        }

        return (
          <button
            key={item.action ?? index}
            type="button"
            className="tab-context-menu-item"
            onClick={() => item.action && handleAction(item.action)}
            disabled={item.disabled}
          >
            {item.icon && <span className="tab-context-menu-icon">{item.icon}</span>}
            {item.label && <span>{item.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export const MemoizedTabContextMenu = memo(TabContextMenu);
