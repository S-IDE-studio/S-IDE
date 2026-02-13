export type MobileShortcutKey =
  | "esc"
  | "tab"
  | "ctrl"
  | "alt"
  | "shift"
  | "up"
  | "down"
  | "left"
  | "right"
  | "enter"
  | "backspace"
  | "f2"
  | "ctrl_c"
  | "ctrl_v";

export interface OneShotModifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

const MODIFIER_KEYS = new Set<MobileShortcutKey>(["ctrl", "alt", "shift"]);

export function createEmptyModifiers(): OneShotModifiers {
  return { ctrl: false, alt: false, shift: false };
}

export function isModifierKey(key: MobileShortcutKey): boolean {
  return MODIFIER_KEYS.has(key);
}

function toggleModifier(
  current: OneShotModifiers,
  key: Extract<MobileShortcutKey, "ctrl" | "alt" | "shift">
): OneShotModifiers {
  return {
    ...current,
    [key]: !current[key],
  };
}

export function nextModifiersAfterPress(
  current: OneShotModifiers,
  key: MobileShortcutKey
): OneShotModifiers {
  if (key === "ctrl" || key === "alt" || key === "shift") {
    return toggleModifier(current, key);
  }
  return createEmptyModifiers();
}

const TERMINAL_SEQUENCE_BASE: Record<
  Exclude<MobileShortcutKey, "ctrl" | "alt" | "shift" | "ctrl_c" | "ctrl_v">,
  string
> = {
  esc: "\x1b",
  tab: "\t",
  up: "\x1b[A",
  down: "\x1b[B",
  left: "\x1b[D",
  right: "\x1b[C",
  enter: "\r",
  backspace: "\x7f",
  f2: "\x1bOQ",
};

export function getTerminalSequence(
  key: MobileShortcutKey,
  modifiers: OneShotModifiers
): string | null {
  if (key === "ctrl" || key === "alt" || key === "shift") {
    return null;
  }

  if (key === "ctrl_c") {
    return "\x03";
  }
  if (key === "ctrl_v") {
    return "\x16";
  }

  if (key === "tab" && modifiers.shift) {
    return "\x1b[Z";
  }

  const base = TERMINAL_SEQUENCE_BASE[key];
  if (!base) {
    return null;
  }

  if (modifiers.alt) {
    return `\x1b${base}`;
  }

  return base;
}

export interface KeyboardShortcutPayload {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export function getAppShortcutKeyEvent(
  key: MobileShortcutKey,
  modifiers: OneShotModifiers
): KeyboardShortcutPayload | null {
  if (key === "ctrl" || key === "alt" || key === "shift") {
    return null;
  }

  if (key === "ctrl_c") {
    return { key: "c", ctrlKey: true };
  }
  if (key === "ctrl_v") {
    return { key: "v", ctrlKey: true };
  }

  const payload: KeyboardShortcutPayload = {
    key:
      key === "esc"
        ? "Escape"
        : key === "up"
          ? "ArrowUp"
          : key === "down"
            ? "ArrowDown"
            : key === "left"
              ? "ArrowLeft"
              : key === "right"
                ? "ArrowRight"
                : key === "enter"
                  ? "Enter"
                  : key === "backspace"
                    ? "Backspace"
                    : key === "tab"
                      ? "Tab"
                      : key === "f2"
                        ? "F2"
                        : key,
    ctrlKey: modifiers.ctrl,
    altKey: modifiers.alt,
    shiftKey: modifiers.shift,
  };

  return payload;
}
