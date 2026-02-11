import { useCallback } from "react";
import {
  DockviewReact,
  DockviewReadyEvent,
  DockviewApi,
  IDockviewPanelProps,
  IDockviewPanelHeaderProps,
  IDockviewHeaderActionsProps,
  IWatermarkPanelProps,
} from "dockview";
import type { TabKind, UnifiedTab } from "../../types";

// Shared ref object for accessing the DockviewApi from outside DockviewLayout
// This is a module-level singleton that persists across the application lifecycle
const dockviewApiRef = { current: null as DockviewApi | null };

// Placeholder panel components - will be replaced by adapters in Task 3
// These are stub components that will be implemented in Task 3
const PlaceholderPanel = (props: IDockviewPanelProps) => {
  const tab = (props.params as { tab?: UnifiedTab })?.tab;
  if (!tab) {
    return (
      <div className="dockview-placeholder-panel">
        <p>Panel: No tab data</p>
      </div>
    );
  }
  return (
    <div className="dockview-placeholder-panel">
      <p>Panel: {tab.kind}</p>
      <p>Title: {tab.title}</p>
    </div>
  );
};

/**
 * Custom tab component
 * Displays tab icon, title, dirty indicator, and close button
 * Will be enhanced in Task 4 with full styling and context menu
 */
const DockviewTab = (props: IDockviewPanelHeaderProps<{ tab: UnifiedTab }>) => {
  const { api, params } = props;
  const tab = params.tab;

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      api.close();
    },
    [api]
  );

  return (
    <div
      className={`dockview-tab ${tab.dirty ? "dirty" : ""} ${tab.pinned ? "pinned" : ""}`}
    >
      {/* Tab icon - will be enhanced in Task 4 */}
      {tab.icon && <span className="tab-icon">{tab.icon}</span>}
      <span className="tab-title">{tab.title}</span>
      {tab.dirty && <span className="dirty-indicator">●</span>}
      <button
        type="button"
        className="tab-close"
        onClick={handleClose}
        aria-label="Close tab"
      >
        ×
      </button>
    </div>
  );
};

/**
 * Watermark component shown in empty groups
 */
const WatermarkComponent = (
  _props: IWatermarkPanelProps
): React.JSX.Element => {
  return (
    <div className="dockview-watermark">
      <p>Drop a tab here or use the menu to open a new panel</p>
    </div>
  );
};

/**
 * Right header actions component
 * Provides split and close actions for group headers
 */
const RightHeaderActionsComponent = (
  props: IDockviewHeaderActionsProps
): React.JSX.Element => {
  const { containerApi, activePanel } = props;

  const handleSplitHorizontal = useCallback(() => {
    if (activePanel?.params?.tab) {
      // Get the tab kind and create a copy with unique ID
      const originalTab = activePanel.params.tab;
      const tabKind = originalTab.kind || "editor";
      // Create a new tab object with unique ID to avoid duplicates
      const newTab = { ...originalTab, id: `split-${Date.now()}` };
      // Create a new group by splitting horizontally
      containerApi.addPanel({
        id: newTab.id,
        component: tabKind,
        title: newTab.title,
        params: { tab: newTab },
        position: { referenceGroup: props.group, direction: "right" },
      });
    }
  }, [activePanel, containerApi, props.group]);

  const handleSplitVertical = useCallback(() => {
    if (activePanel?.params?.tab) {
      // Get the tab kind and create a copy with unique ID
      const originalTab = activePanel.params.tab;
      const tabKind = originalTab.kind || "editor";
      // Create a new tab object with unique ID to avoid duplicates
      const newTab = { ...originalTab, id: `split-${Date.now()}` };
      // Create a new group by splitting vertically
      containerApi.addPanel({
        id: newTab.id,
        component: tabKind,
        title: newTab.title,
        params: { tab: newTab },
        position: { referenceGroup: props.group, direction: "below" },
      });
    }
  }, [activePanel, containerApi, props.group]);

  const handleCloseGroup = useCallback(() => {
    containerApi.removeGroup(props.group);
  }, [containerApi, props.group]);

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
 * Props for DockviewLayout component
 */
export interface DockviewLayoutProps {
  /**
   * Callback when dockview is ready and API is available
   */
  onReady?: (api: DockviewApi) => void;

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
 * 1. Initializes DockviewReact with all TabKind components
 * 2. Provides custom tab component, watermark, and header actions
 * 3. Stores DockviewApi in a ref for external access
 * 4. Applies custom theme class "dockview-theme-side"
 *
 * The components map uses placeholder components that will be replaced
 * by proper adapters in Task 3.
 */
export function DockviewLayout({
  onReady,
  className = "",
  style,
}: DockviewLayoutProps): React.JSX.Element {
  /**
   * Handle dockview ready event
   * Stores API reference in module-level ref and calls onReady callback
   */
  const handleReady = useCallback(
    (event: DockviewReadyEvent) => {
      dockviewApiRef.current = event.api;
      onReady?.(event.api);
    },
    [onReady]
  );

  /**
   * Components map for all TabKind types
   * These map directly from TabKind to panel components
   * In Task 3, these will be replaced with proper adapter components
   */
  const components: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
    agent: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    workspace: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    deck: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    terminal: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    editor: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    server: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    mcp: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    remoteAccess: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    tunnel: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    serverSettings: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    agentStatus: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    agentConfig: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    agentConfigLocal: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
    setup: PlaceholderPanel as React.FunctionComponent<IDockviewPanelProps>,
  };

  return (
    <div className={`dockview-theme-side ${className}`.trim()} style={style}>
      <DockviewReact
        components={components}
        defaultTabComponent={DockviewTab}
        watermarkComponent={WatermarkComponent}
        rightHeaderActionsComponent={RightHeaderActionsComponent}
        onReady={handleReady}
        // Disable auto resizing to handle manually if needed
        disableAutoResizing={false}
      />
    </div>
  );
}

/**
 * Get the dockview API ref object
 * Returns a ref object with the current API instance
 * The API is available after DockviewLayout's onReady callback has been invoked
 *
 * This is a module-level singleton, not a React Hook
 */
export function getDockviewApiRef(): {
  current: DockviewApi | null;
} {
  return dockviewApiRef;
}
