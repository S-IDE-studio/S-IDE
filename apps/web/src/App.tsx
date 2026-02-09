import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getConfig, getWsBase, listFiles, readFile } from "./api";
import { CommonSettings } from "./components/AgentSettings";
import { ContextStatus } from "./components/ContextStatus";
import { DiffViewer } from "./components/DiffViewer";
import { EnvironmentModal } from "./components/EnvironmentModal";
import { GlobalStatusBar } from "./components/GlobalStatusBar";
import { MemoizedGridView } from "./components/grid/GridView";
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
  GridLocation,
  GridNode,
  GridState,
  PanelGroup,
  SidebarPanel,
  SplitDirection,
  TabContextMenuAction,
  UnifiedTab,
  WorkspaceMode,
} from "./types";
import { getLanguageFromPath, toTreeNodes } from "./utils";
import { createEditorGroup, createSingleGroupLayout } from "./utils/editorGroupUtils";
import {
  addViewToGrid,
  createGridState,
  findLeafByGroupId,
  findNearestSiblingLeaf,
  generateGridLeafId,
  getAllLeaves,
  migrateToGridState,
  removeViewFromGrid,
} from "./utils/gridUtils";
import { createEmptyDeckState, createEmptyWorkspaceState } from "./utils/stateUtils";
import {
  agentToTab,
  deckToTab,
  editorToTab,
  remoteAccessToTab,
  serverToTab,
  terminalToTab,
} from "./utils/unifiedTabUtils";
import { loadTabState, parseUrlState, saveTabState } from "./utils/urlUtils";

