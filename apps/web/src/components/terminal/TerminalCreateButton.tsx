/**
 * Terminal create button with shell selection dropdown
 */

import type { ShellInfo } from "@side-ide/shared/types";
import { Check, ChevronDown, Plus, RefreshCw, Terminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShells } from "../../hooks/useShells";

interface TerminalCreateButtonProps {
  onCreateTerminal: (shellId?: string) => void;
  disabled?: boolean;
  variant?: "default" | "compact";
}

export function TerminalCreateButton({
  onCreateTerminal,
  disabled = false,
  variant = "default",
}: TerminalCreateButtonProps) {
  const { shells, defaultShell, loading, refresh, setDefaultShell } = useShells();
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleCreateDefault = useCallback(() => {
    onCreateTerminal(defaultShell?.id);
    setIsOpen(false);
  }, [onCreateTerminal, defaultShell?.id]);

  const handleCreateWithShell = useCallback(
    (shellId: string) => {
      onCreateTerminal(shellId);
      setIsOpen(false);
    },
    [onCreateTerminal]
  );

  const handleSetAsDefault = useCallback(
    async (shellId: string) => {
      setIsSettingDefault(true);
      try {
        await setDefaultShell(shellId);
        setIsSettingDefault(false);
      } catch (error) {
        console.error("Failed to set default shell:", error);
        setIsSettingDefault(false);
      }
    },
    [setDefaultShell]
  );

  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Group shells by category
  const defaultShells = shells.filter((s) => s.category === "default");
  const wslShells = shells.filter((s) => s.category === "wsl");
  const gitShells = shells.filter((s) => s.category === "git");
  const otherShells = shells.filter((s) => s.category === "other");

  function renderShellItem(shell: ShellInfo, showSetDefault = true) {
    const isDefault = defaultShell?.id === shell.id;
    return (
      <div key={shell.id} className="shell-item">
        <button
          type="button"
          className="shell-create-btn"
          onClick={() => handleCreateWithShell(shell.id)}
          disabled={disabled}
        >
          {shell.icon === "terminal-square" && <Terminal size={14} />}
          {shell.icon === "terminal" && <Terminal size={14} />}
          {!shell.icon && <Terminal size={14} />}
          <span className="shell-name">{shell.name}</span>
          {isDefault && <Check size={12} className="shell-default-indicator" />}
        </button>
        {showSetDefault && !isDefault && (
          <button
            type="button"
            className="shell-set-default-btn"
            onClick={() => handleSetAsDefault(shell.id)}
            disabled={isSettingDefault}
            title="Set as default shell"
          >
            <span className="shell-set-default-text">Set as Default</span>
          </button>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="terminal-create-button-compact" ref={dropdownRef}>
        <button
          type="button"
          className="terminal-create-btn-compact"
          onClick={() => onCreateTerminal(defaultShell?.id)}
          disabled={disabled || loading}
          title="Create new terminal"
        >
          <Plus size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="terminal-create-button" ref={dropdownRef}>
      <button
        type="button"
        className="terminal-create-main-btn"
        onClick={() => onCreateTerminal(defaultShell?.id)}
        disabled={disabled || loading}
        title={`Create terminal with ${defaultShell?.name || "default shell"}`}
      >
        <Plus size={14} />
      </button>

      <button
        type="button"
        className="terminal-create-dropdown-btn"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || loading}
        title="Select shell for new terminal"
      >
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div className="terminal-create-dropdown">
          <div className="shell-dropdown-header">
            <span className="shell-dropdown-title">Select Shell</span>
            <button
              type="button"
              className="shell-refresh-btn"
              onClick={handleRefresh}
              disabled={loading}
              title="Refresh shell list"
            >
              <RefreshCw size={12} className={loading ? "spinning" : ""} />
            </button>
          </div>

          <div className="shell-dropdown-content">
            {/* Default Shells */}
            {defaultShells.length > 0 && (
              <div className="shell-category">
                <div className="shell-category-label">Default Shells</div>
                {defaultShells.map((s) => renderShellItem(s, defaultShells.length > 1))}
              </div>
            )}

            {/* WSL */}
            {wslShells.length > 0 && (
              <div className="shell-category">
                <div className="shell-category-label">WSL</div>
                {wslShells.map((s) => renderShellItem(s))}
              </div>
            )}

            {/* Git Bash */}
            {gitShells.length > 0 && (
              <div className="shell-category">
                <div className="shell-category-label">Git</div>
                {gitShells.map((s) => renderShellItem(s))}
              </div>
            )}

            {/* Other Shells */}
            {otherShells.length > 0 && (
              <div className="shell-category">
                <div className="shell-category-label">Other</div>
                {otherShells.map((s) => renderShellItem(s))}
              </div>
            )}

            {shells.length === 0 && !loading && (
              <div className="shell-dropdown-empty">No shells found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
