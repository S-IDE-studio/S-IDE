import { memo, useCallback } from "react";
import type { PanelGroup, PanelLayout } from "../../types";
import { createEmptyPanelGroup } from "../../utils/unifiedTabUtils";
import { MemoizedUnifiedPanelContainer } from "./UnifiedPanelContainer";

interface UnifiedPanelViewProps {
  groups: PanelGroup[];
  layout: PanelLayout;
  onSelectTab: (groupId: string, tabId: string) => void;
  onCloseTab: (groupId: string, tabId: string) => void;
  onFocusGroup: (groupId: string) => void;
}

export function UnifiedPanelView({
  groups,
  layout,
  onSelectTab,
  onCloseTab,
  onFocusGroup,
}: UnifiedPanelViewProps) {
  const focusedGroupId = groups.find((g) => g.focused)?.id ?? groups[0]?.id;

  // Single group
  if (layout.direction === "single" || groups.length === 1) {
    const group = groups[0];
    if (!group) {
      return (
        <div className="panel-view-empty">
          <p>パネルを追加してください</p>
        </div>
      );
    }

    return (
      <MemoizedUnifiedPanelContainer
        key={group.id}
        group={group}
        isFocused={group.id === focusedGroupId}
        onSelectTab={(tabId) => onSelectTab(group.id, tabId)}
        onCloseTab={(tabId) => onCloseTab(group.id, tabId)}
        onFocus={() => onFocusGroup(group.id)}
      />
    );
  }

  // Multiple groups
  return (
    <div className={`panel-groups panel-groups-${layout.direction}`}>
      {groups.map((group) => (
        <MemoizedUnifiedPanelContainer
          key={group.id}
          group={group}
          isFocused={group.id === focusedGroupId}
          onSelectTab={(tabId) => onSelectTab(group.id, tabId)}
          onCloseTab={(tabId) => onCloseTab(group.id, tabId)}
          onFocus={() => onFocusGroup(group.id)}
        />
      ))}
    </div>
  );
}

export const MemoizedUnifiedPanelView = memo(UnifiedPanelView);
