import type { IDockviewPanelProps } from "dockview";
import { AgentPanel } from "../../panel/AgentPanel";
import { useDockviewContext } from "../DockviewContext";

/**
 * Adapter for Agent panel in dockview
 * Wraps AgentPanel with dockview context and params
 */
export function AgentPanelAdapter(
  props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  const ctx = useDockviewContext();
  const tab = props.params.tab;

  if (!tab.data.agent) {
    return <div className="panel-error">Missing agent data</div>;
  }

  return <AgentPanel agent={tab.data.agent} />;
}
