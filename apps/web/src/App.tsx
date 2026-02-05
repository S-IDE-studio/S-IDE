import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getConfig, getWsBase } from "./api";
import { CommonSettings } from "./components/AgentSettings";
import { ContextStatus } from "./components/ContextStatus";
import { DeckModal } from "./components/DeckModal";
import { DiffViewer } from "./components/DiffViewer";
import { EnvironmentModal } from "./components/EnvironmentModal";
import { GlobalStatusBar } from "./components/GlobalStatusBar";
import { MemoizedUnifiedPanelView } from "./components/panel/UnifiedPanelView";
import { ServerModal } from "./components/ServerModal";
import { ServerStartupScreen } from "./components/ServerStartupScreen";
import { ServerStatus } from "./components/ServerStatus";
import { SettingsModal } from "./components/SettingsModal";
import { StatusMessage } from "./components/StatusMessage";
import { TitleBar } from "./components/TitleBar";
import { TunnelControl } from "./components/TunnelControl";
import { UpdateNotification, useUpdateCheck } from "./components/UpdateNotification";
import { UpdateProgress } from "./components/UpdateProgress";
import { WorkspaceModal } from "./components/WorkspaceModal";
import {
  API_BASE,
  DEFAULT_ROOT_FALLBACK,
  MESSAGE_SAVED,
  MESSAGE_SELECT_WORKSPACE,
  MESSAGE_WORKSPACE_REQUIRED,
  SAVED_MESSAGE_TIMEOUT,
  STORAGE_KEY_THEME,
} from "./constants";
import { useDeckContext } from "./contexts/DeckContext";
import { useWorkspaceContext } from "./contexts/WorkspaceContext";
import { useDecks } from "./hooks/useDecks";
import { useFileOperations } from "./hooks/useFileOperations";
import { useGitState } from "./hooks/useGitState";
import { useServerStatus } from "./hooks/useServerStatus";
import { useWorkspaces } from "./hooks/useWorkspaces";
import type { EditorFile, PanelGroup, PanelLayout, SidebarPanel, WorkspaceMode } from "./types";
import { createEditorGroup, createSingleGroupLayout } from "./utils/editorGroupUtils";
import { createEmptyDeckState, createEmptyWorkspaceState } from "./utils/stateUtils";
import {
  agentToTab,
  createEmptyPanelGroup,
  createSinglePanelLayout,
  deckToTab,
  editorToTab,
  serverToTab,
  tunnelToTab,
  workspaceToTab,
} from "./utils/unifiedTabUtils";
import { parseUrlState } from "./utils/urlUtils";

