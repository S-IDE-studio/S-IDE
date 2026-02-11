/**
 * Panel adapters for dockview integration
 *
 * Each adapter wraps a panel content component and provides:
 * - IDockviewPanelProps compatibility
 * - DockviewContext access for shared state and handlers
 * - Proper prop mapping from tab.data to component props
 *
 * IMPORTANT: Terminal panels must use renderer: 'always' to keep xterm.js DOM persistent
 */

export { AgentConfigLocalPanelAdapter } from "./AgentConfigLocalPanelAdapter";
export { AgentConfigPanelAdapter } from "./AgentConfigPanelAdapter";
export { AgentPanelAdapter } from "./AgentPanelAdapter";
export { AgentStatusPanelAdapter } from "./AgentStatusPanelAdapter";
export { DeckPanelAdapter } from "./DeckPanelAdapter";
export { EditorPanelAdapter } from "./EditorPanelAdapter";
export { McpPanelAdapter } from "./McpPanelAdapter";
export { RemoteAccessPanelAdapter } from "./RemoteAccessPanelAdapter";
export { ServerPanelAdapter } from "./ServerPanelAdapter";
export { ServerSettingsPanelAdapter } from "./ServerSettingsPanelAdapter";
export { SetupPanelAdapter } from "./SetupPanelAdapter";
export { TerminalPanelAdapter } from "./TerminalPanelAdapter";
export { WorkspacePanelAdapter } from "./WorkspacePanelAdapter";

import type { TabKind } from "../../../types";
import { AgentConfigLocalPanelAdapter } from "./AgentConfigLocalPanelAdapter";
import { AgentConfigPanelAdapter } from "./AgentConfigPanelAdapter";
/**
 * Map of TabKind to its corresponding adapter component
 * Used for dynamic panel component selection
 */
import { AgentPanelAdapter } from "./AgentPanelAdapter";
import { AgentStatusPanelAdapter } from "./AgentStatusPanelAdapter";
import { DeckPanelAdapter } from "./DeckPanelAdapter";
import { EditorPanelAdapter } from "./EditorPanelAdapter";
import { McpPanelAdapter } from "./McpPanelAdapter";
import { RemoteAccessPanelAdapter } from "./RemoteAccessPanelAdapter";
import { ServerPanelAdapter } from "./ServerPanelAdapter";
import { ServerSettingsPanelAdapter } from "./ServerSettingsPanelAdapter";
import { SetupPanelAdapter } from "./SetupPanelAdapter";
import { TerminalPanelAdapter } from "./TerminalPanelAdapter";
import { WorkspacePanelAdapter } from "./WorkspacePanelAdapter";
import type { IDockviewPanelProps } from "dockview";

export const PANEL_ADAPTERS: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  agent: AgentPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  workspace: WorkspacePanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  deck: DeckPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  terminal: TerminalPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  editor: EditorPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  server: ServerPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  mcp: McpPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  remoteAccess: RemoteAccessPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  tunnel: RemoteAccessPanelAdapter as React.FunctionComponent<IDockviewPanelProps>, // Legacy: mapped to remoteAccess
  serverSettings: ServerSettingsPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  agentStatus: AgentStatusPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  agentConfig: AgentConfigPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  agentConfigLocal: AgentConfigLocalPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
  setup: SetupPanelAdapter as React.FunctionComponent<IDockviewPanelProps>,
};

/**
 * Get adapter component for a given TabKind
 */
export function getPanelAdapter(kind: TabKind): React.ComponentType<any> {
  return PANEL_ADAPTERS[kind];
}
