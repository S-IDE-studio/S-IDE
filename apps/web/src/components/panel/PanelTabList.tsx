/**
 * Panel Tab List - VSCode-style tab list with drag and drop
 */

import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { memo, useCallback, useMemo, useState } from "react";
import type { TabContextMenuAction, UnifiedTab } from "../../types";
import { MemoizedDraggableTab } from "./DraggableTab";
import { MemoizedTabContextMenu } from "./TabContextMenu";

interface PanelTabListProps {
  groupId: string;
  tabs: UnifiedTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabsReorder: (oldIndex: number, newIndex: number) => void;
  onTabMove: (tabId: string, targetGroupId: string) => void;
  onContextMenuAction: (action: TabContextMenuAction, tab: UnifiedTab) => void;
  onTabDoubleClick?: (tab: UnifiedTab) => void;
  isDraggingOver?: boolean;
  // Drag state from parent (for real-time preview)
  activeDragId?: string | null;
  // Real-time tabs state from parent (for visual feedback during drag)
  realTimeTabs?: UnifiedTab[];
}

export function PanelTabList({
  groupId,
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabsReorder,
  onTabMove,
  onContextMenuAction,
  onTabDoubleClick,
  isDraggingOver,
  activeDragId,
  realTimeTabs,
}: PanelTabListProps) {
  const [contextMenuTab, setContextMenuTab] = useState<UnifiedTab | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );

  const handleContextMenu = useCallback((tab: UnifiedTab, event: React.MouseEvent) => {
    setContextMenuTab(tab);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenuTab(null);
    setContextMenuPosition(null);
  }, []);

  const handleContextMenuAction = useCallback(
    (action: TabContextMenuAction, tab: UnifiedTab) => {
      onContextMenuAction(action, tab);
    },
    [onContextMenuAction]
  );

  // Use real-time tabs during drag, otherwise use original tabs
  const displayTabs = realTimeTabs || tabs;
  const tabIds = useMemo(() => displayTabs.map((tab) => tab.id), [displayTabs]);

  if (displayTabs.length === 0) {
    return (
      <div className="panel-tabs-empty">
        <span className="panel-tabs-empty-text">No tabs open</span>
      </div>
    );
  }

  return (
    <>
      <div className={`panel-tabs-container ${isDraggingOver ? "drag-over" : ""}`}>
        <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
          <div className="panel-tabs">
            {displayTabs.map((tab) => (
              <MemoizedDraggableTab
                key={tab.id}
                tab={tab}
                groupId={groupId}
                isActive={tab.id === activeTabId}
                isDragging={tab.id === activeDragId}
                onSelect={onTabSelect}
                onClose={onTabClose}
                onContextMenu={handleContextMenu}
                onDoubleClick={onTabDoubleClick}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      <MemoizedTabContextMenu
        tab={contextMenuTab}
        position={contextMenuPosition}
        isVisible={contextMenuTab !== null}
        onClose={handleContextMenuClose}
        onAction={handleContextMenuAction}
      />
    </>
  );
}

export const MemoizedPanelTabList = memo(PanelTabList);
