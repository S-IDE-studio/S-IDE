import { X, Loader2 } from "lucide-react";
import { memo, useCallback } from "react";
import type { EditorFile } from "../../types";

interface EditorTabListProps {
  tabs: EditorFile[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  savingFileId: string | null;
  isDraggable?: boolean; // Will be enabled in later task
}

// File extension to icon mapping (same as EditorPane)
function getFileIcon(filename: string): { icon: string; color: string } {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, { icon: string; color: string }> = {
    ts: { icon: "TS", color: "#3178c6" },
    tsx: { icon: "TSX", color: "#3178c6" },
    js: { icon: "JS", color: "#f7df1e" },
    jsx: { icon: "JSX", color: "#61dafb" },
    json: { icon: "{ }", color: "#cbcb41" },
    html: { icon: "<>", color: "#e34c26" },
    css: { icon: "#", color: "#264de4" },
    scss: { icon: "S", color: "#cc6699" },
    md: { icon: "M↓", color: "#083fa1" },
    py: { icon: "PY", color: "#3776ab" },
    go: { icon: "GO", color: "#00add8" },
    rs: { icon: "RS", color: "#dea584" },
    java: { icon: "J", color: "#b07219" },
    sql: { icon: "SQL", color: "#e38c00" },
    yml: { icon: "Y", color: "#cb171e" },
    yaml: { icon: "Y", color: "#cb171e" },
    sh: { icon: "$", color: "#89e051" },
    bash: { icon: "$", color: "#89e051" },
    txt: { icon: "TXT", color: "#6a737d" },
  };
  return iconMap[ext] || { icon: "📄", color: "var(--ink-muted)" };
}

export function EditorTabList({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  savingFileId,
  isDraggable = false,
}: EditorTabListProps) {
  const handleCloseTab = useCallback(
    (e: React.MouseEvent, fileId: string) => {
      e.stopPropagation();
      onTabClose(fileId);
    },
    [onTabClose]
  );

  const handleTabMiddleClick = useCallback(
    (e: React.MouseEvent, fileId: string) => {
      if (e.button === 1) {
        e.preventDefault();
        onTabClose(fileId);
      }
    },
    [onTabClose]
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="editor-tabs">
      <div className="editor-tabs-list" role="tablist">
        {tabs.map((file) => {
          const { icon, color } = getFileIcon(file.name);
          const isActive = file.id === activeTabId;
          const isSaving = savingFileId === file.id;

          return (
            <div
              key={file.id}
              className={`editor-tab ${isActive ? "active" : ""} ${file.dirty ? "dirty" : ""}`}
              onClick={() => onTabSelect(file.id)}
              onMouseDown={(e) => handleTabMiddleClick(e, file.id)}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
            >
              <span className="editor-tab-icon" style={{ color }}>
                {icon}
              </span>
              <span className="editor-tab-name">{file.name}</span>
              {file.dirty && !isSaving && (
                <span className="editor-tab-dirty" aria-label="未保存">
                  ●
                </span>
              )}
              {isSaving && (
                <span className="editor-tab-saving" aria-label="保存中">
                  <Loader2 size={14} className="spin" />
                </span>
              )}
              <button
                type="button"
                className="editor-tab-close"
                onClick={(e) => handleCloseTab(e, file.id)}
                aria-label="閉じる"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const MemoizedEditorTabList = memo(EditorTabList);
