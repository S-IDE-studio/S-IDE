import type { IDockviewPanelProps } from "dockview";
import { WorkspacePanel } from "../../panel/WorkspacePanel";
import { useDockviewContext } from "../DockviewContext";

/**
 * Adapter for Workspace panel in dockview
 * Wraps WorkspacePanel with dockview context and params
 */
export function WorkspacePanelAdapter(
  props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  const ctx = useDockviewContext();
  const tab = props.params.tab;

  if (!tab.data.workspace) {
    return <div className="panel-error">Missing workspace data</div>;
  }

  const wsId = tab.data.workspace.id;
  const wsState = ctx.workspaceStates[wsId];

  return (
    <WorkspacePanel
      workspace={tab.data.workspace}
      tree={wsState?.tree}
      treeLoading={wsState?.treeLoading}
      treeError={wsState?.treeError}
      gitFiles={ctx.gitFiles[wsId]}
      onToggleDir={(node) => ctx.onToggleDir(wsId, node)}
      onOpenFile={(node) => ctx.onOpenFile(wsId, node)}
      onRefresh={() => ctx.onRefreshTree(wsId)}
      onCreateFile={(path) => ctx.onCreateFile(wsId, path)}
      onCreateDirectory={(path) => ctx.onCreateDirectory(wsId, path)}
      onDeleteFile={(path) => ctx.onDeleteFile(wsId, path)}
      onDeleteDirectory={(path) => ctx.onDeleteDirectory(wsId, path)}
    />
  );
}
