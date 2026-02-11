import type { IDockviewPanelProps } from "dockview";
import { ServerSettingsPanelContent } from "../../panel/ServerSettingsPanelContent";

/**
 * Adapter for Server Settings panel in dockview
 * Wraps ServerSettingsPanelContent (no context needed - self-contained)
 */
export function ServerSettingsPanelAdapter(
  _props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  return <ServerSettingsPanelContent />;
}
