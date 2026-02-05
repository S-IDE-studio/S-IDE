import { memo, useCallback } from "react";
import type { PanelGroup, PanelLayout } from "../../types";
import { createEmptyPanelGroup } from "../../utils/unifiedTabUtils";
import { MemoizedUnifiedPanelContainer } from "./UnifiedPanelContainer";

interface UnifiedPanelViewProps {
  groups: PanelGroup[];
  layout: PanelLayout;
  onSelectTab: (groupId: string, tabId: string) => void;
  onCloseTab: (groupId: string, tabId: string) => void;
  onFocusGroup: (groupId: string) => void;
  // Workspace data
  workspaceStates?: Record<string, {
    tree?: import("../../types").FileTreeNode[];
    treeLoading?: boolean;
    treeError?: string | null;
  }>;
  gitFiles?: import("../../types").GitFileStatus[];
  // Workspace handlers
  onToggleDir?: (node: import("../../types").FileTreeNode) => void;
  onOpenFile?: (node: import("../../types").FileTreeNode) => void;
  onRefreshTree?: () => void;
  onCreateFile?: (parentPath: string, fileName: string) => void;
  onCreateDirectory?: (parentPath: string, dirName: string) => void;
  onDeleteFile?: (filePath: string) => void;
  onDeleteDirectory?: (dirPath: string) => void;
  // Deck/Terminal data
  deckStates?: Record<string, {
    terminals?: import("../../types").TerminalSession[];
    terminalGroups?: import("../../types").TerminalGroup[];
    isCreatingTerminal?: boolean;
  }>;
  wsBase?: string;
  // Deck/Terminal handlers
  onDeleteTerminal?: (terminalId: string) => void;
  onReorderTerminals?: (deckId: string, newOrder: import("../../types").TerminalSession[]) => void;
  onCreateTerminal?: () => void;
  onToggleGroupCollapsed?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onRenameGroup?: (groupId: string) => void;
  // Editor handlers
  onChangeFile?: (fileId: string, contents: string) => void;
  onSaveFile?: (fileId: string) => void;
  savingFileId?: string | null;
}

export function UnifiedPanelView({
  groups,
  layout,
  onSelectTab,
  onCloseTab,
  onFocusGroup,
  workspaceStates,
  gitFiles,
  onToggleDir,
  onOpenFile,
  onRefreshTree,
  onCreateFile,
  onCreateDirectory,
  onDeleteFile,
  onDeleteDirectory,
  deckStates,
  wsBase,
  onDeleteTerminal,
  onReorderTerminals,
  onCreateTerminal,
  onToggleGroupCollapsed,
  onDeleteGroup,
  onRenameGroup,
  onChangeFile,
  onSaveFile,
  savingFileId,
}: UnifiedPanelViewProps) {
  const focusedGroupId = groups.find((g) => g.focused)?.id ?? groups[0]?.id;

  // Wrap callbacks with groupId
  const createSelectHandler = useCallback((groupId: string) => (tabId: string) => {
    onSelectTab(groupId, tabId);
  }, [onSelectTab]);

  const createCloseHandler = useCallback((groupId: string) => (tabId: string) => {
    onCloseTab(groupId, tabId);
  }, [onCloseTab]);

  const createFocusHandler = useCallback((groupId: string) => () => {
    onFocusGroup(groupId);
  }, [onFocusGroup]);

  // Single group
  if (layout.direction === "single" || groups.length === 1) {
    const group = groups[0];
    if (!group) {
      return (
        <div className="panel-view-empty">
          <p>パネルを追加してください</p>
        </div>
      );
    }

    return (
      <MemoizedUnifiedPanelContainer
        key={group.id}
        group={group}
        isFocused={group.id === focusedGroupId}
        onSelectTab={createSelectHandler(group.id)}
        onCloseTab={createCloseHandler(group.id)}
        onFocus={createFocusHandler(group.id)}
        workspaceStates={workspaceStates}
        gitFiles={gitFiles}
        onToggleDir={onToggleDir}
        onOpenFile={onOpenFile}
        onRefreshTree={onRefreshTree}
        onCreateFile={onCreateFile}
        onCreateDirectory={onCreateDirectory}
        onDeleteFile={onDeleteFile}
        onDeleteDirectory={onDeleteDirectory}
        deckStates={deckStates}
        wsBase={wsBase}
        onDeleteTerminal={onDeleteTerminal}
        onReorderTerminals={onReorderTerminals}
        onCreateTerminal={onCreateTerminal}
        onToggleGroupCollapsed={onToggleGroupCollapsed}
        onDeleteGroup={onDeleteGroup}
        onRenameGroup={onRenameGroup}
        onChangeFile={onChangeFile}
        onSaveFile={onSaveFile}
        savingFileId={savingFileId}
      />
    );
  }

  // Multiple groups
  return (
    <div className={`panel-groups panel-groups-${layout.direction}`}>
      {groups.map((group) => (
        <MemoizedUnifiedPanelContainer
          key={group.id}
          group={group}
          isFocused={group.id === focusedGroupId}
          onSelectTab={createSelectHandler(group.id)}
          onCloseTab={createCloseHandler(group.id)}
          onFocus={createFocusHandler(group.id)}
          workspaceStates={workspaceStates}
          gitFiles={gitFiles}
          onToggleDir={onToggleDir}
          onOpenFile={onOpenFile}
          onRefreshTree={onRefreshTree}
          onCreateFile={onCreateFile}
          onCreateDirectory={onCreateDirectory}
          onDeleteFile={onDeleteFile}
          onDeleteDirectory={onDeleteDirectory}
          deckStates={deckStates}
          wsBase={wsBase}
          onDeleteTerminal={onDeleteTerminal}
          onReorderTerminals={onReorderTerminals}
          onCreateTerminal={onCreateTerminal}
          onToggleGroupCollapsed={onToggleGroupCollapsed}
          onDeleteGroup={onDeleteGroup}
          onRenameGroup={onRenameGroup}
          onChangeFile={onChangeFile}
          onSaveFile={onSaveFile}
          savingFileId={savingFileId}
        />
      ))}
    </div>
  );
}

export const MemoizedUnifiedPanelView = memo(UnifiedPanelView);
