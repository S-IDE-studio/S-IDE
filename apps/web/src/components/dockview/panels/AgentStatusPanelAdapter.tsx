import type { IDockviewPanelProps } from "dockview";
import { AgentStatusPanelContent } from "../../panel/AgentStatusPanelContent";

/**
 * Adapter for Agent Status panel in dockview
 * Wraps AgentStatusPanelContent (no context needed - self-contained)
 */
export function AgentStatusPanelAdapter(
  _props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  return <AgentStatusPanelContent />;
}
