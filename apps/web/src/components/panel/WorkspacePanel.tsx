interface WorkspacePanelProps {
  workspace: { id: string; path: string; name: string };
}

export function WorkspacePanel({ workspace }: WorkspacePanelProps) {
  return <div className="workspace-panel-content">Workspace: {workspace.path}</div>;
}
