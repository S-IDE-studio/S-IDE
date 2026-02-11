import type { IDockviewPanelProps } from "dockview";
import { RemoteAccessPanelContent } from "../../panel/RemoteAccessPanelContent";

/**
 * Adapter for Remote Access panel in dockview
 * Wraps RemoteAccessPanelContent (no context needed - self-contained)
 */
export function RemoteAccessPanelAdapter(
  _props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  return <RemoteAccessPanelContent />;
}
