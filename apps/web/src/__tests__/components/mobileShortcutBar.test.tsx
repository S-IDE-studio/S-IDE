import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MobileShortcutBar } from "../../components/MobileShortcutBar";

describe("MobileShortcutBar", () => {
  it("sends terminal sequence in terminal mode", () => {
    const onTerminalInput = vi.fn();
    const onAppShortcut = vi.fn();
    render(
      <MobileShortcutBar
        isMobileMode={true}
        activeTabKind="terminal"
        onTerminalInput={onTerminalInput}
        onAppShortcut={onAppShortcut}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Esc" }));
    expect(onTerminalInput).toHaveBeenCalledWith("\x1b");
    expect(onAppShortcut).not.toHaveBeenCalled();
  });

  it("applies one-shot modifier to next key only", () => {
    const onTerminalInput = vi.fn();
    render(
      <MobileShortcutBar
        isMobileMode={true}
        activeTabKind="terminal"
        onTerminalInput={onTerminalInput}
        onAppShortcut={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Shift" }));
    fireEvent.click(screen.getByRole("button", { name: "Tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Tab" }));

    expect(onTerminalInput.mock.calls[0]?.[0]).toBe("\x1b[Z");
    expect(onTerminalInput.mock.calls[1]?.[0]).toBe("\t");
  });

  it("routes to app shortcuts when non-terminal panel is active", () => {
    const onAppShortcut = vi.fn();
    const onTerminalInput = vi.fn();

    render(
      <MobileShortcutBar
        isMobileMode={true}
        activeTabKind="editor"
        onTerminalInput={onTerminalInput}
        onAppShortcut={onAppShortcut}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Ctrl+C" }));
    expect(onAppShortcut.mock.calls[0]?.[0]).toEqual({
      key: "c",
      ctrlKey: true,
    });
    expect(onTerminalInput).not.toHaveBeenCalled();
  });
});
