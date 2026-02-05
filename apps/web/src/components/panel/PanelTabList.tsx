/**
 * Panel Tab List - VSCode-style tab list with drag and drop
 */

import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { memo, useCallback, useState } from "react";
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
}: PanelTabListProps) {
  const [contextMenuTab, setContextMenuTab] = useState<UnifiedTab | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Small delay to prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeId = String(active.id);
      const overId = String(over.id);
      const oldIndex = tabs.findIndex((tab) => tab.id === activeId);
      const newIndex = tabs.findIndex((tab) => tab.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        onTabsReorder(oldIndex, newIndex);
      }
    }
  };

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

  const tabIds = tabs.map((tab) => tab.id);

  if (tabs.length === 0) {
    return (
      <div className="panel-tabs-empty">
        <span className="panel-tabs-empty-text">No tabs open</span>
      </div>
    );
  }

  return (
    <>
      <div className="panel-tabs-container">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <SortableContext items={tabIds} strategy={verticalListSortingStrategy}>
            <div className="panel-tabs">
              {tabs.map((tab) => (
                <MemoizedDraggableTab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  isDragging={false}
                  onSelect={onTabSelect}
                  onClose={onTabClose}
                  onContextMenu={handleContextMenu}
                  onDoubleClick={onTabDoubleClick}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
