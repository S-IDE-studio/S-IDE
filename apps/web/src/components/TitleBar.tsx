import { Smartphone, Plus, Folder, Layers, Square, Terminal } from "lucide-react";
import { useEffect, useState } from "react";

interface TitleBarProps {
  onOpenSettings?: () => void;
  onOpenServerModal?: () => void;
  onToggleContextStatus?: () => void;
  onOpenWorkspaceModal?: () => void;
  onOpenDeckModal?: () => void;
  onCreateAgent?: () => void;
  onNewTerminal?: () => void;
}

export function TitleBar({
  onOpenSettings,
  onOpenServerModal,
  onToggleContextStatus,
  onOpenWorkspaceModal,
  onOpenDeckModal,
  onCreateAgent,
  onNewTerminal,
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
            <Smartphone size={14} />
            <span className="mobile-mode-label">{isMobileMode ? "Desktop" : "Mobile"}</span>
          </button>
        )}
      </div>

      {/* Center - draggable area */}
      <div className="title-bar-center" data-tauri-drag-region={isTauri}>
        <span className="title-bar-title">S-IDE</span>
      </div>

      {/* Right side - functional buttons */}
      <div className="title-bar-right">
        {/* Panel Management Buttons */}
        <div className="title-bar-panel-actions">
          {onOpenWorkspaceModal && (
            <button
              type="button"
              className="title-bar-action-btn"
              data-tauri-drag-region={false}
              onClick={onOpenWorkspaceModal}
              title="ワークスペースを追加"
            >
              <Folder size={14} />
            </button>
          )}
          {onOpenDeckModal && (
            <button
              type="button"
              className="title-bar-action-btn"
              data-tauri-drag-region={false}
              onClick={onOpenDeckModal}
              title="デッキを追加"
            >
              <Layers size={14} />
            </button>
          )}
          {onCreateAgent && (
            <button
              type="button"
              className="title-bar-action-btn"
              data-tauri-drag-region={false}
              onClick={onCreateAgent}
              title="エージェントを追加"
            >
              <Square size={14} />
            </button>
          )}
          {onNewTerminal && (
            <button
              type="button"
              className="title-bar-action-btn"
              data-tauri-drag-region={false}
              onClick={onNewTerminal}
              title="ターミナルを追加"
            >
              <Terminal size={14} />
            </button>
          )}
        </div>
        {onOpenServerModal && (
          <button
            type="button"
            className="title-bar-action-btn"
            data-tauri-drag-region={false}
            onClick={onOpenServerModal}
            title="サーバー"
          >
            サーバー
          </button>
        )}
        {onOpenSettings && (
          <button
            type="button"
            className="title-bar-action-btn"
            data-tauri-drag-region={false}
            onClick={onOpenSettings}
            title="設定"
          >
            設定
          </button>
        )}
      </div>

      {/* Window controls - only show in Tauri */}
      {isTauri && (
        <div className="title-bar-controls">
          <button
            type="button"
            className="title-bar-button"
            data-tauri-drag-region={false}
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <span>&#8722;</span>
          </button>
          <button
            type="button"
            className="title-bar-button"
            data-tauri-drag-region={false}
            onClick={handleMaximize}
            aria-label="Maximize"
          >
            <span>&#9633;</span>
          </button>
          <button
            type="button"
            className="title-bar-button title-bar-close"
            data-tauri-drag-region={false}
            onClick={handleClose}
            aria-label="Close"
          >
            <span>&#10005;</span>
          </button>
        </div>
      )}
    </div>
  );
}