export default function App() {
  const initialUrlState = parseUrlState();

  // Update check
  const {
    updateInfo,
    isChecking,
    isDownloading,
    showNotification,
    checkForUpdates,
    downloadAndInstall,
    skipUpdate,
  } = useUpdateCheck();

  // Server startup screen state
  const [serverReady, setServerReady] = useState(true); // Start as ready for browser preview

  // Server status
  const serverStatus = useServerStatus();

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(initialUrlState.workspaceMode);
  const _theme = "dark"; // Force dark theme
  const [defaultRoot, setDefaultRoot] = useState(DEFAULT_ROOT_FALLBACK);
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setIsEnvironmentModalOpen] = useState(false);
  const [isCommonSettingsOpen, setIsCommonSettingsOpen] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("files");
  const [selectedServerUrl, setSelectedServerUrl] = useState<string | undefined>();

  // Agent state
  const [agents, setAgents] = useState<
    Array<{ id: string; name: string; icon: string; description: string; enabled: boolean }>
  >([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);

  // Unified panel state
  const [panelGroups, setPanelGroups] = useState<PanelGroup[]>(createSinglePanelLayout().groups);
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(createSinglePanelLayout().layout);
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);

  const { workspaceStates, setWorkspaceStates, updateWorkspaceState, initializeWorkspaceStates } =
    useWorkspaceContext();
  const { deckStates, setDeckStates, updateDeckState, initializeDeckStates } = useDeckContext();

  const { workspaces, editorWorkspaceId, setEditorWorkspaceId, handleCreateWorkspace } =
    useWorkspaces({
      setStatusMessage,
      defaultRoot,
      initializeWorkspaceStates,
      setWorkspaceStates,
    });

  const {
    decks,
    activeDeckIds,
    setActiveDeckIds,
    terminalGroups,
    handleCreateDeck,
    handleCreateTerminal,
    handleDeleteTerminal,
    handleToggleGroupCollapsed,
    handleDeleteGroup,
    handleUpdateGroup,
    creatingTerminalDeckIds,
  } = useDecks({
    setStatusMessage,
    initializeDeckStates,
    updateDeckState,
    deckStates,
    setDeckStates,
    initialDeckIds: initialUrlState.deckIds,
  });

  const defaultWorkspaceState = useMemo(() => createEmptyWorkspaceState(), []);
  const defaultDeckState = useMemo(() => createEmptyDeckState(), []);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === editorWorkspaceId) || null;
  const activeWorkspaceState = editorWorkspaceId
    ? workspaceStates[editorWorkspaceId] || defaultWorkspaceState
    : defaultWorkspaceState;

  const {
    savingFileId,
    handleRefreshTree,
    handleToggleDir,
    handleOpenFile: baseHandleOpenFile,
    handleFileChange,
    handleSaveFile,
    handleCloseFile,
    handleCreateFile,
    handleCreateDirectory,
    handleDeleteFile,
    handleDeleteDirectory,
  } = useFileOperations({
    editorWorkspaceId,
    activeWorkspaceState,
    updateWorkspaceState,
    setStatusMessage,
  });

  // Wrap handleOpenFile to add tab to panel
  const handleOpenFile = useCallback(
    (...args: Parameters<typeof baseHandleOpenFile>) => {
      const result = baseHandleOpenFile(...args);
      // Add tab after file is opened (activeWorkspaceState.files will be updated)
      return result;
    },
    [baseHandleOpenFile]
  );

  // Editor group handlers
  const handleSplitGroup = useCallback(
    (groupId: string, direction: "horizontal" | "vertical") => {
      if (!editorWorkspaceId) return;

      updateWorkspaceState(editorWorkspaceId, (state) => {
        const currentGroups = state.editorGroups || createSingleGroupLayout(state.files).groups;
        const currentLayout = state.groupLayout || { direction: "single" as const, sizes: [100] };

        // Find the group to split
        const groupIndex = currentGroups.findIndex((g) => g.id === groupId);
        if (groupIndex === -1) return state;

        // Maximum 3 groups
        if (currentGroups.length >= 3) return state;

        const sourceGroup = currentGroups[groupIndex];
        const activeTab = sourceGroup.tabs.find((t) => t.id === sourceGroup.activeTabId);

        if (!activeTab) return state;

        // Remove the active tab from source group
        const newSourceTabs = sourceGroup.tabs.filter((t) => t.id !== sourceGroup.activeTabId);
        const newSourceActiveTabId = newSourceTabs[0]?.id ?? null;

        // Create new group with the active tab
        const newGroup = createEditorGroup([activeTab], 50);

        // Update source group (without the moved tab) and insert new group
        const newGroups = [...currentGroups];
        newGroups[groupIndex] = {
          ...sourceGroup,
          tabs: newSourceTabs,
          activeTabId: newSourceActiveTabId,
        };
        newGroups.splice(groupIndex + 1, 0, newGroup);

        // Calculate split sizes with proper normalization
        const calculateSplitSizes = (currentSizes: number[], splitIndex: number): number[] => {
          const sizeOfGroupToSplit = currentSizes[splitIndex] || 50;
          const halfSize = sizeOfGroupToSplit / 2;

          const newSizes = [...currentSizes];
          newSizes[splitIndex] = halfSize;
          newSizes.splice(splitIndex + 1, 0, halfSize);

          // Normalize to sum to 100
          const total = newSizes.reduce((sum, size) => sum + size, 0);
          return newSizes.map((size) => (size / total) * 100);
        };

        // Update layout
        const newLayout = {
          direction: currentGroups.length === 1 ? direction : currentLayout.direction,
          sizes: calculateSplitSizes(currentLayout.sizes, groupIndex),
        };

        return {
          ...state,
          editorGroups: newGroups,
          groupLayout: newLayout,
          focusedGroupId: newGroup.id,
        };
      });
    },
    [editorWorkspaceId, updateWorkspaceState]
  );

  const handleCloseGroup = useCallback(
    (groupId: string) => {
      if (!editorWorkspaceId) return;

      updateWorkspaceState(editorWorkspaceId, (state) => {
        const currentGroups = state.editorGroups || createSingleGroupLayout(state.files).groups;

        // Don't allow closing the last group
        if (currentGroups.length <= 1) return state;

        const newGroups = currentGroups.filter((g) => g.id !== groupId);
        const closedGroup = currentGroups.find((g) => g.id === groupId);

        // Move tabs from closed group to remaining groups
        if (closedGroup && closedGroup.tabs.length > 0) {
          // Add to first remaining group
          newGroups[0].tabs.push(...closedGroup.tabs);
          if (!newGroups[0].activeTabId) {
            newGroups[0].activeTabId = closedGroup.activeTabId;
          }
        }

        // Recalculate sizes to normalize
        const newGroupCount = newGroups.length;
        const normalizedSize = 100 / newGroupCount;
        const newLayout = state.groupLayout
          ? { ...state.groupLayout, sizes: newGroups.map(() => normalizedSize) }
          : { direction: "single" as const, sizes: [100] };

        return {
          ...state,
          editorGroups: newGroups,
          groupLayout: newLayout,
          focusedGroupId: newGroups[0].id,
        };
      });
    },
    [editorWorkspaceId, updateWorkspaceState]
  );

  const handleFocusEditorGroup = useCallback(
    (groupId: string) => {
      if (!editorWorkspaceId) return;

      updateWorkspaceState(editorWorkspaceId, (state) => {
        const currentGroups = state.editorGroups || createSingleGroupLayout(state.files).groups;
        return {
          ...state,
          editorGroups: currentGroups.map((g) => ({
            ...g,
            focused: g.id === groupId,
          })),
          focusedGroupId: groupId,
        };
      });
    },
    [editorWorkspaceId, updateWorkspaceState]
  );

  const handleReorderTabsInGroup = useCallback(
    (groupId: string, tabs: EditorFile[]) => {
      if (!editorWorkspaceId) return;

      updateWorkspaceState(editorWorkspaceId, (state) => {
        const currentGroups = state.editorGroups || createSingleGroupLayout(state.files).groups;
        return {
          ...state,
          editorGroups: currentGroups.map((g) => (g.id === groupId ? { ...g, tabs } : g)),
        };
      });
    },
    [editorWorkspaceId, updateWorkspaceState]
  );

  // Unified panel handlers
  const handleSelectTab = useCallback((groupId: string, tabId: string) => {
    setPanelGroups((prev) =>
      prev
        .map((g) => (g.id === groupId ? { ...g, activeTabId: tabId, focused: true } : g))
        .map((g) => (g.id === groupId ? g : { ...g, focused: false }))
    );
    setFocusedPanelId(groupId);
  }, []);

  const handleCloseTab = useCallback((groupId: string, tabId: string) => {
    setPanelGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const newTabs = g.tabs.filter((t) => t.id !== tabId);
          return {
            ...g,
            tabs: newTabs,
            activeTabId: g.activeTabId === tabId ? (newTabs[0]?.id ?? null) : g.activeTabId,
          };
        }
        return g;
      })
    );
  }, []);

  const handleFocusGroup = useCallback((groupId: string) => {
    setPanelGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, focused: true } : { ...g, focused: false }))
    );
    setFocusedPanelId(groupId);
  }, []);

  // Tab reorder handler
  const handleTabsReorder = useCallback((groupId: string, oldIndex: number, newIndex: number) => {
    setPanelGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const newTabs = [...g.tabs];
          const [removed] = newTabs.splice(oldIndex, 1);
          newTabs.splice(newIndex, 0, removed);
          return { ...g, tabs: newTabs };
        }
        return g;
      })
    );
  }, []);

  // Tab move between panels handler
  const handleTabMove = useCallback(
    (tabId: string, sourceGroupId: string, targetGroupId: string) => {
      if (sourceGroupId === targetGroupId) return;

      setPanelGroups((prev) => {
        const sourceGroup = prev.find((g) => g.id === sourceGroupId);
        const targetGroup = prev.find((g) => g.id === targetGroupId);
        if (!sourceGroup || !targetGroup) return prev;

        const tab = sourceGroup.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;

        return prev.map((g) => {
          if (g.id === sourceGroupId) {
            const newTabs = g.tabs.filter((t) => t.id !== tabId);
            const newActiveId = g.activeTabId === tabId ? (newTabs[0]?.id ?? null) : g.activeTabId;
            return { ...g, tabs: newTabs, activeTabId: newActiveId };
          }
          if (g.id === targetGroupId) {
            return { ...g, tabs: [...g.tabs, tab], activeTabId: tab.id };
          }
          return g;
        });
      });
    },
    []
  );

  // Panel split handler
  const handleSplitPanel = useCallback(
    (groupId: string, direction: import("./types").SplitDirection) => {
      setPanelGroups((prev) => {
        const groupIndex = prev.findIndex((g) => g.id === groupId);
        if (groupIndex === -1) return prev;

        const currentGroup = prev[groupIndex];
        const newGroup = createEmptyPanelGroup(50);

        // Determine new layout direction
        let newDirection: "horizontal" | "vertical" = "horizontal";
        if (direction === "up" || direction === "down") {
          newDirection = "vertical";
        }

        // Calculate insert position
        let insertIndex = groupIndex + 1;
        if (direction === "left" || direction === "up") {
          insertIndex = groupIndex;
        }

        // Update percentages
        const updatedGroups = prev.map((g, i) => {
          if (
            i === groupIndex ||
            (i === insertIndex && direction === "right") ||
            direction === "down"
          ) {
            return { ...g, percentage: 50 };
          }
          return g;
        });

        // Insert new group
        const newGroups = [
          ...updatedGroups.slice(0, insertIndex),
          { ...newGroup, percentage: 50 },
          ...updatedGroups.slice(insertIndex),
        ];

        setPanelLayout({ direction: newDirection, sizes: newGroups.map((g) => g.percentage) });
        return newGroups;
      });
    },
    []
  );

  // Panel close handler
  const handleClosePanel = useCallback((groupId: string) => {
    setPanelGroups((prev) => {
      if (prev.length <= 1) {
        // Don't close the last panel, just clear it
        return prev.map((g) => ({ ...g, tabs: [], activeTabId: null }));
      }

      const newGroups = prev.filter((g) => g.id !== groupId);
      if (newGroups.length === 1) {
        setPanelLayout({ direction: "single", sizes: [100] });
      } else {
        // Redistribute percentages
        const totalPercentage = newGroups.reduce((sum, g) => sum + g.percentage, 0);
        newGroups.forEach((g) => {
          g.percentage = (g.percentage / totalPercentage) * 100;
        });
      }
      return newGroups;
    });
  }, []);

  // Panel resize handler
  const handleResizePanel = useCallback(
    (groupId: string, delta: number) => {
      setPanelGroups((prev) => {
        const groupIndex = prev.findIndex((g) => g.id === groupId);
        if (groupIndex === -1 || groupIndex === prev.length - 1) return prev;

        const isHorizontal = panelLayout.direction === "horizontal";
        const containerSize = isHorizontal ? window.innerWidth : window.innerHeight;
        const percentageDelta = (delta / containerSize) * 100;

        const newGroups = prev.map((g, i) => {
          if (i === groupIndex) {
            const newPercentage = Math.max(10, Math.min(90, g.percentage + percentageDelta));
            return { ...g, percentage: newPercentage };
          }
          if (i === groupIndex + 1) {
            const newPercentage = Math.max(10, Math.min(90, g.percentage - percentageDelta));
            return { ...g, percentage: newPercentage };
          }
          return g;
        });

        return newGroups;
      });
    },
    [panelLayout.direction]
  );

  // Context menu action handler
  const handleContextMenuAction = useCallback(
    (action: import("./types").TabContextMenuAction, groupId: string, tabId: string) => {
      setPanelGroups((prev) => {
        const group = prev.find((g) => g.id === groupId);
        if (!group) return prev;

        const tabIndex = group.tabs.findIndex((t) => t.id === tabId);
        if (tabIndex === -1) return prev;

        let newTabs = [...group.tabs];
        let newActiveTabId = group.activeTabId;

        switch (action) {
          case "close":
            newTabs = newTabs.filter((t) => t.id !== tabId);
            newActiveTabId =
              group.activeTabId === tabId
                ? (newTabs[tabIndex]?.id ?? newTabs[tabIndex - 1]?.id ?? null)
                : group.activeTabId;
            break;
          case "closeOthers":
            newTabs = [group.tabs[tabIndex]];
            newActiveTabId = tabId;
            break;
          case "closeToTheRight":
            newTabs = newTabs.slice(0, tabIndex + 1);
            break;
          case "closeToTheLeft":
            newTabs = newTabs.slice(tabIndex);
            break;
          case "closeAll":
            newTabs = [];
            newActiveTabId = null;
            break;
          case "pin":
          case "unpin":
            newTabs[tabIndex] = { ...newTabs[tabIndex], pinned: action === "pin" };
            break;
          case "splitRight":
            // Trigger panel split
            setTimeout(() => handleSplitPanel(groupId, "right"), 0);
            return prev;
          case "splitLeft":
            setTimeout(() => handleSplitPanel(groupId, "left"), 0);
            return prev;
          case "splitUp":
            setTimeout(() => handleSplitPanel(groupId, "up"), 0);
            return prev;
          case "splitDown":
            setTimeout(() => handleSplitPanel(groupId, "down"), 0);
            return prev;
        }

        return prev.map((g) => {
          if (g.id === groupId) {
            return { ...g, tabs: newTabs, activeTabId: newActiveTabId };
          }
          return g;
        });
      });
    },
    [handleSplitPanel]
  );

  // Tab population helpers
  const addTabToPanel = useCallback((tab: import("./types").UnifiedTab) => {
    setPanelGroups((prev) => {
      if (prev.length === 0) {
        return createSinglePanelLayout().groups;
      }

      // Add to first panel for now (can be extended later)
      const newGroups = [...prev];
      newGroups[0] = {
        ...newGroups[0],
        tabs: [...newGroups[0].tabs, tab],
        activeTabId: tab.id,
      };
      return newGroups;
    });
  }, []);

  // Handler for adding agent tab
  const handleAddAgentTab = useCallback(
    (agent: import("./types").Agent) => {
      const tab = agentToTab(agent);
      addTabToPanel(tab);
    },
    [addTabToPanel]
  );

  // Handler for adding workspace tab
  const handleAddWorkspaceTab = useCallback(
    (workspace: import("./types").Workspace) => {
      const tab = workspaceToTab(workspace);
      addTabToPanel(tab);
    },
    [addTabToPanel]
  );

  // Handler for adding deck tab
  const handleAddDeckTab = useCallback(
    (deck: import("./types").Deck) => {
      const tab = deckToTab(deck);
      addTabToPanel(tab);
    },
    [addTabToPanel]
  );

  // Handler for adding editor tab
  const handleAddEditorTab = useCallback(
    (file: EditorFile) => {
      const tab = editorToTab(file);
      addTabToPanel(tab);
    },
    [addTabToPanel]
  );

  // Handler for adding server tab
  const handleAddServerTab = useCallback(() => {
    const tab = serverToTab();
    addTabToPanel(tab);
  }, [addTabToPanel]);

  // Handler for adding tunnel tab
  const handleAddTunnelTab = useCallback(() => {
    const tab = tunnelToTab();
    addTabToPanel(tab);
  }, [addTabToPanel]);

  // Track if we've done initial panel setup
  const initialPanelSetupDoneRef = useRef(false);

  // Initialize panels with existing data (run after agents/workspaces/decks are loaded)
  useEffect(() => {
    // Skip if we've already done initial setup
    if (initialPanelSetupDoneRef.current) return;

    // Skip if data hasn't loaded yet (check if any data exists)
    const hasData = agents.length > 0 || workspaces.length > 0 || decks.length > 0;

    // If no data at all, still mark as done to avoid infinite loop
    if (!hasData) {
      initialPanelSetupDoneRef.current = true;
      return;
    }

    setPanelGroups((currentGroups) => {
      const newGroups =
        currentGroups.length === 0 ? createSinglePanelLayout().groups : currentGroups;
      const group = newGroups[0];

      // Collect all existing tab IDs
      const existingAgentIds = group.tabs
        .filter((t) => t.kind === "agent")
        .map((t) => t.data.agent?.id);
      const existingWorkspaceIds = group.tabs
        .filter((t) => t.kind === "workspace")
        .map((t) => t.data.workspace?.id);
      const existingDeckIds = group.tabs
        .filter((t) => t.kind === "deck")
        .map((t) => t.data.deck?.id);

      const newTabs: typeof group.tabs = [...group.tabs];

      // Add agents that don't exist
      agents.forEach((agent) => {
        if (!existingAgentIds.includes(agent.id)) {
          newTabs.push(agentToTab(agent));
        }
      });

      // Add workspaces that don't exist
      workspaces.forEach((workspace) => {
        if (!existingWorkspaceIds.includes(workspace.id)) {
          newTabs.push(workspaceToTab(workspace));
        }
      });

      // Add decks that don't exist
      decks.forEach((deck) => {
        if (!existingDeckIds.includes(deck.id)) {
          newTabs.push(deckToTab(deck));
        }
      });

      // Set first tab as active if no active tab
      const activeTabId = group.activeTabId || (newTabs.length > 0 ? newTabs[0].id : null);

      return [{ ...group, tabs: newTabs, activeTabId }, ...newGroups.slice(1)];
    });

    // Mark initial setup as done
    initialPanelSetupDoneRef.current = true;
  }, [agents, workspaces, decks]); // Run when data is loaded

  // Add editor tabs when files change
  useEffect(() => {
    if (activeWorkspaceState.files && activeWorkspaceState.files.length > 0) {
      setPanelGroups((currentGroups) => {
        const newGroups = [...currentGroups];
        const group = newGroups[0];

        // Collect existing editor tab IDs
        const existingEditorIds = group.tabs
          .filter((t) => t.kind === "editor")
          .map((t) => t.data.editor?.id);

        const newTabs = [...group.tabs];

        // Add files that don't exist
        activeWorkspaceState.files.forEach((file) => {
          if (!existingEditorIds.includes(file.id)) {
            newTabs.push(editorToTab(file));
          }
        });

        // Preserve activeTabId
        newGroups[0] = { ...group, tabs: newTabs, activeTabId: group.activeTabId };
        return newGroups;
      });
    }
  }, [activeWorkspaceState.files]);

  const {
    gitState,
    refreshGitStatus,
    handleSelectRepo,
    handleStageFile,
    handleUnstageFile,
    handleStageAll,
    handleUnstageAll,
    handleCommit,
    handleDiscardFile,
    handleShowDiff,
    handleCloseDiff,
    handlePush,
    handlePull,
    handleLoadBranches,
    handleCheckoutBranch,
    handleCreateBranch,
    handleLoadLogs,
  } = useGitState(editorWorkspaceId, setStatusMessage);

  const wsBase = getWsBase();
  const workspaceById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  );
  const _deckListItems = decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    path: workspaceById.get(deck.workspaceId)?.path || deck.root,
  }));

  // Calculate active terminals count for status bar
  const activeTerminalsCount = useMemo(() => {
    let count = 0;
    activeDeckIds.forEach((deckId) => {
      const deckState = deckStates[deckId];
      if (deckState?.terminals) {
        count += deckState.terminals.length;
      }
    });
    return count;
  }, [activeDeckIds, deckStates]);

  // Context manager status state
  const [showContextStatus, setShowContextStatus] = useState(false);
  const [contextHealthScore, setContextHealthScore] = useState<number>(100);

  const handleContextStatusChange = useCallback((status: { healthScore: number }) => {
    setContextHealthScore((prevHealthScore) => {
      // Show notification when health score drops
      if (status.healthScore < 50 && prevHealthScore >= 50) {
        setStatusMessage("Context health is low. Consider compacting.");
      }
      return status.healthScore;
    });
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    getConfig()
      .then((config) => {
        if (signal.aborted) return;
        if (config?.defaultRoot) {
          setDefaultRoot(config.defaultRoot);
        }
      })
      .catch(() => undefined);

    return () => {
      abortController.abort();
    };
  }, []);

  // Check for updates on app startup (desktop only)
  // NOTE: Updater functionality is disabled in this build
  /*
  useEffect(() => {
    const isDesktop = typeof window !== "undefined" &&
      "__TAURI__" in window;
    if (isDesktop) {
      checkForUpdates();
    }
  }, [checkForUpdates]);
  */

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = "dark";
    try {
      window.localStorage.setItem(STORAGE_KEY_THEME, "dark");
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const next = parseUrlState();
      setEditorWorkspaceId(next.workspaceId ?? null);
      setActiveDeckIds(next.deckIds);
      setWorkspaceMode(next.workspaceMode);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setEditorWorkspaceId, setActiveDeckIds, setWorkspaceMode]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (editorWorkspaceId) {
      params.set("workspace", editorWorkspaceId);
    }
    if (activeDeckIds.length > 0) {
      params.set("decks", activeDeckIds.join(","));
    }
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, [editorWorkspaceId, activeDeckIds]);

  useEffect(() => {
    if (statusMessage !== MESSAGE_SAVED) return;
    const timer = setTimeout(() => setStatusMessage(""), SAVED_MESSAGE_TIMEOUT);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  // Load available agents (only once on mount)
  // Note: activeAgent is intentionally in deps to prevent re-fetching when user changes active agent
  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchAgents = async () => {
      try {
        const res = await fetch("/api/agents", { signal });
        if (signal.aborted) return;
        if (res.ok) {
          const data = await res.json();
          if (signal.aborted) return;
          setAgents(data);
          // Set first enabled agent as active if none selected
          // This only runs when no agent is currently selected
          if (!activeAgent && data.length > 0) {
            const firstEnabled = data.find((a: { enabled: boolean }) => a.enabled);
            if (firstEnabled) {
              setActiveAgent(firstEnabled.id);
            }
          }
        }
      } catch (err) {
        if (!signal.aborted) {
          console.error("Failed to load agents:", err);
        }
      }
    };
    fetchAgents();

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgent]);

  useEffect(() => {
    if (workspaceMode === "editor" && !editorWorkspaceId) {
      setWorkspaceMode("list");
    }
  }, [workspaceMode, editorWorkspaceId]);

  // Track if we've loaded tree for current workspace
  const treeLoadedRef = useRef<string | null>(null);

  // Refresh file tree when opening workspace editor
  useEffect(() => {
    if (workspaceMode !== "editor" || !editorWorkspaceId) {
      treeLoadedRef.current = null;
      return;
    }

    // Only load if we haven't loaded for this workspace yet
    if (treeLoadedRef.current !== editorWorkspaceId) {
      treeLoadedRef.current = editorWorkspaceId;
      handleRefreshTree();
      refreshGitStatus();
    }
  }, [workspaceMode, editorWorkspaceId, handleRefreshTree, refreshGitStatus]);

  const handleOpenDeckModal = useCallback(() => {
    if (workspaces.length === 0) {
      setStatusMessage(MESSAGE_WORKSPACE_REQUIRED);
      return;
    }
    setIsDeckModalOpen(true);
  }, [workspaces.length, setStatusMessage]);

  const handleSubmitDeck = useCallback(
    async (name: string, workspaceId: string) => {
      if (!workspaceId) {
        setStatusMessage(MESSAGE_SELECT_WORKSPACE);
        return;
      }
      const deck = await handleCreateDeck(name, workspaceId);
      if (deck) {
        setIsDeckModalOpen(false);
        handleAddDeckTab(deck);
      }
    },
    [handleCreateDeck, setStatusMessage, handleAddDeckTab]
  );

  const handleSaveSettings = useCallback(
    async (settings: {
      port: number;
      basicAuthEnabled: boolean;
      basicAuthUser: string;
      basicAuthPassword: string;
    }) => {
      const abortController = new AbortController();
      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(error || "Failed to save settings");
        }

        const _result = await response.json();
        setStatusMessage("設定を保存しました。ブラウザをリロードしてください。");

        // Reload after delay to apply settings
        setTimeout(() => {
          window.location.reload();
        }, SAVED_MESSAGE_TIMEOUT);
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Failed to save settings:", error);
        }
        throw error;
      }
    },
    [setStatusMessage]
  );

  const handleSelectWorkspace = useCallback(
    (workspaceId: string) => {
      setEditorWorkspaceId(workspaceId);
      setWorkspaceMode("editor");
    },
    [setEditorWorkspaceId]
  );

  const handleCloseWorkspaceEditor = useCallback(() => {
    setWorkspaceMode("list");
  }, []);

  const handleOpenWorkspaceModal = useCallback(() => {
    setIsWorkspaceModalOpen(true);
  }, []);

  const handleSubmitWorkspace = useCallback(
    async (path: string) => {
      const created = await handleCreateWorkspace(path);
      if (created) {
        setIsWorkspaceModalOpen(false);
        handleAddWorkspaceTab(created);
      }
    },
    [handleCreateWorkspace, handleAddWorkspaceTab]
  );

  const handleNewTerminalForDeck = useCallback(
    (deckId: string) => {
      const deckState = deckStates[deckId] || defaultDeckState;
      handleCreateTerminal(deckId, deckState.terminals.length);
    },
    [deckStates, defaultDeckState, handleCreateTerminal]
  );

  const handleNewClaudeTerminalForDeck = useCallback(
    (deckId: string) => {
      const deckState = deckStates[deckId] || defaultDeckState;
      handleCreateTerminal(deckId, deckState.terminals.length, "claude", "Claude Code");
    },
    [deckStates, defaultDeckState, handleCreateTerminal]
  );

  const handleNewCodexTerminalForDeck = useCallback(
    (deckId: string) => {
      const deckState = deckStates[deckId] || defaultDeckState;
      handleCreateTerminal(deckId, deckState.terminals.length, "codex", "Codex");
    },
    [deckStates, defaultDeckState, handleCreateTerminal]
  );

  const handleTerminalDeleteForDeck = useCallback(
    (deckId: string, terminalId: string) => {
      handleDeleteTerminal(deckId, terminalId);
    },
    [handleDeleteTerminal]
  );

  const handleToggleDeck = useCallback(
    (deckId: string, shiftKey = false) => {
      setActiveDeckIds((prev) => {
        if (prev.includes(deckId)) {
          // Remove deck (but keep at least one)
          if (prev.length > 1) {
            return prev.filter((id) => id !== deckId);
          }
          return prev;
        } else if (shiftKey) {
          // Shift+click: Add deck for split view (max 3)
          if (prev.length < 3) {
            return [...prev, deckId];
          }
          // Replace first one if at max
          return [...prev.slice(1), deckId];
        } else {
          // Normal click: Replace with single deck (no split)
          return [deckId];
        }
      });
    },
    [setActiveDeckIds]
  );

  // Keyboard navigation for deck tabs
  const handleDeckTabKeyDown = useCallback(
    (e: ReactKeyboardEvent, _deckId: string, index: number) => {
      // Only handle arrow keys when not modified with ctrl/cmd/alt
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const direction = e.key === "ArrowLeft" ? -1 : 1;
        const newIndex = index + direction;

        // Find the deck at the new index
        if (newIndex >= 0 && newIndex < decks.length) {
          const _targetDeckId = decks[newIndex].id;
          // Focus the new tab but don't change selection (just move focus)
          const targetTab = e.currentTarget.parentElement?.children[newIndex + 1] as HTMLElement;
          targetTab?.focus();
        }
      } else if (e.key === "Home") {
        e.preventDefault();
        // Move to first tab
        const firstTab = e.currentTarget.parentElement?.children[1] as HTMLElement;
        firstTab?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        // Move to last tab
        const lastTab = e.currentTarget.parentElement?.children[decks.length] as HTMLElement;
        lastTab?.focus();
      }
    },
    [decks]
  );

  const gitChangeCount = gitState.status?.files.length ?? 0;

  // Check if welcome screen should be shown
  const showWelcomeScreen = workspaces.length === 0 && decks.length === 0;

  // Show startup screen first
  if (!serverReady) {
    return <ServerStartupScreen onComplete={() => setServerReady(true)} />;
  }

  return (
    <div className="app">
      <TitleBar
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenServerModal={() => setIsServerModalOpen(true)}
        onToggleContextStatus={() => setShowContextStatus((prev) => !prev)}
        onOpenWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
        onOpenDeckModal={() => setIsDeckModalOpen(true)}
        onCreateAgent={() => {
          /* TODO: Implement agent creation */
        }}
        onNewTerminal={() => {
          // Create a new terminal in the first available deck
          const firstDeckId = activeDeckIds[0];
          if (firstDeckId) {
            handleNewTerminalForDeck(firstDeckId);
          } else if (decks.length > 0) {
            handleNewTerminalForDeck(decks[0].id);
          } else {
            setIsDeckModalOpen(true);
          }
        }}
        onAddServerTab={handleAddServerTab}
        onAddTunnelTab={handleAddTunnelTab}
      />
      <main className="main">
        <MemoizedUnifiedPanelView
          groups={panelGroups}
          layout={panelLayout}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onFocusGroup={handleFocusGroup}
          onTabsReorder={handleTabsReorder}
          onTabMove={handleTabMove}
          onSplitPanel={handleSplitPanel}
          onClosePanel={handleClosePanel}
          onResizePanel={handleResizePanel}
          onContextMenuAction={handleContextMenuAction}
          workspaceStates={workspaceStates}
          gitFiles={gitState.status?.files}
          onToggleDir={handleToggleDir}
          onOpenFile={handleOpenFile}
          onRefreshTree={handleRefreshTree}
          onCreateFile={handleCreateFile}
          onCreateDirectory={handleCreateDirectory}
          onDeleteFile={handleDeleteFile}
          onDeleteDirectory={handleDeleteDirectory}
          deckStates={deckStates}
          wsBase={API_BASE}
          onDeleteTerminal={(terminalId) => {
            // handleDeleteTerminal expects (deckId, terminalId)
            // Find the deck that contains this terminal
            for (const deck of decks) {
              const deckState = deckStates[deck.id];
              if (deckState?.terminals?.some((t) => t.id === terminalId)) {
                handleDeleteTerminal(deck.id, terminalId);
                break;
              }
            }
          }}
          onReorderTerminals={(deckId, newOrder) => {
            // handleUpdateGroup updates group properties, not terminal order
            // Terminal reordering is handled by TerminalPane internally
            // For now, we can ignore or implement proper terminal reordering
          }}
          onCreateTerminal={() => {
            const activeDeck =
              activeDeckIds.length > 0 ? decks.find((d) => d.id === activeDeckIds[0]) : null;
            if (activeDeck) {
              handleNewTerminalForDeck(activeDeck.id);
            }
          }}
          onToggleGroupCollapsed={handleToggleGroupCollapsed}
          onDeleteGroup={handleDeleteGroup}
          onRenameGroup={(groupId) => {
            const group = terminalGroups?.find((g) => g.id === groupId);
            if (group) {
              const newName = prompt("Enter new group name:");
              if (newName) {
                handleUpdateGroup(groupId, { name: newName });
              }
            }
          }}
          onChangeFile={handleFileChange}
          onSaveFile={handleSaveFile}
          savingFileId={savingFileId}
        />
        {gitState.diffPath && (
          <DiffViewer
            diff={gitState.diff}
            loading={gitState.diffLoading}
            onClose={handleCloseDiff}
          />
        )}
      </main>
      <StatusMessage message={statusMessage} />
      <GlobalStatusBar
        serverStatus={<ServerStatus status={serverStatus.status} port={serverStatus.port} />}
        tunnelControl={<TunnelControl />}
        activeTerminalsCount={activeTerminalsCount}
        contextHealthScore={contextHealthScore}
        onToggleContextStatus={() => setShowContextStatus((prev) => !prev)}
        onOpenEnvironmentModal={() => setIsEnvironmentModalOpen(true)}
      />
      {showContextStatus && (
        <div className="context-status-overlay" onClick={() => setShowContextStatus(false)}>
          <div className="context-status-panel" onClick={(e) => e.stopPropagation()}>
            <ContextStatus onStatusChange={handleContextStatusChange} />
          </div>
        </div>
      )}
      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        defaultRoot={defaultRoot}
        onSubmit={handleSubmitWorkspace}
        onClose={() => setIsWorkspaceModalOpen(false)}
      />
      <DeckModal
        isOpen={isDeckModalOpen}
        workspaces={workspaces}
        onSubmit={handleSubmitDeck}
        onClose={() => setIsDeckModalOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSaveSettings}
      />
      <ServerModal
        isOpen={isServerModalOpen}
        status={serverStatus.status}
        port={serverStatus.port}
        onClose={() => setIsServerModalOpen(false)}
      />
      <EnvironmentModal
        isOpen={isEnvironmentModalOpen}
        onClose={() => setIsEnvironmentModalOpen(false)}
      />
      <CommonSettings
        isOpen={isCommonSettingsOpen}
        onClose={() => setIsCommonSettingsOpen(false)}
      />
      {showNotification && updateInfo && (
        <UpdateNotification
          updateInfo={updateInfo}
          onDownload={downloadAndInstall}
          onSkip={skipUpdate}
        />
      )}
      {isDownloading && <UpdateProgress />}
    </div>
  );
}
