import { ChevronDown, Minus, Palette, Plus, Square, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAvailableShells } from "../api";
import type { ShellInfo, Workspace } from "../types";

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
}

interface MenuItem {
  label: string;
  action?: () => void;
  children?: MenuItem[];
  separator?: boolean; // Add visual separator before this item
}

interface MenuBarProps {
  items: MenuItem[];
}

function MenuBar({ items }: MenuBarProps) {
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);
  const menuContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMenu = useCallback(() => {
    setOpenMenuIndex(null);
    setOpenSubmenuIndex(null);
  }, []);

  const handleMenuMouseEnter = useCallback((index: number) => {
    // Clear any pending close timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpenMenuIndex(index);
    // Don't reset submenu index when switching between top-level menu items
    // setOpenSubmenuIndex(null);
  }, []);

  const handleMenuMouseLeave = useCallback(() => {
    // Delay closing to allow moving to dropdown or submenu
    timeoutRef.current = setTimeout(() => {
      setOpenMenuIndex(null);
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
      if (openMenuIndex !== null) {
        const container = menuContainerRefs.current[openMenuIndex];
        if (container && !container.contains(e.target as Node)) {
          setOpenMenuIndex(null);
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openMenuIndex !== null) {
        setOpenMenuIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenuIndex]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="title-bar-menus">
      {items.map((item, index) => (
        <div
          key={index}
          ref={(el) => {
            menuContainerRefs.current[index] = el;
          }}
          className="title-bar-menu"
          onMouseEnter={() => handleMenuMouseEnter(index)}
          onMouseLeave={handleMenuMouseLeave}
        >
          <button type="button" className="title-bar-menu-button">
            {item.label}
          </button>
          {openMenuIndex === index && item.children && (
            <div className="title-bar-dropdown" onMouseEnter={handleDropdownMouseEnter}>
              {item.children.map((child, childIndex) => {
                // Render separator
                if (child.separator) {
                  return <div key={childIndex} className="title-bar-dropdown-separator" />;
                }
                // Skip empty items (separators with no label)
                if (!child.label) {
                  return null;
                }

                const hasSubmenu = child.children && child.children.length > 0;
                const isOpen = openSubmenuIndex === childIndex;

                console.log(
                  "[MenuBar] Rendering child:",
                  childIndex,
                  child.label,
                  "hasSubmenu:",
                  hasSubmenu,
                  "isOpen:",
                  isOpen
                );

                return (
                  <div
                    key={childIndex}
                    className="title-bar-dropdown-item-wrapper"
                    onMouseEnter={() =>
                      hasSubmenu ? handleSubmenuMouseEnter(childIndex) : undefined
                    }
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
          )}
        </div>
      ))}
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
}: TitleBarProps) {
  // Check if running in Tauri (evaluated once per component mount)
  const isInTauriApp = useMemo(() => isTauriApp(), []);

  const [isMobileMode, setIsMobileMode] = useState(false);
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

  useEffect(() => {
    // Check initial mobile mode based on screen width
    const checkMobileMode = () => {
      setIsMobileMode(window.innerWidth < 768);
    };

    checkMobileMode();
    window.addEventListener("resize", checkMobileMode);
    return () => window.removeEventListener("resize", checkMobileMode);
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

  const handleToggleMobileMode = () => {
    setIsMobileMode((prev) => !prev);
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
    onOpenWorkspaceModal,
    onCreateDeck,
    onNewTerminal,
    onAddServerTab,
    onAddRemoteAccessTab,
    onOpenServerModal,
    onOpenSettings,
    onCreateAgent,
    onToggleContextStatus,
  ]);

  // Calculate visible and hidden workspaces
  const visibleWorkspaces: Workspace[] = workspaces.slice(0, MAX_VISIBLE_WORKSPACES);
  const hiddenWorkspaces: Workspace[] = workspaces.slice(MAX_VISIBLE_WORKSPACES);
  const showDropdown = hiddenWorkspaces.length > 0;

  return (
    <div
      className={`title-bar ${isInTauriApp ? "title-bar--tauri" : ""} ${isMobileMode ? "title-bar--mobile" : ""}`}
      data-tauri-drag-region={isInTauriApp}
    >
      {/* Left side - app icon and menu bar */}
      <div className="title-bar-left-section">
        {isInTauriApp && (
          <div className="title-bar-app-icon" data-tauri-drag-region>
            <img src="/icon-transparent.svg" alt="S-IDE" className="app-icon-img" />
          </div>
        )}
        <MenuBar items={menuItems} />
      </div>

      {/* Mobile mode toggle for web */}
      {!isInTauriApp && (
        <button
          type="button"
          className="title-bar-mobile-toggle"
          data-tauri-drag-region={false}
          onClick={handleToggleMobileMode}
          title={isMobileMode ? "デスクトップモード" : "モバイルモード"}
          aria-label="Toggle mobile mode"
        >
          <span className="mobile-mode-label">{isMobileMode ? "Desktop" : "Mobile"}</span>
        </button>
      )}

      {/* Workspace tabs - centered */}
      <div className="title-bar-center-section" data-tauri-drag-region={isInTauriApp}>
        <div className="workspace-tabs">
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
