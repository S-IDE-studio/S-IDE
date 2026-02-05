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
  return (
    prevProps.files === nextProps.files &&
    prevProps.activeFileId === nextProps.activeFileId &&
    prevProps.savingFileId === nextProps.savingFileId &&
    prevProps.editorGroups === nextProps.editorGroups &&
    prevProps.groupLayout === nextProps.groupLayout
  );
};

export const MemoizedEditorPane = memo(EditorPane, areEqual);
