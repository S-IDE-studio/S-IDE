import { Activity, Files, GitBranch, Server, Settings } from "lucide-react";
import type { SidebarPanel } from "../types";

interface SideNavProps {
  activeView?: "workspace" | "terminal";
  onSelect?: (view: "workspace" | "terminal") => void;
  onOpenSettings: () => void;
  onOpenServerModal?: () => void;
  sidebarPanel?: SidebarPanel;
  onSetSidebarPanel?: (panel: SidebarPanel) => void;
  onToggleContextStatus?: () => void;
  className?: string;
}

export function SideNav({
  activeView = "workspace",
  onSelect,
  onOpenSettings,
  onOpenServerModal,
  sidebarPanel = "files",
  onSetSidebarPanel,
  onToggleContextStatus,
  className = "",
}: SideNavProps) {
  const handlePanelChange = (panel: SidebarPanel) => {
    if (onSetSidebarPanel) {
      onSetSidebarPanel(panel);
    }
    if (panel === "settings") {
      onOpenSettings();
    }
  };

  const handleContextStatusClick = () => {
    onToggleContextStatus?.();
  };

  const handleServerModalClick = () => {
    onOpenServerModal?.();
  };

  return (
    <div className={className}>
      <nav className="activity-bar" aria-label="Main navigation">
        <div className="activity-bar-top">
          <button
            type="button"
            className={`activity-bar-item ${sidebarPanel === "files" ? "active" : ""}`}
            onClick={() => handlePanelChange("files")}
            title="Files"
            aria-label="Files"
            aria-current={sidebarPanel === "files" ? "page" : undefined}
          >
            <Files size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`activity-bar-item ${sidebarPanel === "git" ? "active" : ""}`}
            onClick={() => handlePanelChange("git")}
            title="Source Control"
            aria-label="Source Control"
            aria-current={sidebarPanel === "git" ? "page" : undefined}
          >
            <GitBranch size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`activity-bar-item ${sidebarPanel === "ai" ? "active" : ""}`}
            onClick={() => handlePanelChange("ai")}
            title="AI Workflow"
            aria-label="AI Workflow"
            aria-current={sidebarPanel === "ai" ? "page" : undefined}
          >
            <Activity size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="activity-spacer" />
        <div className="activity-bar-bottom">
          <button
            type="button"
            className="activity-bar-item"
            onClick={handleServerModalClick}
            title="Server"
            aria-label="Server settings"
          >
            <Server size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`activity-bar-item ${sidebarPanel === "settings" ? "active" : ""}`}
            onClick={() => handlePanelChange("settings")}
            title="Settings"
            aria-label="Settings"
            aria-current={sidebarPanel === "settings" ? "page" : undefined}
          >
            <Settings size={20} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  );
}
