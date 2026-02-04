import { memo, useCallback } from "react";
import type { PanelGroup } from "../../types";
import { PanelTabList } from "./PanelTabList";
import { PanelContent } from "./PanelContent";

interface UnifiedPanelContainerProps {
  group: PanelGroup;
  isFocused: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onFocus: () => void;
}

export function UnifiedPanelContainer({
  group,
  isFocused,
  onSelectTab,
  onCloseTab,
  onFocus,
}: UnifiedPanelContainerProps) {
  const activeTab = group.tabs.find((t) => t.id === group.activeTabId);

  const handleContainerClick = useCallback(() => {
    onFocus();
  }, [onFocus]);

  const handleSelectTab = useCallback(
    (tabId: string) => {
      onSelectTab(tabId);
    },
    [onSelectTab]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      onCloseTab(tabId);
    },
    [onCloseTab]
  );

  return (
    <div
      className={`panel-group ${isFocused ? "focused" : ""}`}
      onClick={handleContainerClick}
    >
      {/* Tab List */}
      <PanelTabList
        tabs={group.tabs}
        activeTabId={group.activeTabId}
        onTabSelect={handleSelectTab}
        onTabClose={handleCloseTab}
      />

      {/* Content */}
      <div className="panel-content">
        {activeTab ? (
          <PanelContent tab={activeTab} />
        ) : (
          <div className="panel-empty">
            <p>パネルを選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const MemoizedUnifiedPanelContainer = memo(UnifiedPanelContainer);
