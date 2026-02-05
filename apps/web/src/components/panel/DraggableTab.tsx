/**
 * Draggable Tab - Individual tab with drag and drop support
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bot,
  Box,
  Code2,
  Database,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  Hash,
  Pin,
  Server,
  Terminal,
  Type,
  X,
} from "lucide-react";
import { memo } from "react";
import type { UnifiedTab } from "../../types";

interface DraggableTabProps {
  tab: UnifiedTab;
  isActive: boolean;
  isDragging: boolean;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onContextMenu: (tab: UnifiedTab, event: React.MouseEvent) => void;
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
    case "tunnel":
      return <Globe size={14} />;
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
    case "database":
    case "sql":
      return <Database size={14} />;
    case "yaml":
      return <FileCode size={14} />;
    case "terminal":
      return <Terminal size={14} />;
    default:
      return <FileCode size={14} />;
  }
}

export function DraggableTab({
  tab,
  isActive,
  isDragging,
  onSelect,
  onClose,
  onContextMenu,
}: DraggableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: tab.id,
    disabled: tab.pinned,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isSortableDragging) return;
    // Middle click to close
    if (e.button === 1) {
      e.preventDefault();
      onClose(tab.id);
      return;
    }
    onSelect(tab.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(tab, e);
  };

  const icon = getTabIcon(tab);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`panel-tab ${isActive ? "active" : ""} ${tab.dirty ? "dirty" : ""} ${tab.pinned ? "pinned" : ""}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      {...attributes}
      {...listeners}
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
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        aria-label="Close"
        title="Close"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export const MemoizedDraggableTab = memo(DraggableTab);
