import type { IDockviewPanelProps } from "dockview";
import { TerminalPanelContent } from "../../panel/TerminalPanelContent";
import { useDockviewContext } from "../DockviewContext";

/**
 * Adapter for Terminal panel in dockview
 * IMPORTANT: Uses renderer: 'always' to keep xterm.js DOM persistent
 */
export function TerminalPanelAdapter(
  props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  const ctx = useDockviewContext();
  const tab = props.params.tab;

  if (!tab.data.terminal) {
    return <div className="panel-error">Missing terminal data</div>;
  }

  return (
    <TerminalPanelContent
      terminal={tab.data.terminal}
      wsBase={ctx.wsBase}
      onDelete={() => ctx.onDeleteTerminal(tab.data.terminal!.id)}
    />
  );
}
