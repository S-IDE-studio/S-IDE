import { Minus, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface TitleBarProps {
  onOpenSettings?: () => void;
  onOpenServerModal?: () => void;
  onToggleContextStatus?: () => void;
  onOpenWorkspaceModal?: () => void;
  onOpenDeckModal?: () => void;
  onCreateAgent?: () => void;
  onNewTerminal?: () => void;
  onAddServerTab?: () => void;
  onAddTunnelTab?: () => void;
}

interface MenuItem {
  label: string;
  action?: () => void;
  children?: MenuItem[];
}

interface MenuBarProps {
  items: MenuItem[];
}

function MenuBar({ items }: MenuBarProps) {
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const menuContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMenu = useCallback(() => {
    setOpenMenuIndex(null);
  }, []);

  const handleMenuMouseEnter = useCallback((index: number) => {
    // Clear any pending close timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpenMenuIndex(index);
  }, []);

  const handleMenuMouseLeave = useCallback(() => {
    // Delay closing to allow moving to dropdown
    timeoutRef.current = setTimeout(() => {
      setOpenMenuIndex(null);
    }, 100);
  }, []);

  const handleDropdownMouseEnter = useCallback(() => {
    // Cancel the close timeout when entering dropdown
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
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
              {item.children.map((child, childIndex) => (
                <button
                  key={childIndex}
                  type="button"
                  className="title-bar-dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    child.action?.();
                    closeMenu();
                  }}
                >
                  {child.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function TitleBar({
  onOpenSettings,
  onOpenServerModal,
  onToggleContextStatus,
  onOpenWorkspaceModal,
  onOpenDeckModal,
  onCreateAgent,
  onNewTerminal,
  onAddServerTab,
  onAddTunnelTab,
}: TitleBarProps) {
  const [isTauri, setIsTauri] = useState(false);
  const [isMobileMode, setIsMobileMode] = useState(false);

  useEffect(() => {
    // Check if running in Tauri environment
    setIsTauri(typeof window !== "undefined" && "__TAURI__" in window);

    // Check initial mobile mode based on screen width
    const checkMobileMode = () => {
      setIsMobileMode(window.innerWidth < 768);
    };

    checkMobileMode();
    window.addEventListener("resize", checkMobileMode);
    return () => window.removeEventListener("resize", checkMobileMode);
  }, []);

  const handleClose = async () => {
    if (!isTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = await getCurrentWindow();
    await win.close();
  };

  const handleMinimize = async () => {
    if (!isTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = await getCurrentWindow();
    await win.minimize();
  };

  const handleMaximize = async () => {
    if (!isTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = await getCurrentWindow();
    await win.toggleMaximize();
  };

  const handleToggleMobileMode = () => {
    setIsMobileMode((prev) => !prev);
  };

  // VSCode-style menu structure
  const menuItems: MenuItem[] = [
    {
      label: "File",
      children: [
        { label: "New Workspace", action: onOpenWorkspaceModal },
        { label: "New Deck", action: onOpenDeckModal },
        { label: "New Terminal", action: onNewTerminal },
      ],
    },
    {
      label: "View",
      children: [
        { label: "Local Servers", action: onAddServerTab },
        { label: "Remote Access", action: onAddTunnelTab },
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

  return (
    <div
      className={`title-bar ${isTauri ? "title-bar--tauri" : ""} ${isMobileMode ? "title-bar--mobile" : ""}`}
    >
      {/* Left side - app icon for Tauri, mobile mode toggle for web */}
      <div className="title-bar-left" data-tauri-drag-region={isTauri}>
        {isTauri ? (
          <div className="title-bar-app-icon" data-tauri-drag-region>
            <img src="/icon-transparent.svg" alt="S-IDE" className="app-icon-img" />
          </div>
        ) : (
          <button
            type="button"
            className="title-bar-mobile-toggle"
            onClick={handleToggleMobileMode}
            title={isMobileMode ? "デスクトップモード" : "モバイルモード"}
            aria-label="Toggle mobile mode"
          >
            <span className="mobile-mode-label">{isMobileMode ? "Desktop" : "Mobile"}</span>
          </button>
        )}
      </div>

      {/* Center - menu bar */}
      <div className="title-bar-center" data-tauri-drag-region={isTauri}>
        <MenuBar items={menuItems} />
      </div>

      {/* Right side - empty (window controls are separate) */}
      <div className="title-bar-right" data-tauri-drag-region={isTauri}>
        {/* Spacer to push window controls to the right */}
      </div>

      {/* Window controls - always show on right side */}
      {isTauri && (
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
  );
}
