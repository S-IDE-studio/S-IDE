import { memo } from "react";
import type { UnifiedTab } from "../../types";
import { AgentConfigLocalPanelContent } from "./AgentConfigLocalPanelContent";
import { AgentConfigPanelContent } from "./AgentConfigPanelContent";
import { AgentPanel } from "./AgentPanel";
import { AgentStatusPanelContent } from "./AgentStatusPanelContent";
import { DeckPanel } from "./DeckPanel";
import { EditorPanelContent } from "./EditorPanelContent";
import { McpPanelContent } from "./McpPanelContent";
import { ServerPanelContent } from "./ServerPanelContent";
import { ServerSettingsPanelContent } from "./ServerSettingsPanelContent";
import { SetupPanelContent } from "./SetupPanelContent";
import { TerminalPanelContent } from "./TerminalPanelContent";
import { TunnelPanelContent } from "./TunnelPanelContent";
import { WorkspacePanel } from "./WorkspacePanel";

interface PanelContentProps {
  tab: UnifiedTab;
  // Workspace data
  workspaceState?: {
    tree?: import("../../types").FileTreeNode[];
    treeLoading?: boolean;
    treeError?: string | null;
    files?: import("../../types").EditorFile[];
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
  // Workspace state updater
  updateWorkspaceState?: (
    workspaceId: string,
    updater: (state: import("../../types").WorkspaceState) => import("../../types").WorkspaceState
  ) => void;
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
  // Editor state
  activeFileId?: string | null;
  onSelectFile?: (fileId: string) => void;
  onCloseFile?: (fileId: string) => void;
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
  updateWorkspaceState,
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
  activeFileId,
  onSelectFile,
  onCloseFile,
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
          updateWorkspaceState={updateWorkspaceState}
          // FileTree props
          tree={workspaceState?.tree}
          treeLoading={workspaceState?.treeLoading}
          treeError={workspaceState?.treeError}
          gitFiles={gitFiles}
          onToggleDir={onToggleDir}
          onOpenFile={onOpenFile}
          onRefreshTree={onRefreshTree}
          onCreateFile={onCreateFile}
          onCreateDirectory={onCreateDirectory}
          onDeleteFile={onDeleteFile}
          onDeleteDirectory={onDeleteDirectory}
          // Editor props
          editorFiles={workspaceState?.files}
          activeFileId={activeFileId}
          onSelectFile={onSelectFile}
          onCloseFile={onCloseFile}
          onChangeFile={onChangeFile}
          onSaveFile={onSaveFile}
          savingFileId={savingFileId}
          // Terminal props
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
    case "server":
      return <ServerPanelContent />;
    case "mcp":
      return <McpPanelContent />;
    case "tunnel":
      return <TunnelPanelContent />;
    case "serverSettings":
      return <ServerSettingsPanelContent />;
    case "agentStatus":
      return <AgentStatusPanelContent />;
    case "agentConfig":
      return <AgentConfigPanelContent />;
    case "agentConfigLocal":
      return (
        <AgentConfigLocalPanelContent workspaceId={tab.data.agentConfigLocal?.workspaceId || ""} />
      );
    case "setup":
      return <SetupPanelContent />;
    default:
      return <div>Unknown tab type</div>;
  }
}

export const MemoizedPanelContent = memo(PanelContent);
