import { memo } from "react";
import type { FileTreeNode, GitFileStatus } from "../../types";
import { FileTree } from "../FileTree";

interface WorkspacePanelProps {
  workspace: { id: string; path: string; name: string };
  // FileTree props
  tree?: FileTreeNode[];
  treeLoading?: boolean;
  treeError?: string | null;
  gitFiles?: GitFileStatus[];
  onToggleDir: (node: FileTreeNode) => void;
  onOpenFile: (node: FileTreeNode) => void;
  onRefresh: () => void;
  onCreateFile?: (parentPath: string, fileName: string) => void;
  onCreateDirectory?: (parentPath: string, dirName: string) => void;
  onDeleteFile?: (filePath: string) => void;
  onDeleteDirectory?: (dirPath: string) => void;
}

export function WorkspacePanel({
  workspace,
  tree,
  treeLoading,
  treeError,
  gitFiles,
  onToggleDir,
  onOpenFile,
  onRefresh,
  onCreateFile,
  onCreateDirectory,
  onDeleteFile,
  onDeleteDirectory,
}: WorkspacePanelProps) {
  return (
    <div className="workspace-panel-content">
      <FileTree
        root={workspace.path}
        entries={tree}
        loading={treeLoading}
        error={treeError}
        onToggleDir={onToggleDir}
        onOpenFile={onOpenFile}
        onRefresh={onRefresh}
        onCreateFile={onCreateFile}
        onCreateDirectory={onCreateDirectory}
        onDeleteFile={onDeleteFile}
        onDeleteDirectory={onDeleteDirectory}
        gitFiles={gitFiles}
      />
    </div>
  );
}

export const MemoizedWorkspacePanel = memo(WorkspacePanel);
