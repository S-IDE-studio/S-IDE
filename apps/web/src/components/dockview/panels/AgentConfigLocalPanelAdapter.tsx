import type { Workspace } from "@side-ide/shared/types";
import type { IDockviewPanelProps } from "dockview";
import { AgentConfigLocalPanelContent } from "../../panel/AgentConfigLocalPanelContent";
import { useDockviewContext } from "../DockviewContext";

/**
 * Adapter for Agent Config Local panel (Workspace-specific) in dockview
 * Wraps AgentConfigLocalPanelContent with dockview context and params
 */
export function AgentConfigLocalPanelAdapter(
  props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  const ctx = useDockviewContext();
  const tab = props.params.tab;

  if (!tab.data.agentConfigLocal) {
    return <div className="panel-error">Missing agent config local data</div>;
  }

  // Extract workspaces from deck's workspaceId
  // Note: AgentConfigLocalPanelContent expects workspaces prop, but we can pass minimal data
  const workspaces: Workspace[] = ctx.decks
    .filter((deck) => deck.workspaceId)
    .map((deck) => ({
      id: deck.workspaceId,
      name: deck.workspaceId, // Use workspaceId as fallback name
      path: deck.root,
      createdAt: deck.createdAt,
    }));

  return (
    <AgentConfigLocalPanelContent
      workspaceId={tab.data.agentConfigLocal.workspaceId}
      workspaces={workspaces}
    />
  );
}
