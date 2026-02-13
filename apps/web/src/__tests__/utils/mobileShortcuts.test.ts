import {
  createEmptyModifiers,
  getAppShortcutKeyEvent,
  getTerminalSequence,
  isModifierKey,
  nextModifiersAfterPress,
} from "../../utils/mobileShortcuts";

describe("mobileShortcuts", () => {
  it("identifies modifier keys", () => {
    expect(isModifierKey("ctrl")).toBe(true);
    expect(isModifierKey("alt")).toBe(true);
    expect(isModifierKey("shift")).toBe(true);
    expect(isModifierKey("enter")).toBe(false);
  });

  it("toggles one-shot modifiers and clears after non-modifier key", () => {
    let mods = createEmptyModifiers();
    mods = nextModifiersAfterPress(mods, "ctrl");
    expect(mods.ctrl).toBe(true);
    mods = nextModifiersAfterPress(mods, "alt");
    expect(mods.alt).toBe(true);
    mods = nextModifiersAfterPress(mods, "enter");
    expect(mods).toEqual({ ctrl: false, alt: false, shift: false });
  });

  it("returns terminal escape sequences for navigation and action keys", () => {
    const mods = createEmptyModifiers();
    expect(getTerminalSequence("esc", mods)).toBe("\x1b");
    expect(getTerminalSequence("tab", mods)).toBe("\t");
    expect(getTerminalSequence("enter", mods)).toBe("\r");
    expect(getTerminalSequence("up", mods)).toBe("\x1b[A");
    expect(getTerminalSequence("down", mods)).toBe("\x1b[B");
    expect(getTerminalSequence("left", mods)).toBe("\x1b[D");
    expect(getTerminalSequence("right", mods)).toBe("\x1b[C");
    expect(getTerminalSequence("backspace", mods)).toBe("\x7f");
    expect(getTerminalSequence("f2", mods)).toBe("\x1bOQ");
  });

  it("returns dedicated terminal sequence for Ctrl+C and Ctrl+V", () => {
    const mods = createEmptyModifiers();
    expect(getTerminalSequence("ctrl_c", mods)).toBe("\x03");
    expect(getTerminalSequence("ctrl_v", mods)).toBe("\x16");
  });

  it("supports Shift+Tab in terminal mode", () => {
    const mods = { ctrl: false, alt: false, shift: true };
    expect(getTerminalSequence("tab", mods)).toBe("\x1b[Z");
  });

  it("returns keyboard event payload for non-terminal shortcut mode", () => {
    expect(getAppShortcutKeyEvent("esc", createEmptyModifiers())).toEqual({
      key: "Escape",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    });
    expect(getAppShortcutKeyEvent("up", createEmptyModifiers())).toEqual({
      key: "ArrowUp",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    });
    expect(getAppShortcutKeyEvent("ctrl_c", createEmptyModifiers())).toEqual({
      key: "c",
      ctrlKey: true,
    });
    expect(getAppShortcutKeyEvent("f2", createEmptyModifiers())).toEqual({
      key: "F2",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    });
  });
});
