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

export const PANEL_ADAPTERS: Record<TabKind, React.ComponentType<any>> = {
  agent: AgentPanelAdapter,
  workspace: WorkspacePanelAdapter,
  deck: DeckPanelAdapter,
  terminal: TerminalPanelAdapter,
  editor: EditorPanelAdapter,
  server: ServerPanelAdapter,
  mcp: McpPanelAdapter,
  remoteAccess: RemoteAccessPanelAdapter,
  tunnel: RemoteAccessPanelAdapter, // Legacy: mapped to remoteAccess
  serverSettings: ServerSettingsPanelAdapter,
  agentStatus: AgentStatusPanelAdapter,
  agentConfig: AgentConfigPanelAdapter,
  agentConfigLocal: AgentConfigLocalPanelAdapter,
  setup: SetupPanelAdapter,
};

/**
 * Get adapter component for a given TabKind
 */
export function getPanelAdapter(kind: TabKind): React.ComponentType<any> {
  return PANEL_ADAPTERS[kind];
}
