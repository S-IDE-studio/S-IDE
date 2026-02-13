/**
 * Dockview Tab Component
 *
 * Custom tab component for dockview that replicates the styling and functionality
 * of DraggableTab.tsx but adapted for dockview's IDockviewPanelHeaderProps.
 */

import type { IDockviewPanelHeaderProps } from "dockview";
import { DEFAULT_FILE, getIconForFile } from "vscode-icons-js";
import {
  Bot,
  Box,
  FileCode,
  Folder,
  Globe,
  Network,
  Pin,
  Server,
  Settings,
  ShieldCheck,
  Sliders,
  Terminal,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { useCallback } from "react";
import type { UnifiedTab } from "../../types";

interface DockviewTabProps extends IDockviewPanelHeaderProps<{ tab: UnifiedTab }> {
  // Extended props are included from IDockviewPanelHeaderProps
}

const VSCODE_ICONS_LOCAL_BASE = "/vscode-icons";

function getVscodeIconUrl(iconFileName: string): string {
  return `${VSCODE_ICONS_LOCAL_BASE}/${iconFileName}`;
}

function getEditorIconUrl(tab: UnifiedTab): string {
  const fileName = tab.data.editor?.name || tab.title;
  const iconFile = getIconForFile(fileName) || DEFAULT_FILE;
  return getVscodeIconUrl(iconFile);
}

// Map tab kinds to icons
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
    default:
      return <FileCode size={14} />;
  }
};

export function DockviewTab(props: DockviewTabProps) {
  const { api, params } = props;
  const tab = params.tab;

  // Handle close button click
  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      api.close();
    },
    [api]
  );

  const icon = getTabIcon(tab);
  const editorIconSrc = tab.kind === "editor" ? getEditorIconUrl(tab) : null;

  // Note: dockview handles active state and drag/drop through the parent .dv-tab element
  // Our custom tab component is purely presentational with pointer-events: none on the container
  return (
    <div
      className={`panel-tab ${tab.dirty ? "dirty" : ""} ${tab.pinned ? "pinned" : ""}`}
      data-tab-id={tab.id}
    >
      <span className="panel-tab-icon">
        {tab.pinned ? (
          <Pin size={12} className="tab-pin-icon" />
        ) : editorIconSrc ? (
          <img src={editorIconSrc} alt="" className="panel-tab-icon-img" />
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
  );
}
