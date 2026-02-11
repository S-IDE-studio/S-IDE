import type { KeyboardEvent as ReactKeyboardEvent } from "react";

// Check if running in Tauri (Tauri v2 uses __TAURI_INTERNALS__)
function isTauriApp(): boolean {
  return typeof window !== "undefined" && (
    "__TAURI_INTERNALS__" in window ||
    "__TAURI__" in window
  );
}
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getConfig, getWsBase, listFiles, readFile } from "./api";
import { CommonSettings } from "./components/AgentSettings";
import { ContextStatus } from "./components/ContextStatus";
import { DiffViewer } from "./components/DiffViewer";
import { EnvironmentModal } from "./components/EnvironmentModal";
import { GlobalStatusBar } from "./components/GlobalStatusBar";
import { DockviewLayout } from "./components/dockview/DockviewLayout";
import { RemoteAccessControl } from "./components/RemoteAccessControl";
import { ServerModal } from "./components/ServerModal";
import { ServerStartupScreen } from "./components/ServerStartupScreen";
import { ServerStatus } from "./components/ServerStatus";
import { SettingsModal } from "./components/SettingsModal";
import { StatusMessage } from "./components/StatusMessage";
import { TitleBar } from "./components/TitleBar";
import { UpdateNotification, useUpdateCheck } from "./components/UpdateNotification";
import { UpdateProgress } from "./components/UpdateProgress";
import {
  DEFAULT_ROOT_FALLBACK,
  MESSAGE_SAVED,
  MESSAGE_WORKSPACE_REQUIRED,
  SAVED_MESSAGE_TIMEOUT,
  STORAGE_KEY_THEME,
} from "./constants";
import { persistDockviewLayout, restoreDockviewLayout } from "./utils/dockviewLayoutUtils";
import { useDeckContext } from "./contexts/DeckContext";
import { useWorkspaceContext } from "./contexts/WorkspaceContext";
import { useDecks } from "./hooks/useDecks";
import { useFileOperations } from "./hooks/useFileOperations";
import { useGitState } from "./hooks/useGitState";
import { useServerStatus } from "./hooks/useServerStatus";
import { useTabsPresenceSync } from "./hooks/useTabsPresenceSync";
import { useWorkspaces } from "./hooks/useWorkspaces";
import type {
  EditorFile,
  SidebarPanel,
  UnifiedTab,
  WorkspaceMode,
} from "./types";

/** Local type for tabs presence sync compatibility - represents old panel group format */
interface PanelGroup {
  id: string;
  tabs: UnifiedTab[];
  activeTabId: string | null;
  focused: boolean;
  percentage: number;
}
import { getLanguageFromPath, toTreeNodes } from "./utils";
import { createEditorGroup, createSingleGroupLayout } from "./utils/editorGroupUtils";
import { createEmptyDeckState, createEmptyWorkspaceState } from "./utils/stateUtils";
import {
  agentToTab,
  deckToTab,
  editorToTab,
  remoteAccessToTab,
  serverToTab,
  terminalToTab,
} from "./utils/unifiedTabUtils";
import { parseUrlState } from "./utils/urlUtils";

