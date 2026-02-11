import {
  type DockviewApi,
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewHeaderActionsProps,
  type IWatermarkPanelProps,
} from "dockview";
import { useCallback, useMemo } from "react";
import type { TabKind } from "../../types";
import { DockviewContextProvider, useDockviewContext } from "./DockviewContext";
import { DockviewTab } from "./DockviewTab";
import { PANEL_ADAPTERS } from "./panels";

// Shared ref object for accessing the DockviewApi from outside DockviewLayout
// This is a module-level singleton that persists across the application lifecycle
const dockviewApiRef = { current: null as DockviewApi | null };

/**
 * Internal dockview wrapper that uses context
 */
function DockviewLayoutInner(): React.JSX.Element {
  const { dockviewApi } = useDockviewContext();

  /**
   * Handle dockview ready event
   * Stores API reference in module-level ref
   */
  const handleReady = useCallback((event: DockviewReadyEvent) => {
    dockviewApiRef.current = event.api;
  }, []);

  /**
   * Watermark component shown in empty groups
   */
  const WatermarkComponent = useCallback((_props: IWatermarkPanelProps): React.JSX.Element => {
    return (
      <div className="dockview-watermark">
        <p>Drop a tab here or use the menu to open a new panel</p>
      </div>
    );
  }, []);

  /**
   * Right header actions component
   * Provides split and close actions for group headers
   */
  const RightHeaderActionsComponent = (props: IDockviewHeaderActionsProps): React.JSX.Element => {
    const { containerApi, activePanel } = props;

    const handleSplitHorizontal = () => {
      if (activePanel?.params?.tab) {
        const originalTab = activePanel.params.tab as { kind?: TabKind; title?: string };
        const tabKind = originalTab.kind || "editor";
        const newTab = { ...originalTab, id: `split-${Date.now()}` };
        containerApi.addPanel({
          id: newTab.id,
          component: tabKind,
          title: newTab.title || "New Panel",
          params: { tab: newTab },
          position: { referenceGroup: props.group, direction: "right" },
        });
      }
    };

    const handleSplitVertical = () => {
      if (activePanel?.params?.tab) {
        const originalTab = activePanel.params.tab as { kind?: TabKind; title?: string };
        const tabKind = originalTab.kind || "editor";
        const newTab = { ...originalTab, id: `split-${Date.now()}` };
        containerApi.addPanel({
          id: newTab.id,
          component: tabKind,
          title: newTab.title || "New Panel",
          params: { tab: newTab },
          position: { referenceGroup: props.group, direction: "below" },
        });
      }
    };

    const handleCloseGroup = () => {
      containerApi.removeGroup(props.group);
    };

    return (
      <div className="dockview-header-actions">
        <button
          type="button"
          className="icon-button"
          onClick={handleSplitHorizontal}
          title="Split horizontally"
          aria-label="Split horizontally"
        >
          ⬌
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={handleSplitVertical}
          title="Split vertically"
          aria-label="Split vertically"
        >
          ⬍
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={handleCloseGroup}
          title="Close group"
          aria-label="Close group"
        >
          ×
        </button>
      </div>
    );
  };

  /**
   * Components map for all TabKind types
   * Uses panel adapters that wrap the actual content components
   */
  const components = useMemo(() => PANEL_ADAPTERS, []);

  return (
    <div className="dockview-theme-side">
      <DockviewReact
        components={components}
        defaultTabComponent={DockviewTab}
        watermarkComponent={WatermarkComponent}
        rightHeaderActionsComponent={RightHeaderActionsComponent}
        onReady={handleReady}
        disableAutoResizing={false}
      />
    </div>
  );
}

/**
 * Props for DockviewLayout component
 */
export interface DockviewLayoutProps {
  /**
   * Workspace states by ID
   */
  workspaceStates: Record<string, import("../../types").WorkspaceState>;

  /**
   * Update workspace state handler
   */
  updateWorkspaceState: (id: string, state: Partial<import("../../types").WorkspaceState>) => void;

  /**
   * Decks array
   */
  decks: import("../../types").Deck[];

  /**
   * Deck states by ID
   */
  deckStates: Record<string, import("../../types").DeckState>;

  /**
   * Active deck IDs
   */
  activeDeckIds: string[];

  /**
   * Git files by workspace ID
   */
  gitFiles: Record<string, import("../../types").GitFileStatus[]>;

  /**
   * Toggle directory handler
   */
  onToggleDir: (wsId: string, node: import("../../types").FileTreeNode) => void;

  /**
   * Open file handler
   */
  onOpenFile: (wsId: string, node: import("../../types").FileTreeNode) => void;

