/**
 * Dockview wrapper components for S-IDE
 *
 * This module exports the main dockview integration components:
 * - DockviewLayout: Main wrapper that initializes dockview
 * - DockviewContextProvider: Context provider for panel data
 * - useDockviewContext: Hook to access dockview context
 * - getDockviewApiRef: Function to access the dockview API singleton
 * - Panel Adapters: Components that adapt panel content to dockview
 */

export type { DockviewContextValue } from "./DockviewContext";
export {
  DockviewContextProvider,
  useDockviewContext,
} from "./DockviewContext";
export type { DockviewLayoutProps } from "./DockviewLayout";
export { DockviewLayout, getDockviewApiRef } from "./DockviewLayout";

// Panel adapters
export {
  AgentConfigLocalPanelAdapter,
  AgentConfigPanelAdapter,
  AgentPanelAdapter,
  AgentStatusPanelAdapter,
  DeckPanelAdapter,
  EditorPanelAdapter,
  getPanelAdapter,
  McpPanelAdapter,
  PANEL_ADAPTERS,
  RemoteAccessPanelAdapter,
  ServerPanelAdapter,
  ServerSettingsPanelAdapter,
  SetupPanelAdapter,
  TerminalPanelAdapter,
  WorkspacePanelAdapter,
} from "./panels";
