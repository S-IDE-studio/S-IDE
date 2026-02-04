import { X } from "lucide-react";
import { memo } from "react";
import type { UnifiedTab } from "../../types";

interface PanelTabListProps {
  tabs: UnifiedTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

export function PanelTabList({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
}: PanelTabListProps) {
  if (tabs.length === 0) {
    return (
      <div className="panel-tabs-empty">
        <span className="panel-tabs-empty-text">パネルが空です</span>
      </div>
    );
  }

  return (
    <div className="panel-tabs">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`panel-tab ${isActive ? "active" : ""} ${tab.dirty ? "dirty" : ""}`}
            onClick={() => onTabSelect(tab.id)}
          >
            <span className="panel-tab-icon">{tab.icon}</span>
            <span className="panel-tab-title">{tab.title}</span>
            <button
              type="button"
              className="panel-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              aria-label="閉じる"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export const MemoizedPanelTabList = memo(PanelTabList);
