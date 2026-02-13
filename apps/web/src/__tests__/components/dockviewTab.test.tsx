import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DockviewTab } from "../../components/dockview/DockviewTab";
import type { UnifiedTab } from "../../types";

function createTab(overrides: Partial<UnifiedTab> = {}): UnifiedTab {
  return {
    id: "tab-1",
    kind: "editor",
    title: "main.ts",
    dirty: false,
    data: {
      editor: {
        id: "file-1",
        name: "main.ts",
        path: "/workspace/main.ts",
        language: "typescript",
        contents: "",
        dirty: false,
      },
    },
    ...overrides,
  };
}

describe("DockviewTab", () => {
  it("renders VSCode icon image for editor tab", () => {
    const tab = createTab();
    const api = { close: vi.fn() } as any;

    render(<DockviewTab api={api} params={{ tab }} /> as any);

    const icon = document.querySelector(".panel-tab-icon-img") as HTMLImageElement | null;
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("src")).toMatch(/^\/vscode-icons\/.+\.svg$/);
  });

  it("closes panel when close button is clicked", () => {
    const tab = createTab();
    const api = { close: vi.fn() } as any;

    render(<DockviewTab api={api} params={{ tab }} /> as any);

    screen.getByRole("button", { name: "Close" }).click();
    expect(api.close).toHaveBeenCalledTimes(1);
  });
});
