import { memo } from "react";
import type { UnifiedTab } from "../../types";
import { AgentPanel } from "./AgentPanel";
import { WorkspacePanel } from "./WorkspacePanel";
import { DeckPanel } from "./DeckPanel";
import { TerminalPanelContent } from "./TerminalPanelContent";
import { EditorPanelContent } from "./EditorPanelContent";

interface PanelContentProps {
  tab: UnifiedTab;
  // Workspace data
  workspaceState?: {
    tree?: import("../../types").FileTreeNode[];
    treeLoading?: boolean;
    treeError?: string | null;
  };
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
  deckState?: {
    terminals?: import("../../types").TerminalSession[];
    terminalGroups?: import("../../types").TerminalGroup[];
    isCreatingTerminal?: boolean;
  };
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

export function PanelContent({
  tab,
  workspaceState,
  gitFiles,
  onToggleDir,
  onOpenFile,
  onRefreshTree,
  onCreateFile,
  onCreateDirectory,
  onDeleteFile,
  onDeleteDirectory,
  deckState,
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
}: PanelContentProps) {
  switch (tab.kind) {
    case "agent":
      return <AgentPanel agent={tab.data.agent!} />;
    case "workspace":
      return (
        <WorkspacePanel
          workspace={tab.data.workspace!}
          tree={workspaceState?.tree}
          treeLoading={workspaceState?.treeLoading}
          treeError={workspaceState?.treeError}
          gitFiles={gitFiles}
          onToggleDir={onToggleDir ?? (() => {})}
          onOpenFile={onOpenFile ?? (() => {})}
          onRefresh={onRefreshTree ?? (() => {})}
          onCreateFile={onCreateFile}
          onCreateDirectory={onCreateDirectory}
          onDeleteFile={onDeleteFile}
          onDeleteDirectory={onDeleteDirectory}
        />
      );
    case "deck":
      return (
        <DeckPanel
          deck={tab.data.deck!}
          terminals={deckState?.terminals}
          terminalGroups={deckState?.terminalGroups}
          isCreatingTerminal={deckState?.isCreatingTerminal}
          wsBase={wsBase}
          deckId={tab.data.deck!.id}
          onDeleteTerminal={onDeleteTerminal ?? (() => {})}
          onReorderTerminals={onReorderTerminals}
          onCreateTerminal={onCreateTerminal}
          onToggleGroupCollapsed={onToggleGroupCollapsed}
          onDeleteGroup={onDeleteGroup}
          onRenameGroup={onRenameGroup}
        />
      );
    case "terminal":
      return (
        <TerminalPanelContent
          terminal={tab.data.terminal!}
          wsBase={wsBase}
          onDelete={onDeleteTerminal ? () => onDeleteTerminal(tab.data.terminal!.id) : undefined}
        />
      );
    case "editor":
      return (
        <EditorPanelContent
          file={tab.data.editor!}
          active={true}
          onChange={onChangeFile}
          onSave={onSaveFile ? () => onSaveFile(tab.data.editor!.id) : undefined}
          saving={savingFileId === tab.data.editor!.id}
        />
      );
    default:
      return <div>Unknown tab type</div>;
  }
}

export const MemoizedPanelContent = memo(PanelContent);
