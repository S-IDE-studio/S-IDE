import { useState } from "react";
import type { TabKind } from "../types";
import {
  createEmptyModifiers,
  getAppShortcutKeyEvent,
  getTerminalSequence,
  isModifierKey,
  type KeyboardShortcutPayload,
  type MobileShortcutKey,
  nextModifiersAfterPress,
} from "../utils/mobileShortcuts";

interface MobileShortcutBarProps {
  isMobileMode: boolean;
  activeTabKind: TabKind | null;
  onTerminalInput: (payload: string) => void;
  onAppShortcut: (payload: KeyboardShortcutPayload) => void;
}

interface ShortcutButton {
  key: MobileShortcutKey;
  label: string;
}

const SHORTCUT_BUTTONS: ShortcutButton[] = [
  { key: "esc", label: "Esc" },
  { key: "tab", label: "Tab" },
  { key: "ctrl", label: "Ctrl" },
  { key: "alt", label: "Alt" },
  { key: "shift", label: "Shift" },
  { key: "ctrl_c", label: "Ctrl+C" },
  { key: "ctrl_v", label: "Ctrl+V" },
  { key: "f2", label: "F2" },
  { key: "up", label: "↑" },
  { key: "down", label: "↓" },
  { key: "left", label: "←" },
  { key: "right", label: "→" },
  { key: "enter", label: "Enter" },
  { key: "backspace", label: "Backspace" },
];

export function MobileShortcutBar({
  isMobileMode,
  activeTabKind,
  onTerminalInput,
  onAppShortcut,
}: MobileShortcutBarProps): React.JSX.Element | null {
  const [modifiers, setModifiers] = useState(createEmptyModifiers());
  const isTerminalPanel = activeTabKind === "terminal";

  if (!isMobileMode) {
    return null;
  }

  const handleKeyPress = (shortcutKey: MobileShortcutKey) => {
    if (!isModifierKey(shortcutKey)) {
      if (isTerminalPanel) {
        const terminalSequence = getTerminalSequence(shortcutKey, modifiers);
        if (terminalSequence) {
          onTerminalInput(terminalSequence);
        }
      } else {
        const keyEventPayload = getAppShortcutKeyEvent(shortcutKey, modifiers);
        if (keyEventPayload) {
          onAppShortcut(keyEventPayload);
        }
      }
    }

    setModifiers((current) => nextModifiersAfterPress(current, shortcutKey));
  };

  return (
    <div className="mobile-shortcut-bar" role="toolbar" aria-label="Mobile shortcut bar">
      {SHORTCUT_BUTTONS.map((button) => {
        const isModifierActive =
          (button.key === "ctrl" && modifiers.ctrl) ||
          (button.key === "alt" && modifiers.alt) ||
          (button.key === "shift" && modifiers.shift);
        return (
          <button
            key={button.key}
            type="button"
            className={`mobile-shortcut-btn ${isModifierActive ? "mobile-shortcut-btn--active" : ""}`}
            onClick={() => handleKeyPress(button.key)}
            aria-label={button.label}
            title={button.label}
          >
            {button.label}
          </button>
        );
      })}
    </div>
  );
}
