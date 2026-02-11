/**
 * Dockview wrapper components for S-IDE
 *
 * This module exports the main dockview integration components:
 * - DockviewLayout: Main wrapper that initializes dockview
 * - DockviewContextProvider: Context provider for panel data
 * - useDockviewContext: Hook to access dockview context
 * - getDockviewApiRef: Function to access the dockview API singleton
 */

export { DockviewLayout, getDockviewApiRef } from "./DockviewLayout";
export type { DockviewLayoutProps } from "./DockviewLayout";

export {
  DockviewContextProvider,
  useDockviewContext,
} from "./DockviewContext";
export type { DockviewContextValue } from "./DockviewContext";
