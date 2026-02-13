import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GlobalStatusBar } from "../../components/GlobalStatusBar";

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

describe("GlobalStatusBar responsiveness", () => {
  it("keeps connection and stats visible in compact mode", () => {
    render(
      <GlobalStatusBar
        activeTerminalsCount={3}
        contextHealthScore={91}
        onToggleContextStatus={() => {}}
        onOpenEnvironmentModal={() => {}}
      />
    );

    act(() => {
      setViewportWidth(1100);
    });

    expect(screen.getByText("WebSocket: Active")).toBeInTheDocument();
    expect(screen.getByText("Terminals: 3")).toBeInTheDocument();
    expect(screen.queryByText("Environment")).toBeNull();
  });

  it("keeps connection and stats visible in minimal mode", () => {
    render(
      <GlobalStatusBar
        activeTerminalsCount={5}
        contextHealthScore={72}
        onToggleContextStatus={() => {}}
        onOpenEnvironmentModal={() => {}}
      />
    );

    act(() => {
      setViewportWidth(840);
    });

    expect(screen.getByText("WS: On")).toBeInTheDocument();
    expect(screen.getByText("T:5")).toBeInTheDocument();
    expect(screen.queryByText("Context: 72%")).toBeNull();
    expect(screen.queryByText("Environment")).toBeNull();
  });
});