  /**
   * Refresh tree handler
   */
  onRefreshTree: (wsId: string) => void;

  /**
   * Create file handler
   */
  onCreateFile: (wsId: string, path: string) => void;

  /**
   * Create directory handler
   */
  onCreateDirectory: (wsId: string, path: string) => void;

  /**
   * Delete file handler
   */
  onDeleteFile: (wsId: string, path: string) => void;

  /**
   * Delete directory handler
   */
  onDeleteDirectory: (wsId: string, path: string) => void;

  /**
   * Change file content handler
   */
  onChangeFile: (fileId: string, content: string) => void;

  /**
   * Save file handler
   */
  onSaveFile: (fileId: string) => void;

  /**
   * Currently saving file ID
   */
  savingFileId: string | null;

  /**
   * WebSocket base URL
   */
  wsBase: string;

  /**
   * Delete terminal handler
   */
  onDeleteTerminal: (termId: string) => void;

  /**
   * Reorder terminals handler
   */
  onReorderTerminals: (deckId: string, newOrder: import("../../types").TerminalSession[]) => void;

  /**
   * Create terminal handler
   */
  onCreateTerminal: (deckId: string, command?: string) => void;

  /**
   * Open tab handler
   */
  openTab: (tab: import("../../types").UnifiedTab) => void;

  /**
   * Optional class name for the dockview container
   */
  className?: string;

  /**
   * Optional style for the dockview container
   */
  style?: React.CSSProperties;
}

/**
 * DockviewLayout component
 *
 * This is the main wrapper for dockview that:
 * 1. Provides DockviewContext with all shared state and handlers
 * 2. Initializes DockviewReact with all TabKind components
 * 3. Provides custom tab component, watermark, and header actions
 * 4. Stores DockviewApi in a ref for external access
 * 5. Applies custom theme class "dockview-theme-side"
 *
 * The components map uses panel adapters that wrap the actual content components
 * and access shared state through DockviewContext.
 */
export function DockviewLayout(props: DockviewLayoutProps): React.JSX.Element {
  const {
    workspaceStates,
    updateWorkspaceState,
    decks,
    deckStates,
    activeDeckIds,
    gitFiles,
    onToggleDir,
    onOpenFile,
    onRefreshTree,
    onCreateFile,
    onCreateDirectory,
    onDeleteFile,
    onDeleteDirectory,
    onChangeFile,
    onSaveFile,
    savingFileId,
    wsBase,
    onDeleteTerminal,
    onReorderTerminals,
    onCreateTerminal,
    openTab,
    className = "",
    style,
  } = props;

  // Convert activeDeckIds array to record for deck panels
  const activeDeckIdsRecord = useMemo(() => {
    const record: Record<string, string> = {};
    activeDeckIds.forEach((id, index) => {
      record[id] = id;
    });
    return record;
  }, [activeDeckIds]);

  const contextValue = useMemo(
    () => ({
      workspaceStates,
      updateWorkspaceState,
      decks,
      deckStates,
      activeDeckIds: activeDeckIdsRecord,
      gitFiles,
      onToggleDir,
      onOpenFile,
      onRefreshTree,
      onCreateFile,
      onCreateDirectory,
      onDeleteFile,
      onDeleteDirectory,
      onChangeFile,
      onSaveFile,
      savingFileId,
      wsBase,
      onDeleteTerminal,
      onReorderTerminals,
      onCreateTerminal,
      openTab,
      dockviewApi: dockviewApiRef.current,
    }),
    [
      workspaceStates,
      updateWorkspaceState,
      decks,
      deckStates,
      activeDeckIdsRecord,
      gitFiles,
      onToggleDir,
      onOpenFile,
      onRefreshTree,
      onCreateFile,
      onCreateDirectory,
      onDeleteFile,
      onDeleteDirectory,
      onChangeFile,
      onSaveFile,
      savingFileId,
      wsBase,
      onDeleteTerminal,
      onReorderTerminals,
      onCreateTerminal,
      openTab,
    ]
  );

  return (
    <DockviewContextProvider value={contextValue}>
      <div className={`dockview-layout-wrapper ${className}`.trim()} style={style}>
        <DockviewLayoutInner />
      </div>
    </DockviewContextProvider>
  );
}

/**
 * Get the dockview API ref object
 * Returns a ref object with the current API instance
 * The API is available after DockviewLayout has been mounted
 *
 * This is a module-level singleton, not a React Hook
 */
export function getDockviewApiRef(): {
  current: DockviewApi | null;
} {
  return dockviewApiRef;
}
