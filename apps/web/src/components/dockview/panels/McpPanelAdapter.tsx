import type { IDockviewPanelProps } from "dockview";
import { McpPanelContent } from "../../panel/McpPanelContent";

/**
 * Adapter for MCP panel in dockview
 * Wraps McpPanelContent (no context needed - self-contained)
 */
export function McpPanelAdapter(
  _props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  return <McpPanelContent />;
}
