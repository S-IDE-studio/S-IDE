import type { IDockviewPanelProps } from "dockview";
import { AgentConfigPanelContent } from "../../panel/AgentConfigPanelContent";

/**
 * Adapter for Agent Config panel (Global) in dockview
 * Wraps AgentConfigPanelContent (no context needed - self-contained)
 */
export function AgentConfigPanelAdapter(
  _props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  return <AgentConfigPanelContent />;
}