export default function App() {
  const initialUrlState = parseUrlState();

  // Dockview API ref for external access
  const dockviewApiRef = useRef<import("dockview").DockviewApi | null>(null);

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

  // Server startup screen state - wait for server to be ready
  const [serverReady, setServerReady] = useState(false);

  // Server status
  const serverStatus = useServerStatus();

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(initialUrlState.workspaceMode);
  const _theme = "dark"; // Force dark theme
  const [defaultRoot, setDefaultRoot] = useState(DEFAULT_ROOT_FALLBACK);
  const [statusMessage, setStatusMessage] = useState("");
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

  // Dockview initialization callback
  const handleDockviewReady = useCallback((api: import("dockview").DockviewApi) => {
    dockviewApiRef.current = api;

    // Restore layout from localStorage
    restoreDockviewLayout(api);

    // Set up layout persistence on change
    const disposable = api.onDidLayoutChange(() => {
      persistDockviewLayout(api);
    });

    return () => {
      disposable.dispose();
    };
  }, []);

  // Open tab handler for dockview
  const handleOpenTab = useCallback((tab: UnifiedTab) => {
    const api = dockviewApiRef.current;
    if (!api) {
      console.warn("Dockview API not ready, cannot open tab:", tab.id);
      return;
    }

    try {
      // Check if panel already exists
      const existingPanel = api.getPanel(tab.id);
      if (existingPanel) {
        // Activate existing panel
        existingPanel.api.setActive();
        return;
      }

      // Add new panel to focused group or create new group
      api.addPanel({
        id: tab.id,
        component: tab.kind,
        title: tab.title,
        params: { tab },
      });
    } catch (e) {
      console.error("Failed to open tab:", e);
    }
  }, []);

  // Panel groups for useTabsPresenceSync compatibility
  // Derived from dockview API
  const panelGroupsMap = useMemo(() => {
    const api = dockviewApiRef.current;
    if (!api) return {};

    const map: Record<string, PanelGroup> = {};

    for (const group of api.groups) {
      // Extract panels from group
      const panels = group.panels;

      // Extract tabs from panel params
      const tabs: UnifiedTab[] = [];
      for (const panel of panels) {
        const tab = panel.params?.tab as UnifiedTab | undefined;
        if (tab) {
          tabs.push(tab);
        }
      }

      map[group.id] = {
        id: group.id,
        tabs,
        activeTabId: group.activePanel?.id || null,
        focused: group.api.isActive || false,
        percentage: 100 / api.groups.length,
      };
    }

    return map;
  }, [agents]); // Re-compute when agents change

  const { workspaceStates, setWorkspaceStates, updateWorkspaceState, initializeWorkspaceStates } =
    useWorkspaceContext();
  const { deckStates, setDeckStates, updateDeckState, initializeDeckStates } = useDeckContext();

  // Wrapper for updateWorkspaceState to match DockviewLayout's expected type
  const handleUpdateWorkspaceState = useCallback((
    id: string,
    state: Partial<import("./types").WorkspaceState>
  ) => {
    updateWorkspaceState(id, (prev) => ({ ...prev, ...state }));
  }, [updateWorkspaceState]);

  const {
    workspaces,
    editorWorkspaceId,
    setEditorWorkspaceId,
    handleCreateWorkspace,
    handleDeleteWorkspace,
    handleUpdateWorkspaceColor,
  } = useWorkspaces({
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
    handleRenameDeck,
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

  // Memoize activeWorkspaceState to prevent unnecessary re-renders
  const activeWorkspaceState = useMemo(() => {
    return editorWorkspaceId
      ? workspaceStates[editorWorkspaceId] || defaultWorkspaceState
      : defaultWorkspaceState;
  }, [editorWorkspaceId, workspaceStates, defaultWorkspaceState]);

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

  // Multi-device sync: union open tabs across clients.
  // Note: With dockview, this will need to be updated to sync via dockview API
  // For now, disable presence sync as it conflicts with dockview
  useTabsPresenceSync({
    enabled: false, // Disabled for dockview migration
    panelGroups: [],
    panelGroupsMap,
    setPanelGroupsMap: () => {},
    workspaceStates,
  });

  // Helper function to find existing editor tab by file path
  const findExistingEditorTab = useCallback(
    (filePath: string): { groupId: string; tab: UnifiedTab } | null => {
      const api = dockviewApiRef.current;
      if (!api) return null;

      for (const group of api.groups) {
        const panels = group.panels;
        for (const panel of panels) {
          const tab = panel.params?.tab as UnifiedTab | undefined;
          if (tab && tab.kind === "editor" && tab.data.editor?.path === filePath) {
            return { groupId: group.id, tab };
          }
        }
      }
      return null;
    },
    []
  );

  // Wrap handleOpenFile to add tab to dockview
  const handleOpenFile = useCallback(
    async (entry: import("./types").FileTreeNode) => {
      if (!editorWorkspaceId || entry.type !== "file") return;

      const workspaceId = editorWorkspaceId;

      // Check if file is already open in tabs (single source of truth)
      const existing = findExistingEditorTab(entry.path);
      if (existing) {
        // File is already open, just activate the panel
        const api = dockviewApiRef.current;
        if (api) {
          const panel = api.getPanel(existing.tab.id);
          if (panel) {
            panel.api.setActive();
          }
        }
        // Also update workspace state activeFileId
        updateWorkspaceState(workspaceId, (s) => ({
          ...s,
          activeFileId: existing.tab.data.editor?.id ?? s.activeFileId,
        }));
        return;
      }

      // Check if file exists in workspace state but not in tabs
      const state = workspaceStates[workspaceId];
      const existingFile = state?.files.find((f) => f.path === entry.path);
      if (existingFile) {
        // File exists in workspace but not in tabs, create tab
        const tab = editorToTab(existingFile);
        updateWorkspaceState(workspaceId, (s) => ({
          ...s,
          activeFileId: existingFile.id,
        }));
        handleOpenTab(tab);
        return;
      }

      // New file - read and create
      try {
        const data = await readFile(workspaceId, entry.path);
        const newFile: EditorFile = {
          id: crypto.randomUUID(),
          name: entry.name,
          path: entry.path,
          language: getLanguageFromPath(entry.path),
          contents: data.contents,
          dirty: false,
        };

        // Add to workspace state
        updateWorkspaceState(workspaceId, (s) => ({
          ...s,
          files: [...s.files, newFile],
          activeFileId: newFile.id,
        }));

        // Create editor tab and add to dockview
        const tab = editorToTab(newFile);
        handleOpenTab(tab);
      } catch (error) {
        setStatusMessage(
          `ファイルを開けませんでした: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    [
      editorWorkspaceId,
      workspaceStates,
      updateWorkspaceState,
      handleOpenTab,
      setStatusMessage,
      findExistingEditorTab,
    ]
  );

  // Handler for adding server tab
  const handleAddServerTab = useCallback(() => {
    const tab = serverToTab();
    handleOpenTab(tab);
  }, [handleOpenTab]);

  // Handler for adding Remote Access tab
  const handleAddRemoteAccessTab = useCallback(() => {
    const tab = remoteAccessToTab();
    handleOpenTab(tab);
  }, [handleOpenTab]);

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
      isTauriApp();
    if (isDesktop) {
      checkForUpdates();
    }
  }, [checkForUpdates]);
  */

  // Check for updates after server is ready (desktop app only)
  useEffect(() => {
    if (!serverReady) return;
    const isDesktop = typeof window !== "undefined" &&
      isTauriApp();
    if (isDesktop) {
      // Check for updates on startup (desktop app)
      checkForUpdates().catch(() => {
        // Silently ignore update check failures
      });
    }
  }, [serverReady, checkForUpdates]);

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

  // Note: Auto-create tabs on initialization is now handled by dockview's
  // layout restoration system. When dockview is ready, it will load the
  // saved layout from localStorage.

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

  // Track which deck workspace trees we've loaded
  const deckWorkspaceTreesLoadedRef = useRef<Set<string>>(new Set());

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

  // Initialize workspace states for all deck workspace IDs when decks are loaded
  useEffect(() => {
    if (decks.length === 0) return;

    const deckWorkspaceIds = [...new Set(decks.map((d) => d.workspaceId))];
    initializeWorkspaceStates(deckWorkspaceIds);
  }, [decks, initializeWorkspaceStates]);

  // Load file tree for deck workspaces when deck tab is activated
  useEffect(() => {
    // Find the active tab from dockview API
    const api = dockviewApiRef.current;
    if (!api) return;

    const activePanel = api.activePanel;
    if (!activePanel) return;

    const tab = activePanel.params?.tab as UnifiedTab | undefined;
    if (!tab || tab.kind !== "deck" || !tab.data.deck) return;

    const deckWorkspaceId = tab.data.deck.workspaceId;
    if (!deckWorkspaceId) return;

    // Only load if we haven't loaded for this workspace yet
    if (!deckWorkspaceTreesLoadedRef.current.has(deckWorkspaceId)) {
      deckWorkspaceTreesLoadedRef.current.add(deckWorkspaceId);

      // Load file tree for this deck's workspace
      const abortController = new AbortController();

      updateWorkspaceState(deckWorkspaceId, (state) => ({
        ...state,
        treeLoading: true,
        treeError: null,
      }));

      listFiles(deckWorkspaceId, "")
        .then((entries) => {
          if (abortController.signal.aborted) return;
          updateWorkspaceState(deckWorkspaceId, (state) => ({
            ...state,
            tree: toTreeNodes(entries),
            treeLoading: false,
          }));
        })
        .catch((error: unknown) => {
          if (!abortController.signal.aborted) {
            updateWorkspaceState(deckWorkspaceId, (state) => ({
              ...state,
              treeLoading: false,
              treeError: error instanceof Error ? error.message : String(error),
            }));
          }
        });

      return () => abortController.abort();
    }
  }, [decks, updateWorkspaceState]);

  // Create a new deck with auto-generated name and workspace, then add tab
  const handleCreateDeckAndTab = useCallback(async () => {
    if (workspaces.length === 0) {
      setStatusMessage(MESSAGE_WORKSPACE_REQUIRED);
      return;
    }

    // Use active workspace or first workspace
    const workspaceId = editorWorkspaceId || workspaces[0].id;

    // Calculate next deck number
    const workspaceDecks = decks.filter((d) => d.workspaceId === workspaceId);
    const existingNumbers = workspaceDecks
      .map((d) => {
        const match = d.name.match(/^Deck\s+(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const deckName = `Deck ${maxNumber + 1}`;

    const deck = await handleCreateDeck(deckName, workspaceId);
    if (deck) {
      const tab = deckToTab(deck);
      handleOpenTab(tab);
    }
  }, [workspaces, editorWorkspaceId, decks, handleCreateDeck, setStatusMessage, handleOpenTab]);

  const handleSaveSettings = useCallback(
    async (settings: {
      port: number;
      basicAuthEnabled: boolean;
      basicAuthUser: string;
      basicAuthPassword: string;
      remoteAccessAutoStart?: boolean;
    }) => {
      const abortController = new AbortController();
      try {
        // Persist Desktop-only settings (best-effort).
        const isTauri = typeof window !== "undefined" && isTauriApp();
        if (isTauri && typeof settings.remoteAccessAutoStart === "boolean") {
          try {
            const tauri = await import("@tauri-apps/api/core");
            await tauri.invoke("set_remote_access_settings", {
              auto_start: settings.remoteAccessAutoStart,
            });
          } catch (e) {
            console.warn("[settings] failed to save remote access settings:", e);
          }
        }

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

  const handleOpenWorkspaceModal = useCallback(async () => {
    const isTauri = typeof window !== "undefined" && isTauriApp();

    if (isTauri) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: true,
          multiple: false,
          title: "ワークスペースとして開くフォルダを選択",
        });
        if (selected && typeof selected === "string") {
          await handleCreateWorkspace(selected);
        }
      } catch (error) {
        console.error("Failed to open folder dialog:", error);
      }
    } else {
      // Web: Create file input element
      const input = document.createElement("input");
      input.type = "file";
      input.webkitdirectory = true;
      input.multiple = true;
      input.style.display = "none";

      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const firstFile = files[0];
          const path = firstFile.webkitRelativePath.split("/").slice(0, -1).join("/");
          const selectedPath = path || firstFile.name;
          await handleCreateWorkspace(selectedPath);
        }
        document.body.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();
    }
  }, [handleCreateWorkspace]);

  const handleNewTerminalForDeck = useCallback(
    async (deckId: string, commandOrShellId?: string) => {
      console.log(
        "[App] handleNewTerminalForDeck called with deckId:",
        deckId,
        "commandOrShellId:",
        commandOrShellId
      );
      const deckState = deckStates[deckId] || defaultDeckState;
      console.log("[App] deckState:", deckState);
      console.log("[App] terminals count:", deckState.terminals.length);

      // Determine if this is a shellId or command
      // shellId is typically "claude", "codex", etc.
      // command is typically a shell command string
      const isShellId = commandOrShellId && ["claude", "codex", "bash", "zsh", "pwsh", "powershell"].includes(commandOrShellId);

      const terminal = await handleCreateTerminal(
        deckId,
        deckState.terminals.length,
        isShellId ? commandOrShellId : undefined,
        isShellId ? undefined : commandOrShellId,
        undefined
      );
      if (terminal) {
        // Create and add terminal tab
        const deck = decks.find((d) => d.id === deckId);
        if (deck) {
          const tab = terminalToTab(
            { id: terminal.id, command: terminal.command || "", cwd: deck.root },
            deckId
          );
          handleOpenTab(tab);
        }
      }
    },
    [deckStates, defaultDeckState, handleCreateTerminal, decks, handleOpenTab]
  );

  const handleNewClaudeTerminalForDeck = useCallback(
    async (deckId: string) => {
      handleNewTerminalForDeck(deckId, "claude");
    },
    [handleNewTerminalForDeck]
  );

  const handleNewCodexTerminalForDeck = useCallback(
    async (deckId: string) => {
      handleNewTerminalForDeck(deckId, "codex");
    },
    [handleNewTerminalForDeck]
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

  // Handle tab double-click (for renaming decks)
  // Note: This will be called from dockview panel components
  const handleTabDoubleClick = useCallback(
    (tab: import("./types").UnifiedTab) => {
      if (tab.kind === "deck" && tab.data.deck) {
        const newName = prompt("デッキ名:", tab.title);
        if (newName && newName.trim() !== "" && newName !== tab.title) {
          handleRenameDeck(tab.data.deck.id, newName.trim());
          // Update the tab title in panel params
          const api = dockviewApiRef.current;
          if (api) {
            const panel = api.getPanel(tab.id);
            if (panel) {
              // Update the tab title in params
              const updatedTab = { ...tab, title: newName.trim() };
              panel.api.updateParameters({ tab: updatedTab });
            }
          }
        }
      }
    },
    [handleRenameDeck]
  );

  // Check if welcome screen should be shown
  const showWelcomeScreen = workspaces.length === 0 && decks.length === 0;

  // Show startup screen first
  if (!serverReady) {
    return <ServerStartupScreen onComplete={() => setServerReady(true)} />;
  }

  return (
    <div className="app">
      <TitleBar
        workspaces={workspaces}
        activeWorkspaceId={editorWorkspaceId}
        onSelectWorkspace={setEditorWorkspaceId}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenServerModal={() => setIsServerModalOpen(true)}
        onToggleContextStatus={() => setShowContextStatus((prev) => !prev)}
        onOpenWorkspaceModal={handleOpenWorkspaceModal}
        onCreateDeck={handleCreateDeckAndTab}
        onCreateAgent={() => {
          /* TODO: Implement agent creation */
        }}
        onNewTerminal={() => {
          console.log("[App] New Terminal requested");
          console.log("[App] activeDeckIds:", activeDeckIds);
          console.log("[App] decks:", decks);
          // Create a new terminal in the first available deck
          const firstDeckId = activeDeckIds[0];
          if (firstDeckId) {
            console.log("[App] Using activeDeckId:", firstDeckId);
            handleNewTerminalForDeck(firstDeckId);
          } else if (decks.length > 0) {
            console.log("[App] Using first deck:", decks[0].id);
            handleNewTerminalForDeck(decks[0].id);
          } else {
            // Create a new deck if none exists
            console.log("[App] No deck found, creating new deck");
            handleCreateDeckAndTab();
          }
        }}
        onAddServerTab={handleAddServerTab}
        onAddRemoteAccessTab={handleAddRemoteAccessTab}
        onDeleteWorkspace={handleDeleteWorkspace}
        onUpdateWorkspaceColor={handleUpdateWorkspaceColor}
      />
      <main className="main">
        <DockviewLayout
          workspaceStates={workspaceStates}
          updateWorkspaceState={handleUpdateWorkspaceState}
          decks={decks}
          deckStates={deckStates}
          activeDeckIds={activeDeckIds}
          gitFiles={gitState.status?.files ? { [editorWorkspaceId || ""]: gitState.status.files } : {}}
          onToggleDir={(wsId, node) => {
            if (editorWorkspaceId === wsId) {
              handleToggleDir(node);
            }
          }}
          onOpenFile={(wsId, node) => {
            if (editorWorkspaceId === wsId) {
              handleOpenFile(node);
            }
          }}
          onRefreshTree={(wsId) => {
            // handleRefreshTree is called without arguments
            handleRefreshTree();
          }}
          onCreateFile={(wsId, path) => {
            if (editorWorkspaceId === wsId) {
              // path is expected to be full path, but handleCreateFile expects parentPath and fileName
              const parts = path.split("/");
              const fileName = parts[parts.length - 1] || "";
              const parentPath = parts.slice(0, -1).join("/");
              handleCreateFile(parentPath, fileName);
            }
          }}
          onCreateDirectory={(wsId, path) => {
            if (editorWorkspaceId === wsId) {
              // path is expected to be full path, but handleCreateDirectory expects parentPath and dirName
              const parts = path.split("/");
              const dirName = parts[parts.length - 1] || "";
              const parentPath = parts.slice(0, -1).join("/");
              handleCreateDirectory(parentPath, dirName);
            }
          }}
          onDeleteFile={(wsId, path) => {
            if (editorWorkspaceId === wsId) {
              handleDeleteFile(path);
            }
          }}
          onDeleteDirectory={(wsId, path) => {
            if (editorWorkspaceId === wsId) {
              handleDeleteDirectory(path);
            }
          }}
          onChangeFile={handleFileChange}
          onSaveFile={handleSaveFile}
          savingFileId={savingFileId}
          wsBase={wsBase}
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
            // Terminal reordering is handled internally
          }}
          onCreateTerminal={(deckId, command) => {
            // command is optional string parameter
            handleNewTerminalForDeck(deckId, command);
          }}
          openTab={handleOpenTab}
          className="dockview-theme-side"
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
        remoteAccessControl={<RemoteAccessControl />}
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
