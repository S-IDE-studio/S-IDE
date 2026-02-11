/**
 * Dockview Tab Component
 *
 * Custom tab component for dockview that replicates the styling and functionality
 * of DraggableTab.tsx but adapted for dockview's IDockviewPanelHeaderProps.
 */

import type { IDockviewPanelHeaderProps } from "dockview";
import {
  Bot,
  Box,
  Code2,
  FileCode,
  FileText,
  Folder,
  Globe,
  Hash,
  Network,
  Pin,
  Server,
  Settings,
  ShieldCheck,
  Sliders,
  Terminal,
  Type,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { memo, useCallback, useState } from "react";
import type { UnifiedTab } from "../../types";
import { TabContextMenu } from "../panel/TabContextMenu";

interface DockviewTabProps extends IDockviewPanelHeaderProps<{ tab: UnifiedTab }> {
  // Extended props are included from IDockviewPanelHeaderProps
}

// Map tab kinds and file types to Lucide icons
const getTabIcon = (tab: UnifiedTab) => {
  if (tab.pinned) return null; // Will show Pin icon instead

  switch (tab.kind) {
    case "agent":
      return <Bot size={14} />;
    case "workspace":
      return <Folder size={14} />;
    case "deck":
      return <Box size={14} />;
    case "terminal":
      return <Terminal size={14} />;
    case "server":
      return <Server size={14} />;
    case "remoteAccess":
    case "tunnel": // Legacy alias
      return <Globe size={14} />;
    case "mcp":
      return <Network size={14} />;
    case "serverSettings":
      return <Settings size={14} />;
    case "agentStatus":
      return <UserCheck size={14} />;
    case "agentConfig":
      return <Sliders size={14} />;
    case "agentConfigLocal":
      return <Wrench size={14} />;
    case "setup":
      return <ShieldCheck size={14} />;
    case "editor":
      return getFileIcon(tab.icon);
    default:
      return <FileCode size={14} />;
  }
};

// Get file icon based on file type string
function getFileIcon(fileType?: string) {
  switch (fileType) {
    case "typescript":
    case "javascript":
      return <Code2 size={14} />;
    case "html":
      return <Type size={14} />;
    case "css":
    case "sass":
      return <Hash size={14} />;
    case "json":
      return <FileCode size={14} />;
    case "markdown":
      return <FileText size={14} />;
    case "python":
    case "go":
    case "rust":
    case "java":
      return <FileCode size={14} />;
    case "yaml":
      return <FileCode size={14} />;
    default:
      return <FileCode size={14} />;
  }
}

export function DockviewTab(props: DockviewTabProps) {
  const { api, params } = props;
  const tab = params.tab;

  const [contextMenuState, setContextMenuState] = useState<{
    isVisible: boolean;
    position: { x: number; y: number } | null;
    tab: UnifiedTab | null;
  }>({
    isVisible: false,
    position: null,
    tab: null,
  });

  // Handle close button click
  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      api.close();
    },
    [api]
  );

  // Handle middle mouse button click to close
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle click to close
      if (e.button === 1) {
        e.preventDefault();
        api.close();
      }
    },
    [api]
  );

  // Handle context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenuState({
        isVisible: true,
        position: { x: e.clientX, y: e.clientY },
        tab,
      });
    },
    [tab]
  );

  // Handle double click to toggle pin
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Toggle pin state - this requires updating the tab data
      // which should be handled through the app's state management
      // For now, we'll dispatch a custom event that the app can listen to
      const event = new CustomEvent("dockview-tab-toggle-pin", {
        detail: { tabId: tab.id },
      });
      window.dispatchEvent(event);
    },
    [tab]
  );

  // Handle context menu close
  const handleContextMenuClose = useCallback(() => {
    setContextMenuState({
      isVisible: false,
      position: null,
      tab: null,
    });
  }, []);

  // Handle context menu action
  const handleContextMenuAction = useCallback((action: string, targetTab: UnifiedTab) => {
    // Dispatch custom event for the app to handle
    const event = new CustomEvent("dockview-tab-context-action", {
      detail: { action, tab: targetTab },
    });
    window.dispatchEvent(event);
  }, []);

  const icon = getTabIcon(tab);

  // Note: dockview handles active state through CSS classes applied by the library
  // The parent element will have appropriate classes for active/inactive states
  return (
    <>
      <div
        className={`panel-tab ${tab.dirty ? "dirty" : ""} ${tab.pinned ? "pinned" : ""}`}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        data-tab-id={tab.id}
      >
        <span className="panel-tab-icon">
          {tab.pinned ? (
            <Pin size={12} className="tab-pin-icon" />
          ) : tab.icon?.startsWith("/") ? (
            <img src={tab.icon} alt="" className="panel-tab-icon-img" />
          ) : (
            icon
          )}
        </span>
        <span className="panel-tab-title">{tab.title}</span>
        {tab.dirty && <span className="panel-tab-dirty-indicator">●</span>}
        <button
          type="button"
          className="panel-tab-close"
          onClick={handleClose}
          aria-label="Close"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>

      {/* Context Menu */}
      <TabContextMenu
        tab={contextMenuState.tab}
        position={contextMenuState.position}
        isVisible={contextMenuState.isVisible}
        onClose={handleContextMenuClose}
        onAction={handleContextMenuAction as (action: string, tab: UnifiedTab) => void}
      />
    </>
  );
}

export const MemoizedDockviewTab = memo(DockviewTab);
