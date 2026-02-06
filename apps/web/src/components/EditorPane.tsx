import { memo, useCallback } from "react";
import type { EditorFile, EditorGroup, GroupLayout } from "../types";
import { createSingleGroupLayout } from "../utils/editorGroupUtils";
import { MemoizedEditorGroupContainer } from "./editor/EditorGroupContainer";

interface EditorPaneProps {
  // Existing props for backward compatibility
  files: EditorFile[];
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
  onChangeFile: (fileId: string, contents: string) => void;
  onSaveFile?: (fileId: string) => void;
  savingFileId: string | null;

  // New props for group management
  editorGroups?: EditorGroup[];
  groupLayout?: GroupLayout;
  onSplitGroup?: (groupId: string, direction: "horizontal" | "vertical") => void;
  onCloseGroup?: (groupId: string) => void;
  onFocusGroup?: (groupId: string) => void;
  onResizeGroups?: (sizes: number[]) => void;
  onMoveTabToGroup?: (tabId: string, fromGroupId: string, toGroupId: string) => void;
  onReorderTabsInGroup?: (groupId: string, tabs: EditorFile[]) => void;
}

export function EditorPane({
  files,
  activeFileId,
  onSelectFile,
  onCloseFile,
  onChangeFile,
  onSaveFile,
  savingFileId,
  // New props (optional)
  editorGroups,
  groupLayout,
  onSplitGroup,
  onCloseGroup,
  onFocusGroup,
  onResizeGroups,
  onMoveTabToGroup,
  onReorderTabsInGroup,
}: EditorPaneProps) {
  // Backward compatibility: create single group layout if group info not provided
  const groups = editorGroups ?? createSingleGroupLayout(files).groups;
  const layout = groupLayout ?? { direction: "single" as const, sizes: [100] };
  const focusedGroupId = groups.find((g) => g.focused)?.id ?? groups[0]?.id;

  // Convert existing API to group-based API
  const handleSelectTab = useCallback(
    (tabId: string) => {
      onSelectFile(tabId);
    },
    [onSelectFile]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      onCloseFile(tabId);
    },
    [onCloseFile]
  );

  const handleChangeTab = useCallback(
    (tabId: string, contents: string) => {
      onChangeFile(tabId, contents);
    },
    [onChangeFile]
  );

  const handleSaveTab = useCallback(
    (tabId: string) => {
      onSaveFile?.(tabId);
    },
    [onSaveFile]
  );

  const handleFocusGroup = useCallback(
    (groupId: string) => {
      onFocusGroup?.(groupId);
    },
    [onFocusGroup]
  );

  // Create focus handler for specific group (for EditorGroupContainer)
  const createFocusHandler = useCallback(
    (groupId: string) => () => {
      handleFocusGroup(groupId);
    },
    [handleFocusGroup]
  );

  // Create tabs reorder handler for specific group
  const createReorderHandler = useCallback(
    (groupId: string) => (tabs: EditorFile[]) => {
      onReorderTabsInGroup?.(groupId, tabs);
    },
    [onReorderTabsInGroup]
  );

  // Single group layout (same as existing UI)
  if (layout.direction === "single" || groups.length === 1) {
    const group = groups[0];
    if (!group) {
      return (
        <div className="editor-container editor-empty">
          <div className="editor-welcome">
            <div className="editor-welcome-text">ファイルを選択してください</div>
          </div>
        </div>
      );
    }

    return (
      <MemoizedEditorGroupContainer
        key={group.id}
        group={group}
        isFocused={group.id === focusedGroupId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onChangeTab={handleChangeTab}
        onSaveTab={handleSaveTab}
        savingTabId={savingFileId}
        onFocus={createFocusHandler(group.id)}
        onTabsReorder={createReorderHandler(group.id)}
        onSplitGroup={onSplitGroup}
        groupId={group.id}
      />
    );
  }

  // Multiple group layout (TODO: implement in phase 5)
  return (
    <div className="editor-groups-container">
      {groups.map((group) => (
        <MemoizedEditorGroupContainer
          key={group.id}
          group={group}
          isFocused={group.id === focusedGroupId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onChangeTab={handleChangeTab}
          onSaveTab={handleSaveTab}
          savingTabId={savingFileId}
          onFocus={createFocusHandler(group.id)}
          onTabsReorder={createReorderHandler(group.id)}
          onSplitGroup={onSplitGroup}
          groupId={group.id}
        />
      ))}
    </div>
  );
}

// Memoize for performance
const areEqual = (prevProps: EditorPaneProps, nextProps: EditorPaneProps): boolean => {
  // Compare active file ID
  if (prevProps.activeFileId !== nextProps.activeFileId) return false;
  if (prevProps.savingFileId !== nextProps.savingFileId) return false;

  // Compare files by length and active file contents
  const prevFiles = prevProps.files;
  const nextFiles = nextProps.files;
  if (prevFiles.length !== nextFiles.length) return false;

  // Find active files and compare contents
  const prevActiveFile = prevFiles.find((f) => f.id === prevProps.activeFileId);
  const nextActiveFile = nextFiles.find((f) => f.id === nextProps.activeFileId);

  if (prevActiveFile?.contents !== nextActiveFile?.contents) return false;
  if (prevActiveFile?.dirty !== nextActiveFile?.dirty) return false;

  // Compare groups if provided
  if (prevProps.editorGroups !== nextProps.editorGroups) {
    if (prevProps.editorGroups?.length !== nextProps.editorGroups?.length) return false;
    // Compare group structure (simplified)
    if (prevProps.editorGroups && nextProps.editorGroups) {
      for (let i = 0; i < prevProps.editorGroups.length; i++) {
        if (prevProps.editorGroups[i].id !== nextProps.editorGroups[i].id) return false;
        if (prevProps.editorGroups[i].activeTabId !== nextProps.editorGroups[i].activeTabId)
          return false;
      }
    }
  }

  // Compare layout if provided
  if (prevProps.groupLayout?.direction !== nextProps.groupLayout?.direction) return false;
  if (prevProps.groupLayout?.sizes !== nextProps.groupLayout?.sizes) {
    const prevSizes = prevProps.groupLayout?.sizes;
    const nextSizes = nextProps.groupLayout?.sizes;
    if (prevSizes?.length !== nextSizes?.length) return false;
    if (prevSizes && nextSizes) {
      for (let i = 0; i < prevSizes.length; i++) {
        if (prevSizes[i] !== nextSizes[i]) return false;
      }
    }
  }

  return true;
};

export const MemoizedEditorPane = memo(EditorPane, areEqual);
