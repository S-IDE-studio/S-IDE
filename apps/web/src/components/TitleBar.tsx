import {
  ChevronDown,
  Menu,
  Minus,
  Palette,
  Plus,
  Smartphone,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getAvailableShells } from "../api";
import type { Deck, ShellInfo, UnifiedTab, Workspace } from "../types";
import { computeVisibleMenuCount } from "../utils/layoutCompaction";
import {
  agentConfigLocalToTab,
  agentConfigToTab,
  agentStatusToTab,
  agentToTab,
  deckToTab,
  mcpToTab,
  remoteAccessToTab,
  serverSettingsToTab,
  serverToTab,
  setupToTab,
  workspaceToTab,
} from "../utils/unifiedTabUtils";

const MAX_VISIBLE_WORKSPACES = 5;

// Check if running in Tauri (Tauri v2 uses __TAURI_INTERNALS__)
// This must be evaluated at runtime, not at module load time
function isTauriApp(): boolean {
  return (
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

// Accent color options for workspaces
const ACCENT_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan,
  "#6366f1", // indigo
];

interface TitleBarProps {
  workspaces?: Workspace[];
  activeWorkspaceId?: string | null;
  onSelectWorkspace?: (workspaceId: string) => void;
  onOpenSettings?: () => void;
  onOpenServerModal?: () => void;
  onToggleContextStatus?: () => void;
  onOpenWorkspaceModal?: () => void;
  onCreateDeck?: () => void;
  onCreateAgent?: () => void;
  onNewTerminal?: (shellId?: string) => void;
  onAddServerTab?: () => void;
  onAddRemoteAccessTab?: () => void;
  onDeleteWorkspace?: (workspaceId: string) => void;
  onUpdateWorkspaceColor?: (workspaceId: string, color: string) => void;
  // Panel menu props - accept flexible agent type
  agents?: Array<{
    id: string;
    name: string;
    icon: string;
    description?: string;
    enabled?: boolean;
  }>;
  decks?: Deck[];
  onOpenPanel?: (tab: UnifiedTab) => void;
  isMobileMode?: boolean;
  onToggleMobileMode?: () => void;
}

interface MenuItem {
  label: string;
  action?: () => void;
  children?: MenuItem[];
  separator?: boolean; // Add visual separator before this item
}

interface MenuBarProps {
  items: MenuItem[];
  maxWidth?: number;
  useHamburger?: boolean;
}

function MenuBar({ items, maxWidth, useHamburger = false }: MenuBarProps) {
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const measureButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const overflowMeasureRef = useRef<HTMLButtonElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuWidths, setMenuWidths] = useState<number[]>([]);
  const [overflowButtonWidth, setOverflowButtonWidth] = useState<number>(44);

  const closeMenu = useCallback(() => {
    setOpenMenuKey(null);
    setOpenSubmenuIndex(null);
  }, []);

  const handleMenuMouseEnter = useCallback((menuKey: string) => {
    // Clear any pending close timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpenMenuKey(menuKey);
    setOpenSubmenuIndex(null);
  }, []);

  const handleMenuMouseLeave = useCallback(() => {
    // Delay closing to allow moving to dropdown or submenu
    timeoutRef.current = setTimeout(() => {
      setOpenMenuKey(null);
      setOpenSubmenuIndex(null);
    }, 300);
  }, []);

  const handleDropdownMouseEnter = useCallback(() => {
    // Cancel the close timeout when entering dropdown
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleSubmenuMouseEnter = useCallback((submenuIndex: number) => {
    console.log("[MenuBar] Submenu mouse enter:", submenuIndex);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpenSubmenuIndex(submenuIndex);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuKey !== null && rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenMenuKey(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openMenuKey !== null) {
        setOpenMenuKey(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenuKey]);

  useLayoutEffect(() => {
    const nextWidths = items.map((_, index) => {
      const button = measureButtonRefs.current[index];
      return button ? Math.ceil(button.getBoundingClientRect().width) : 0;
    });
    setMenuWidths(nextWidths);
    if (overflowMeasureRef.current) {
      setOverflowButtonWidth(Math.ceil(overflowMeasureRef.current.getBoundingClientRect().width));
    }
  }, [items]);

  const visibleMenuCount = useMemo(() => {
    if (useHamburger) {
      return 0;
    }
    if (!maxWidth || maxWidth <= 0) {
      return items.length;
    }
    return computeVisibleMenuCount(menuWidths, maxWidth, overflowButtonWidth);
  }, [items.length, maxWidth, menuWidths, overflowButtonWidth, useHamburger]);

  const visibleItems = items.slice(0, visibleMenuCount);
  const overflowItems = items.slice(visibleMenuCount);

  const renderDropdownItems = useCallback(
    (menuChildren: MenuItem[]) => (
      <div className="title-bar-dropdown" onMouseEnter={handleDropdownMouseEnter}>
        {menuChildren.map((child, childIndex) => {
          if (child.separator) {
            return <div key={childIndex} className="title-bar-dropdown-separator" />;
          }

          if (child.label.startsWith("===")) {
            return (
              <div key={childIndex} className="title-bar-dropdown-category">
                {child.label.replace(/===/g, "").trim()}
              </div>
            );
          }

          if (!child.label) {
            return null;
          }

          const hasSubmenu = child.children && child.children.length > 0;
          const isOpen = openSubmenuIndex === childIndex;

          return (
            <div
              key={childIndex}
              className="title-bar-dropdown-item-wrapper"
              onMouseEnter={() => (hasSubmenu ? handleSubmenuMouseEnter(childIndex) : undefined)}
            >
              <button
                type="button"
                className={`title-bar-dropdown-item ${hasSubmenu ? "title-bar-dropdown-item--has-submenu" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasSubmenu) {
                    child.action?.();
                    closeMenu();
                  }
                }}
              >
                <span className="title-bar-dropdown-item-label">{child.label}</span>
                {hasSubmenu && <span className="title-bar-dropdown-item-arrow">▶</span>}
              </button>
              {hasSubmenu && isOpen && (
                <div
                  className="title-bar-submenu"
                  onMouseEnter={() => setOpenSubmenuIndex(childIndex)}
                >
                  {child.children!.map((subChild, subChildIndex) => (
                    <button
                      key={subChildIndex}
                      type="button"
                      className="title-bar-dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        subChild.action?.();
                        closeMenu();
                      }}
                    >
                      {subChild.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    ),
    [closeMenu, handleDropdownMouseEnter, handleSubmenuMouseEnter, openSubmenuIndex]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div ref={rootRef} className="title-bar-menus">
      <div className="title-bar-menus-measure" aria-hidden="true">
        {items.map((item, index) => (
          <button
            key={`measure-${index}-${item.label}`}
            type="button"
            className="title-bar-menu-button"
            ref={(el) => {
              measureButtonRefs.current[index] = el;
            }}
          >
            {item.label}
          </button>
        ))}
        <button ref={overflowMeasureRef} type="button" className="title-bar-menu-button">
          ---
        </button>
      </div>

      {visibleItems.map((item, index) => {
        const menuKey = `menu-${index}`;
        return (
          <div
            key={menuKey}
            ref={(el) => {
              menuContainerRefs.current[menuKey] = el;
            }}
            className="title-bar-menu"
            onMouseEnter={() => handleMenuMouseEnter(menuKey)}
            onMouseLeave={handleMenuMouseLeave}
          >
            <button type="button" className="title-bar-menu-button">
              {item.label}
            </button>
            {openMenuKey === menuKey && item.children && renderDropdownItems(item.children)}
          </div>
        );
      })}

      {overflowItems.length > 0 && (
        <div
          ref={(el) => {
            menuContainerRefs.current.overflow = el;
          }}
          className="title-bar-menu title-bar-menu--overflow"
          onMouseEnter={() => handleMenuMouseEnter("overflow")}
          onMouseLeave={handleMenuMouseLeave}
        >
          <button type="button" className="title-bar-menu-button" title="More menus">
            ---
          </button>
          {openMenuKey === "overflow" &&
            renderDropdownItems(
              overflowItems.map((item) => ({
                label: item.label,
                children: item.children,
                action: item.action,
              }))
            )}
        </div>
      )}

      {useHamburger && (
        <div
          ref={(el) => {
            menuContainerRefs.current.hamburger = el;
          }}
          className="title-bar-menu title-bar-menu--hamburger"
          onMouseEnter={() => handleMenuMouseEnter("hamburger")}
          onMouseLeave={handleMenuMouseLeave}
        >
          <button
            type="button"
            className="title-bar-menu-button"
            aria-label="Open menus"
            title="Menu"
          >
            <Menu size={14} />
          </button>
          {openMenuKey === "hamburger" &&
            renderDropdownItems(
              items.map((item) => ({
                label: item.label,
                children: item.children,
                action: item.action,
              }))
            )}
        </div>
      )}
    </div>
  );
}

export function TitleBar({
  workspaces = [],
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenSettings,
  onOpenServerModal,
  onToggleContextStatus,
  onOpenWorkspaceModal,
  onCreateDeck,
  onCreateAgent,
  onNewTerminal,
  onAddServerTab,
  onAddRemoteAccessTab,
  onDeleteWorkspace,
  onUpdateWorkspaceColor,
  agents = [],
  decks = [],
  onOpenPanel,
  isMobileMode = false,
  onToggleMobileMode,
}: TitleBarProps) {
  // Check if running in Tauri (evaluated once per component mount)
  const isInTauriApp = useMemo(() => isTauriApp(), []);

  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);

  // Shell selection state
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [defaultShellId, setDefaultShellId] = useState<string>("");

  // Workspace context menu state
  const [contextMenuWorkspace, setContextMenuWorkspace] = useState<Workspace | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [showColorPicker, setShowColorPicker] = useState(false);
  const titleBarRef = useRef<HTMLDivElement | null>(null);
  const leftSectionRef = useRef<HTMLDivElement | null>(null);
  const centerSectionRef = useRef<HTMLDivElement | null>(null);
  const appIconRef = useRef<HTMLDivElement | null>(null);
  const [menuMaxWidth, setMenuMaxWidth] = useState<number | undefined>(undefined);

  // Load available shells on mount
  useEffect(() => {
    console.log("[TitleBar] Loading shells...");
    getAvailableShells()
      .then((data) => {
        console.log("[TitleBar] Shells loaded:", data);
        setShells(data.shells);
        setDefaultShellId(data.defaultShell);
      })
      .catch((error) => {
        console.error("[TitleBar] Failed to load shells:", error);
        // Silently fail - shells will be empty
      });
  }, []);

  // Close workspace dropdown when clicking outside
  useEffect(() => {
    if (!isWorkspaceDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        workspaceDropdownRef.current &&
        !workspaceDropdownRef.current.contains(e.target as Node)
      ) {
        setIsWorkspaceDropdownOpen(false);
        setDropdownPosition(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isWorkspaceDropdownOpen]);

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isWorkspaceDropdownOpen && dropdownTriggerRef.current) {
      const rect = dropdownTriggerRef.current.getBoundingClientRect();
      // Position dropdown to the right of the trigger, aligned to the right edge
      setDropdownPosition({
        top: rect.bottom + 2,
        left: rect.left,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [isWorkspaceDropdownOpen]);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenuWorkspace) return;
    console.log("[TitleBar] Context menu opened, adding click listener");
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const menu = document.querySelector(".workspace-context-menu");
      console.log(
        "[TitleBar] Click detected, menu exists:",
        !!menu,
        "is inside:",
        menu?.contains(target)
      );
      if (menu && !menu.contains(target)) {
        console.log("[TitleBar] Click outside, closing menu");
        setContextMenuWorkspace(null);
        setContextMenuPosition(null);
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      console.log("[TitleBar] Context menu click listener removed");
    };
  }, [contextMenuWorkspace]);

  useLayoutEffect(() => {
    const recalculateMenuWidth = () => {
      if (!titleBarRef.current || !leftSectionRef.current || !centerSectionRef.current) {
        setMenuMaxWidth(undefined);
        return;
      }

      const leftRect = leftSectionRef.current.getBoundingClientRect();
      const centerRect = centerSectionRef.current.getBoundingClientRect();
      const appIconWidth = appIconRef.current
        ? Math.ceil(appIconRef.current.getBoundingClientRect().width)
        : 0;
      const gapPadding = 10;
      const available = Math.floor(centerRect.left - leftRect.left - appIconWidth - gapPadding);
      setMenuMaxWidth(available > 0 ? available : 0);
    };

    recalculateMenuWidth();
    const observer = new ResizeObserver(() => recalculateMenuWidth());
    if (titleBarRef.current) observer.observe(titleBarRef.current);
    if (centerSectionRef.current) observer.observe(centerSectionRef.current);

    window.addEventListener("resize", recalculateMenuWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalculateMenuWidth);
    };
  }, [workspaces.length, isInTauriApp]);

  // Handle workspace tab right-click
  const handleWorkspaceContextMenu = useCallback(
    (workspace: Workspace, event: React.MouseEvent) => {
      console.log("[TitleBar] Context menu requested for workspace:", workspace.name);
      event.preventDefault();
      event.stopPropagation();
      setContextMenuWorkspace(workspace);
      setContextMenuPosition({ x: event.clientX, y: event.clientY });
      console.log("[TitleBar] Context menu position:", { x: event.clientX, y: event.clientY });
    },
    []
  );

  // Handle workspace color change
  const handleColorChange = useCallback(
    (color: string) => {
      if (contextMenuWorkspace && onUpdateWorkspaceColor) {
        onUpdateWorkspaceColor(contextMenuWorkspace.id, color);
      }
      setContextMenuWorkspace(null);
      setContextMenuPosition(null);
      setShowColorPicker(false);
    },
    [contextMenuWorkspace, onUpdateWorkspaceColor]
  );

  // Handle workspace delete
  const handleDeleteWorkspace = useCallback(() => {
    console.log("[TitleBar] Delete button clicked, contextMenuWorkspace:", contextMenuWorkspace);
    if (contextMenuWorkspace && onDeleteWorkspace) {
      console.log("[TitleBar] Calling onDeleteWorkspace with:", contextMenuWorkspace.id);
      onDeleteWorkspace(contextMenuWorkspace.id);
    }
    setContextMenuWorkspace(null);
    setContextMenuPosition(null);
  }, [contextMenuWorkspace, onDeleteWorkspace]);

  const handleClose = async () => {
    if (!isInTauriApp) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = await getCurrentWindow();
    await win.close();
  };

  const handleMinimize = async () => {
    if (!isInTauriApp) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = await getCurrentWindow();
    await win.minimize();
  };

  const handleMaximize = async () => {
    if (!isInTauriApp) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = await getCurrentWindow();
    await win.toggleMaximize();
  };

  // VSCode-style menu structure
  const menuItems: MenuItem[] = useMemo(() => {
    console.log(
      "[TitleBar] Building menuItems, shells.length:",
      shells.length,
      "defaultShellId:",
      defaultShellId
    );

    // Build terminal menu items with shell selection
    const terminalMenuItems: MenuItem[] = [];

    // Get the default shell for "New Terminal" action
    const defaultShell = shells.find((s) => s.id === defaultShellId);

    // Build shell selection submenu
    const shellSubmenuItems: MenuItem[] = [];

    if (shells.length > 0) {
      // Group shells by category
      const defaultShells = shells.filter((s) => s.category === "default");
      const wslShells = shells.filter((s) => s.category === "wsl");
      const gitShells = shells.filter((s) => s.category === "git");
      const otherShells = shells.filter((s) => s.category === "other");

      // Add default shells
      defaultShells.forEach((shell) => {
        shellSubmenuItems.push({
          label: shell.name,
          action: () => onNewTerminal?.(shell.id),
        });
      });

      // Add WSL shells
      if (wslShells.length > 0) {
        wslShells.forEach((shell) => {
          shellSubmenuItems.push({
            label: shell.name,
            action: () => onNewTerminal?.(shell.id),
          });
        });
      }

      // Add Git shells
      if (gitShells.length > 0) {
        gitShells.forEach((shell) => {
          shellSubmenuItems.push({
            label: shell.name,
            action: () => onNewTerminal?.(shell.id),
          });
        });
      }

      // Add other shells
      if (otherShells.length > 0) {
        otherShells.forEach((shell) => {
          shellSubmenuItems.push({
            label: shell.name,
            action: () => onNewTerminal?.(shell.id),
          });
        });
      }
    }

    // Build terminal menu items
    terminalMenuItems.push({
      label: "New Terminal",
      action: () => onNewTerminal?.(defaultShellId),
    });

    // Add submenu for shell selection if shells are available
    if (shellSubmenuItems.length > 0) {
      terminalMenuItems.push({
        label: ">",
        children: shellSubmenuItems,
      });
    }

    // Build Panel menu items
    const panelMenuItems: MenuItem[] = [];

    // Development panels
    panelMenuItems.push({ label: "=== Development ===" });

    // Workspace submenu
    if (workspaces.length > 0) {
      const workspaceSubmenu: MenuItem[] = workspaces.map((ws) => ({
        label: ws.name,
        action: () => {
          console.log("[TitleBar] Opening workspace panel:", ws.name);
          onOpenPanel?.(workspaceToTab(ws));
        },
      }));
      panelMenuItems.push({
        label: "Workspace",
        children: workspaceSubmenu,
      });
    } else {
      panelMenuItems.push({
        label: "Workspace",
        action: () => {
          console.log("[TitleBar] No workspaces, opening workspace modal");
          // If no workspaces, prompt to create one
          onOpenWorkspaceModal?.();
        },
      });
    }

    // Deck submenu
    if (decks.length > 0) {
      const deckSubmenu: MenuItem[] = decks.map((deck) => ({
        label: deck.name,
        action: () => onOpenPanel?.(deckToTab(deck)),
      }));
      panelMenuItems.push({
        label: "Deck",
        children: deckSubmenu,
      });
    } else {
      panelMenuItems.push({
        label: "Deck",
        action: () => {
          // If no decks, prompt to create one
          onCreateDeck?.();
        },
      });
    }

    // Agent submenu
    if (agents.length > 0) {
      const agentSubmenu: MenuItem[] = agents.map((agent) => ({
        label: agent.name,
        action: () => onOpenPanel?.(agentToTab(agent)),
      }));
      panelMenuItems.push({
        label: "Agent",
        children: agentSubmenu,
      });
    } else {
      panelMenuItems.push({
        label: "Agent",
        action: () => {
          // If no agents, open agent config
          onOpenPanel?.(agentConfigToTab());
        },
      });
    }

    panelMenuItems.push({ label: "", separator: true });
    panelMenuItems.push({ label: "=== Tools ===" });

    panelMenuItems.push({
      label: "Local Servers",
      action: () => onOpenPanel?.(serverToTab()),
    });
    panelMenuItems.push({
      label: "MCP Servers",
      action: () => onOpenPanel?.(mcpToTab()),
    });
    panelMenuItems.push({
      label: "Remote Access",
      action: () => onOpenPanel?.(remoteAccessToTab()),
    });

    panelMenuItems.push({ label: "", separator: true });
    panelMenuItems.push({ label: "=== Settings ===" });

    panelMenuItems.push({
      label: "Server Settings",
      action: () => {
        console.log("[TitleBar] Opening Server Settings panel");
        onOpenPanel?.(serverSettingsToTab());
      },
    });
    panelMenuItems.push({
      label: "Agent Status",
      action: () => onOpenPanel?.(agentStatusToTab()),
    });
    panelMenuItems.push({
      label: "Agent Config (Global)",
      action: () => onOpenPanel?.(agentConfigToTab()),
    });

    // Agent Config Local submenu (workspace-specific)
    if (workspaces.length > 0) {
      const agentConfigLocalSubmenu: MenuItem[] = workspaces.map((ws) => ({
        label: ws.name,
        action: () => onOpenPanel?.(agentConfigLocalToTab(ws.id, ws.name)),
      }));
      panelMenuItems.push({
        label: "Agent Config (Local)",
        children: agentConfigLocalSubmenu,
      });
    }

    panelMenuItems.push({
      label: "Setup",
      action: () => onOpenPanel?.(setupToTab()),
    });

    return [
      {
        label: "File",
        children: [
          { label: "New Workspace", action: onOpenWorkspaceModal },
          { label: "New Deck", action: onCreateDeck },
        ],
      },
      {
        label: "Terminal",
        children: terminalMenuItems,
      },
      {
        label: "Panel",
        children: panelMenuItems,
      },
      {
        label: "View",
        children: [
          { label: "Local Servers", action: onAddServerTab },
          { label: "Remote Access", action: onAddRemoteAccessTab },
          { label: "Server Settings", action: onOpenServerModal },
          { label: "Settings", action: onOpenSettings },
        ],
      },
      {
        label: "Agent",
        children: [{ label: "Create Agent", action: onCreateAgent }],
      },
      {
        label: "Help",
        children: [{ label: "Context Status", action: onToggleContextStatus }],
      },
    ];
  }, [
    shells,
    defaultShellId,
    workspaces,
    decks,
    agents,
    onOpenWorkspaceModal,
    onCreateDeck,
    onNewTerminal,
    onAddServerTab,
    onAddRemoteAccessTab,
    onOpenServerModal,
    onOpenSettings,
    onCreateAgent,
    onToggleContextStatus,
    onOpenPanel,
  ]);

  // Calculate visible and hidden workspaces
  const visibleWorkspaces: Workspace[] = workspaces.slice(0, MAX_VISIBLE_WORKSPACES);
  const hiddenWorkspaces: Workspace[] = workspaces.slice(MAX_VISIBLE_WORKSPACES);
  const showDropdown = hiddenWorkspaces.length > 0;

  return (
    <div
      ref={titleBarRef}
      className={`title-bar ${isInTauriApp ? "title-bar--tauri" : ""} ${isMobileMode ? "title-bar--mobile" : ""}`}
    >
      {/* Left side - app icon and menu bar */}
      <div ref={leftSectionRef} className="title-bar-left-section">
        {isInTauriApp && (
          <div ref={appIconRef} className="title-bar-app-icon" data-tauri-drag-region>
            <img src="/icon-transparent.svg" alt="S-IDE" className="app-icon-img" />
          </div>
        )}
        <MenuBar items={menuItems} maxWidth={menuMaxWidth} useHamburger={isMobileMode} />
      </div>

      {/* Workspace tabs - centered */}
      <div ref={centerSectionRef} className="title-bar-center-section" data-tauri-drag-region>
        <div className="workspace-tabs">
          {isInTauriApp && <div className="workspace-tabs-drag-spacer" data-tauri-drag-region />}
          {visibleWorkspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              className={`workspace-tab ${activeWorkspaceId === workspace.id ? "workspace-tab--active" : ""}`}
              data-tauri-drag-region={false}
              onClick={() => onSelectWorkspace?.(workspace.id)}
              onContextMenu={(e) => handleWorkspaceContextMenu(workspace, e)}
              title={workspace.path}
              style={
                workspace.color
                  ? {
                      borderBottomColor: workspace.color,
                    }
                  : undefined
              }
            >
              <span className="workspace-tab-name">{workspace.name}</span>
            </button>
          ))}
          {showDropdown && (
            <div ref={workspaceDropdownRef} className="workspace-dropdown-container">
              <button
                ref={dropdownTriggerRef}
                type="button"
                className={`workspace-tab workspace-dropdown-trigger ${isWorkspaceDropdownOpen ? "workspace-dropdown-trigger--open" : ""}`}
                data-tauri-drag-region={false}
                onClick={() => setIsWorkspaceDropdownOpen((prev) => !prev)}
                title="その他のワークスペース"
              >
                <ChevronDown size={14} />
              </button>
              {isWorkspaceDropdownOpen && dropdownPosition && (
                <div
                  className="workspace-dropdown"
                  style={{
                    position: "fixed",
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                  }}
                >
                  {hiddenWorkspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      type="button"
                      className={`workspace-dropdown-item ${activeWorkspaceId === workspace.id ? "workspace-dropdown-item--active" : ""}`}
                      data-tauri-drag-region={false}
                      onClick={() => {
                        onSelectWorkspace?.(workspace.id);
                        setIsWorkspaceDropdownOpen(false);
                      }}
                      onContextMenu={(e) => handleWorkspaceContextMenu(workspace, e)}
                      title={workspace.path}
                    >
                      <span className="workspace-dropdown-item-name">{workspace.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className="workspace-tab workspace-tab--add"
            data-tauri-drag-region={false}
            onClick={onOpenWorkspaceModal}
            title="新しいワークスペースを追加"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="title-bar-right-section">
        {/* Mobile mode toggle for web */}
        {!isInTauriApp && (
          <button
            type="button"
            className="title-bar-mobile-toggle"
            data-tauri-drag-region={false}
            onClick={onToggleMobileMode}
            title={isMobileMode ? "デスクトップモード" : "モバイルモード"}
            aria-label="Toggle mobile mode"
          >
            <Smartphone size={14} />
            <span className="mobile-mode-label">{isMobileMode ? "Desktop" : "Mobile"}</span>
          </button>
        )}

        {/* Window controls - always show on right side */}
        {isInTauriApp && (
          <div className="title-bar-controls">
            <button
              type="button"
              className="title-bar-button"
              data-tauri-drag-region={false}
              onClick={handleMinimize}
              aria-label="Minimize"
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              className="title-bar-button"
              data-tauri-drag-region={false}
              onClick={handleMaximize}
              aria-label="Maximize"
            >
              <Square size={12} />
            </button>
            <button
              type="button"
              className="title-bar-button title-bar-close"
              data-tauri-drag-region={false}
              onClick={handleClose}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Workspace context menu */}
      {contextMenuWorkspace && contextMenuPosition && (
        <div
          className="workspace-context-menu"
          style={{
            position: "fixed",
            top: `${contextMenuPosition.y}px`,
            left: `${contextMenuPosition.x}px`,
            zIndex: 99999,
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {showColorPicker ? (
            <div className="color-picker-grid">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="color-picker-button"
                  onClick={() => handleColorChange(color)}
                  title={color}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          ) : (
            <>
              <button
                type="button"
                className="context-menu-item"
                onClick={() => setShowColorPicker(true)}
              >
                <Palette size={14} />
                <span>アクセント色を変更</span>
              </button>
              <button
                type="button"
                className="context-menu-item context-menu-item--danger"
                onClick={handleDeleteWorkspace}
              >
                <Trash2 size={14} />
                <span>ワークスペースを削除</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
