import type { IDockviewPanelProps } from "dockview";
import { SetupPanelContent } from "../../panel/SetupPanelContent";

/**
 * Adapter for Setup panel in dockview
 * Wraps SetupPanelContent (no context needed - self-contained)
 */
export function SetupPanelAdapter(
  _props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  return <SetupPanelContent />;
}
