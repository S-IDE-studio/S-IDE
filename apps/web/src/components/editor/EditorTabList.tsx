import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2, X } from "lucide-react";
import { memo, useCallback } from "react";
import type { EditorFile } from "../../types";

interface EditorTabListProps {
  tabs: EditorFile[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  savingFileId: string | null;
  onTabsReorder: (tabs: EditorFile[]) => void;
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

// Sortable Tab Component
interface SortableTabProps {
  file: EditorFile;
  isActive: boolean;
  isSaving: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
}

function SortableTab({ file, isActive, isSaving, onSelect, onClose }: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: file.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { icon, color } = getFileIcon(file.name);

  // Exclude 'role' and 'tabIndex' from dnd-kit attributes to use our own
  const { role, tabIndex, ...dndAttributes } = attributes;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`editor-tab ${isActive ? "active" : ""} ${file.dirty ? "dirty" : ""}`}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      onClick={onSelect}
      onMouseDown={(e) => {
        // Middle click to close
        if (e.button === 1) {
          e.preventDefault();
          onClose(e);
        }
      }}
      {...dndAttributes}
      {...listeners}
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
        onClick={(e) => {
          e.stopPropagation();
          onClose(e);
        }}
        aria-label="閉じる"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function EditorTabList({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  savingFileId,
  onTabsReorder,
}: EditorTabListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = tabs.findIndex((tab) => tab.id === active.id);
        const newIndex = tabs.findIndex((tab) => tab.id === over.id);

        const newTabs = [...tabs];
        const [removed] = newTabs.splice(oldIndex, 1);
        newTabs.splice(newIndex, 0, removed);

        onTabsReorder(newTabs);
      }
    },
    [tabs, onTabsReorder]
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="editor-tabs">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={rectSortingStrategy}>
          <div className="editor-tabs-list" role="tablist">
            {tabs.map((file) => {
              const isActive = file.id === activeTabId;
              const isSaving = savingFileId === file.id;

              return (
                <SortableTab
                  key={file.id}
                  file={file}
                  isActive={isActive}
                  isSaving={isSaving}
                  onSelect={() => onTabSelect(file.id)}
                  onClose={(e) => {
                    e.stopPropagation();
                    onTabClose(file.id);
                  }}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export const MemoizedEditorTabList = memo(EditorTabList);