export default function App() {
  const initialUrlState = parseUrlState();

  // Initialize panel state from localStorage (grid format only)
  const getInitialState = () => {
    const saved = loadTabState();
    if (saved) {
      if (saved.format === "grid") {
        // Ensure panelGroupsMap has entries for all leaf nodes in gridState
        const { gridState, panelGroupsMap: savedPanelGroupsMap } = saved;
        const panelGroupsMap: Record<string, PanelGroup> = { ...savedPanelGroupsMap };

        // Helper function to ensure all leaf nodes have panel group entries
        const ensurePanelGroupsForLeaves = (node: GridNode): void => {
          if (node.type === "leaf") {
            if (!panelGroupsMap[node.groupId]) {
              panelGroupsMap[node.groupId] = {
                id: node.groupId,
                tabs: [],
                activeTabId: null,
                focused: false,
                percentage: node.size,
              };
            }
          } else {
            node.children.forEach(ensurePanelGroupsForLeaves);
          }
        };

        ensurePanelGroupsForLeaves(gridState.root);

        return {
          gridState,
          panelGroupsMap,
          focusedPanelGroupId: null,
        };
      }
      // Migrate old format to grid format
      const gridState = migrateToGridState(saved.panelGroups, saved.panelLayout);
      const panelGroupsMap = Object.fromEntries(saved.panelGroups.map((g) => [g.id, g]));
      return {
        gridState,
        panelGroupsMap,
        focusedPanelGroupId: null,
      };
    }
    // Create default empty grid state
    const gridState = createGridState();
    const panelGroupsMap: Record<string, PanelGroup> = {
      [gridState.root.type === "leaf" ? gridState.root.groupId : ""]: {
        id: gridState.root.type === "leaf" ? gridState.root.groupId : "",
        tabs: [],
        activeTabId: null,
        focused: false,
        percentage: 100,
      },
    };
    return {
      gridState,
      panelGroupsMap,
      focusedPanelGroupId: null,
    };
  };

  const initialState = getInitialState();

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

  // Grid-based panel state (VSCode-style 2D grid)
  const [gridState, setGridState] = useState<GridState>(initialState.gridState);
  const [panelGroupsMap, setPanelGroupsMap] = useState<Record<string, PanelGroup>>(
    initialState.panelGroupsMap
  );
  const [focusedPanelGroupId, setFocusedPanelGroupId] = useState<string | null>(
    initialState.focusedPanelGroupId
  );

  // Save tab state to localStorage when panels change
  useEffect(() => {
    if (gridState && panelGroupsMap) {
      // Save grid format
      const serializedMap = Object.fromEntries(
        Object.entries(panelGroupsMap)
          .map(([id, g]) => {
            const tabs = g.tabs.filter((t) => !t.synced);
            return [id, { ...g, tabs }] as const;
          })
          .filter(([_, g]) => g.tabs.length > 0)
      ) as Record<string, PanelGroup>;
      saveTabState(gridState, serializedMap);
    }
  }, [gridState, panelGroupsMap]);

  const { workspaceStates, setWorkspaceStates, updateWorkspaceState, initializeWorkspaceStates } =
    useWorkspaceContext();
  const { deckStates, setDeckStates, updateDeckState, initializeDeckStates } = useDeckContext();

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

  // Grid-based panel handlers

  // Get panelGroups array derived from gridState + panelGroupsMap
  const panelGroups = useMemo(() => {
    if (!gridState || !panelGroupsMap) return [];
    const leaves = getAllLeaves(gridState);
    return leaves.map(([location, leaf]) => ({
      ...panelGroupsMap[leaf.groupId],
      percentage: leaf.size,
    }));
  }, [gridState, panelGroupsMap]);

  // Multi-device sync: union open tabs across clients.
  // Synced tabs are mirrored (not persisted, not re-advertised) and disappear when no clients have them open.
  useTabsPresenceSync({
    enabled: true,
    panelGroups,
    panelGroupsMap,
    setPanelGroupsMap,
    workspaceStates,
  });

  const handleSelectTab = useCallback((groupId: string, tabId: string) => {
    setPanelGroupsMap((prev) => {
      const updated: Record<string, PanelGroup> = {};
      for (const [id, group] of Object.entries(prev)) {
        // Promote a synced tab to local when the user selects it (so it becomes "owned" by this client).
        const tabs =
          id === groupId
            ? group.tabs.map((t) => (t.id === tabId && t.synced ? { ...t, synced: false } : t))
            : group.tabs;
        updated[id] = {
          ...group,
          tabs,
          activeTabId: id === groupId ? tabId : group.activeTabId,
          focused: id === groupId,
        };
      }
      return updated;
    });
    setFocusedPanelGroupId(groupId);
  }, []);

  const handleCloseTab = useCallback((groupId: string, tabId: string) => {
    setPanelGroupsMap((prev) => {
      const group = prev[groupId];
      if (!group) return prev;

      const newTabs = group.tabs.filter((t) => t.id !== tabId);
      const newActiveTabId =
        group.activeTabId === tabId ? (newTabs[0]?.id ?? null) : group.activeTabId;

      return {
        ...prev,
        [groupId]: {
          ...group,
          tabs: newTabs,
          activeTabId: newActiveTabId,
        },
      };
    });
  }, []);

  const handleFocusPanel = useCallback((groupId: string) => {
    setPanelGroupsMap((prev) => {
      const updated: Record<string, PanelGroup> = {};
      for (const [id, group] of Object.entries(prev)) {
        updated[id] = {
          ...group,
          focused: id === groupId,
        };
      }
      return updated;
    });
    setFocusedPanelGroupId(groupId);
  }, []);

  const handleTabsReorder = useCallback((groupId: string, oldIndex: number, newIndex: number) => {
    setPanelGroupsMap((prev) => {
      const group = prev[groupId];
      if (!group) return prev;

      const newTabs = [...group.tabs];
      const [removed] = newTabs.splice(oldIndex, 1);
      newTabs.splice(newIndex, 0, removed);

      return {
        ...prev,
        [groupId]: {
          ...group,
          tabs: newTabs,
        },
      };
    });
  }, []);

  const handleTabMove = useCallback(
    (tabId: string, sourceGroupId: string, targetGroupId: string) => {
      if (sourceGroupId === targetGroupId) return;

      setPanelGroupsMap((prev) => {
        const sourceGroup = prev[sourceGroupId];
        const targetGroup = prev[targetGroupId];
        if (!sourceGroup || !targetGroup) return prev;

        const tab = sourceGroup.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;

        const newSourceTabs = sourceGroup.tabs.filter((t) => t.id !== tabId);
        const newSourceActiveTabId =
          sourceGroup.activeTabId === tabId
            ? (newSourceTabs[0]?.id ?? null)
            : sourceGroup.activeTabId;

        return {
          ...prev,
          [sourceGroupId]: {
            ...sourceGroup,
            tabs: newSourceTabs,
            activeTabId: newSourceActiveTabId,
          },
          [targetGroupId]: {
            ...targetGroup,
            tabs: [...targetGroup.tabs, tab],
            activeTabId: tab.id,
            focused: true,
          },
        };
      });

      setFocusedPanelGroupId(targetGroupId);
    },
    []
  );

  // Panel split handler - returns the new panel ID
  const handleSplitPanel = useCallback(
    (groupId: string, direction: SplitDirection, activeTabId?: string): string => {
      let newPanelId = "";

      setGridState((prevGridState) => {
        if (!prevGridState) return prevGridState;

        // Find the location of the group to split
        const location = findLeafByGroupId(prevGridState, groupId)?.[0];
        if (!location) return prevGridState;

        // Determine where to insert the new view based on direction
        let insertLocation: GridLocation;
        if (direction === "left" || direction === "up") {
          insertLocation = location;
        } else {
          // For right/down, insert after current location
          insertLocation = [...location.slice(0, -1), (location[location.length - 1] ?? 0) + 1];
        }

        // Create new panel group for the new leaf
        const newGroupId = generateGridLeafId();
        newPanelId = newGroupId;

        // Add the new view to the grid
        const newGridState = addViewToGrid(prevGridState, newGroupId, insertLocation, direction);

        // Update panel groups map with the new group
        setPanelGroupsMap((prevMap) => {
          const tabToCopy =
            activeTabId && prevMap?.[groupId]?.tabs.find((t) => t.id === activeTabId);
          const newGroup: PanelGroup = tabToCopy
            ? {
                id: newGroupId,
                tabs: [{ ...tabToCopy }],
                activeTabId: activeTabId,
                focused: false,
                percentage: 50,
              }
            : {
                id: newGroupId,
                tabs: [],
                activeTabId: null,
                focused: false,
                percentage: 50,
              };

          return {
            ...(prevMap || {}),
            [newGroupId]: newGroup,
            [groupId]: {
              ...(prevMap?.[groupId] || {
                id: groupId,
                tabs: [],
                activeTabId: null,
                focused: false,
                percentage: 50,
              }),
              percentage: 50,
            },
          };
        });

        return newGridState;
      });

      return newPanelId;
    },
    []
  );

  // Grid-based tab drop handler
  const handleTabDrop = useCallback(
    (tabId: string, sourceGroupId: string, location: GridLocation, direction: SplitDirection) => {
      // Find the tab in the source group
      const sourceGroup = panelGroupsMap[sourceGroupId];
      if (!sourceGroup) return;

      const tab = sourceGroup.tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Create a new panel via split with the tab
      handleSplitPanel(sourceGroupId, direction, tabId);
    },
    [panelGroupsMap, handleSplitPanel]
  );

  // Panel close handler
  const handleClosePanel = useCallback(
    (groupId: string) => {
      setGridState((prevGridState) => {
        if (!prevGridState) return prevGridState;

        // Find the location of the group to close
        const leafInfo = findLeafByGroupId(prevGridState, groupId);
        if (!leafInfo) return prevGridState;

        const [location] = leafInfo;

        // Find nearest sibling for focus transfer before closing
        const nearestSibling = findNearestSiblingLeaf(prevGridState, location);
        const newFocusedGroupId = nearestSibling?.[1].groupId ?? null;

        // Remove the view from the grid
        const newGridState = removeViewFromGrid(prevGridState, location);

        // Update panel groups map - remove the closed group
        setPanelGroupsMap((prevMap) => {
          if (!prevMap) return prevMap;
          const newMap = { ...prevMap };
          delete newMap[groupId];

          // Update focus to nearest sibling if the closed panel was focused
          if (groupId === focusedPanelGroupId && newFocusedGroupId) {
            newMap[newFocusedGroupId] = {
              ...newMap[newFocusedGroupId],
              focused: true,
            };
          }

          return newMap;
        });

        // Update focused panel group ID if needed
        if (groupId === focusedPanelGroupId) {
          setFocusedPanelGroupId(newFocusedGroupId);
        }

        return newGridState;
      });
    },
    [focusedPanelGroupId]
  );

  // Panel layout change handler (called by GridView on resize)
  const handleGridLayoutChange = useCallback((newGridNode: GridNode) => {
    setGridState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        root: newGridNode,
      };
    });
  }, []);

  // Panel resize handler (called by GridLeafNode on resize)
  const handlePanelResize = useCallback((groupId: string, width: number, height: number) => {
    // GridView handles layout, this is for tracking if needed
  }, []);

  // Context menu action handler
  const handleContextMenuAction = useCallback(
    (action: TabContextMenuAction, groupId: string, tabId: string) => {
      setPanelGroupsMap((prev) => {
        const group = prev[groupId];
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

        return {
          ...prev,
          [groupId]: {
            ...group,
            tabs: newTabs,
            activeTabId: newActiveTabId,
          },
        };
      });
    },
    [handleSplitPanel]
  );

  // Helper function to find existing editor tab by file path
  const findExistingEditorTab = useCallback(
    (filePath: string): { groupId: string; tab: UnifiedTab } | null => {
      if (!panelGroupsMap) return null;
      for (const [groupId, group] of Object.entries(panelGroupsMap)) {
        const tab = group.tabs.find((t) => t.kind === "editor" && t.data.editor?.path === filePath);
        if (tab) {
          return { groupId, tab };
        }
      }
      return null;
    },
    [panelGroupsMap]
  );

  // Tab population helpers
  const addTabToPanel = useCallback(
    (
      tab: UnifiedTab,
      targetGroupId?: string,
      options?: { skipIfExists?: boolean; activateOnly?: boolean }
    ) => {
      setPanelGroupsMap((prev) => {
        if (!prev || Object.keys(prev).length === 0) {
          // Create initial panel group if none exists
          const newGroupId = generateGridLeafId();
          const newGridState = createGridState(newGroupId);
          setGridState(newGridState);
          return {
            [newGroupId]: {
              id: newGroupId,
              tabs: [tab],
              activeTabId: tab.id,
              focused: true,
              percentage: 100,
            },
          };
        }

        // For editor tabs, check if already exists to prevent duplicates
        if (tab.kind === "editor" && tab.data.editor) {
          const filePath = tab.data.editor.path;
          for (const [groupId, group] of Object.entries(prev)) {
            const existingTab = group.tabs.find(
              (t) => t.kind === "editor" && t.data.editor?.path === filePath
            );
            if (existingTab) {
              // File already open, just activate it
              if (options?.skipIfExists) {
                return prev; // No changes
              }
              return {
                ...prev,
                [groupId]: { ...group, activeTabId: existingTab.id, focused: true },
              };
            }
          }
        }

        // Determine target group
        let actualTargetGroupId = targetGroupId;
        if (!actualTargetGroupId) {
          actualTargetGroupId = focusedPanelGroupId || Object.keys(prev)[0];
        }

        if (!actualTargetGroupId || !prev[actualTargetGroupId]) {
          actualTargetGroupId = Object.keys(prev)[0];
        }

        if (!actualTargetGroupId) return prev;

        // Add tab to target group and unfocus others
        const updated: Record<string, PanelGroup> = {};
        for (const [groupId, group] of Object.entries(prev)) {
          if (groupId === actualTargetGroupId) {
            updated[groupId] = {
              ...group,
              tabs: [...group.tabs, tab],
              activeTabId: tab.id,
              focused: true,
            };
          } else {
            updated[groupId] = { ...group, focused: false };
          }
        }

        return updated;
      });
    },
    [focusedPanelGroupId]
  );

  // Wrap handleOpenFile to add tab to panel
  const handleOpenFile = useCallback(
    async (entry: import("./types").FileTreeNode) => {
      if (!editorWorkspaceId || entry.type !== "file") return;

      const workspaceId = editorWorkspaceId;

      // Check if file is already open in tabs (single source of truth)
      const existing = findExistingEditorTab(entry.path);
      if (existing) {
        // File is already open, just activate the tab
        handleSelectTab(existing.groupId, existing.tab.id);
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
        addTabToPanel(tab);
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

        // Create editor tab
        const tab = editorToTab(newFile);

        // Get current panel count from grid state
        const currentPanelCount = gridState ? getAllLeaves(gridState).length : 1;

        // Auto-split panel if only one panel exists (for Deck file opening)
        if (currentPanelCount === 1) {
          // Find the current group ID
          const leaves = gridState ? getAllLeaves(gridState) : [];
          const currentGroupId = leaves[0]?.[1].groupId;

          if (currentGroupId) {
            // Split to create new panel
            const newGroupId = handleSplitPanel(currentGroupId, "right");
            // Add tab to the new right panel
            addTabToPanel(tab, newGroupId);
            return;
          }
        }

        // Add editor tab to existing panel
        addTabToPanel(tab);
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
      gridState,
      handleSelectTab,
      addTabToPanel,
      setStatusMessage,
      findExistingEditorTab,
      handleSplitPanel,
    ]
  );

  // Handler for adding server tab
  const handleAddServerTab = useCallback(() => {
    const tab = serverToTab();
    addTabToPanel(tab);
  }, [addTabToPanel]);

  // Handler for adding Remote Access tab
  const handleAddRemoteAccessTab = useCallback(() => {
    const tab = remoteAccessToTab();
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

    setPanelGroupsMap((currentMap) => {
      const firstGroupId = Object.keys(currentMap)[0];
      if (!firstGroupId) return currentMap;

      const group = currentMap[firstGroupId];

      // Collect all existing tab IDs
      const existingAgentIds = group.tabs
        .filter((t) => t.kind === "agent")
        .map((t) => t.data.agent?.id);

      const newTabs: typeof group.tabs = [...group.tabs];

      // Add agents that don't exist
      agents.forEach((agent) => {
        if (!existingAgentIds.includes(agent.id)) {
          newTabs.push(agentToTab(agent));
        }
      });

      // Set first tab as active if no active tab
      const activeTabId = group.activeTabId || (newTabs.length > 0 ? newTabs[0].id : null);

      return {
        ...currentMap,
        [firstGroupId]: {
          ...group,
          tabs: newTabs,
          activeTabId,
        },
      };
    });

    // Mark initial setup as done
    initialPanelSetupDoneRef.current = true;
  }, [agents]); // Run when agents are loaded

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

  // Auto-create tabs on initialization when panelGroupsMap is empty but decks exist
  // This follows VSCode's approach where editors are opened during initialization flow
  useEffect(() => {
    // Only run when:
    // 1. No tabs exist in any panel group
    // 2. Decks have been loaded from API
    // 3. Grid state has a valid leaf node
    const hasAnyTabs = Object.values(panelGroupsMap).some((g) => g.tabs.length > 0);
    if (hasAnyTabs || decks.length === 0 || !gridState || gridState.root.type !== "leaf") {
      return;
    }

    // Create tabs for active decks, or first deck if no active decks
    const deckIdsToOpen = activeDeckIds.length > 0 ? activeDeckIds : decks[0] ? [decks[0].id] : [];

    // Get the existing groupId from gridState
    const existingGroupId = gridState.root.groupId;

    // Create tabs for decks
    const tabs: UnifiedTab[] = [];
    for (const deckId of deckIdsToOpen) {
      const deck = decks.find((d) => d.id === deckId);
      if (deck) {
        tabs.push(deckToTab(deck));
      }
    }

    if (tabs.length > 0) {
      // Update panelGroupsMap with the existing groupId from gridState
      setPanelGroupsMap({
        [existingGroupId]: {
          id: existingGroupId,
          tabs,
          activeTabId: tabs[0].id,
          focused: true,
          percentage: 100,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks, activeDeckIds]); // Only depend on decks and activeDeckIds

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
    // Find the active tab across all panel groups
    const groups = Object.values(panelGroupsMap);
    const activeGroup = groups.find((g) => g.focused) || groups[0];
    if (!activeGroup || !activeGroup.activeTabId) return;

    const activeTab = activeGroup.tabs.find((t) => t.id === activeGroup.activeTabId);
    if (!activeTab || activeTab.kind !== "deck" || !activeTab.data.deck) return;

    const deckWorkspaceId = activeTab.data.deck.workspaceId;
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
  }, [panelGroupsMap, decks, updateWorkspaceState]);

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
      addTabToPanel(tab);
    }
  }, [workspaces, editorWorkspaceId, decks, handleCreateDeck, setStatusMessage, addTabToPanel]);

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
        const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
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
    const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

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
    async (deckId: string, shellId?: string) => {
      console.log(
        "[App] handleNewTerminalForDeck called with deckId:",
        deckId,
        "shellId:",
        shellId
      );
      const deckState = deckStates[deckId] || defaultDeckState;
      console.log("[App] deckState:", deckState);
      console.log("[App] terminals count:", deckState.terminals.length);
      const terminal = await handleCreateTerminal(
        deckId,
        deckState.terminals.length,
        undefined,
        undefined,
        shellId
      );
      if (terminal) {
        // Create and add terminal tab
        const deck = decks.find((d) => d.id === deckId);
        if (deck) {
          const tab = terminalToTab(
            { id: terminal.id, command: terminal.command || "", cwd: deck.root },
            deckId
          );
          addTabToPanel(tab);
        }
      }
    },
    [deckStates, defaultDeckState, handleCreateTerminal, decks, addTabToPanel]
  );

  const handleNewClaudeTerminalForDeck = useCallback(
    async (deckId: string) => {
      const deckState = deckStates[deckId] || defaultDeckState;
      const terminal = await handleCreateTerminal(
        deckId,
        deckState.terminals.length,
        "claude",
        "Claude Code"
      );
      if (terminal) {
        const deck = decks.find((d) => d.id === deckId);
        if (deck) {
          const tab = terminalToTab(
            { id: terminal.id, command: terminal.command || "", cwd: deck.root },
            deckId
          );
          addTabToPanel(tab);
        }
      }
    },
    [deckStates, defaultDeckState, handleCreateTerminal, decks, addTabToPanel]
  );

  const handleNewCodexTerminalForDeck = useCallback(
    async (deckId: string) => {
      const deckState = deckStates[deckId] || defaultDeckState;
      const terminal = await handleCreateTerminal(
        deckId,
        deckState.terminals.length,
        "codex",
        "Codex"
      );
      if (terminal) {
        const deck = decks.find((d) => d.id === deckId);
        if (deck) {
          const tab = terminalToTab(
            { id: terminal.id, command: terminal.command || "", cwd: deck.root },
            deckId
          );
          addTabToPanel(tab);
        }
      }
    },
    [deckStates, defaultDeckState, handleCreateTerminal, decks, addTabToPanel]
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
  const handleTabDoubleClick = useCallback(
    (tab: import("./types").UnifiedTab) => {
      if (tab.kind === "deck" && tab.data.deck) {
        const newName = prompt("デッキ名:", tab.title);
        if (newName && newName.trim() !== "" && newName !== tab.title) {
          handleRenameDeck(tab.data.deck.id, newName.trim());
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
        {gridState && panelGroupsMap && (
          <MemoizedGridView
            rootNode={gridState.root}
            orientation={gridState.orientation}
            panelGroups={panelGroupsMap}
            width={window.innerWidth}
            height={window.innerHeight}
            onLayoutChange={handleGridLayoutChange}
            onPanelResize={handlePanelResize}
            onTabDrop={handleTabDrop}
            focusedPanelGroupId={focusedPanelGroupId}
            onFocusPanel={handleFocusPanel}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onTabsReorder={handleTabsReorder}
            onTabMove={handleTabMove}
            onSplitPanel={handleSplitPanel}
            onClosePanel={handleClosePanel}
            onContextMenuAction={handleContextMenuAction}
            onTabDoubleClick={handleTabDoubleClick}
            isDragging={false}
            draggedTabId={null}
            activeDeckIds={activeDeckIds}
            decks={decks}
            workspaceStates={workspaceStates}
            gitFiles={gitState.status?.files}
            onToggleDir={handleToggleDir}
            onOpenFile={handleOpenFile}
            onRefreshTree={handleRefreshTree}
            onCreateFile={handleCreateFile}
            onCreateDirectory={handleCreateDirectory}
            onDeleteFile={handleDeleteFile}
            onDeleteDirectory={handleDeleteDirectory}
            updateWorkspaceState={updateWorkspaceState}
            deckStates={deckStates}
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
            onDeckViewChange={(deckId, view) => {
              updateDeckState(deckId, (state) => ({ ...state, view }));
            }}
            onChangeFile={handleFileChange}
            onSaveFile={handleSaveFile}
            savingFileId={savingFileId}
          />
        )}
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
