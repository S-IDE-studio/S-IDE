import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeckPanel } from "../../components/panel/DeckPanel";

describe("DeckPanel", () => {
  it("renders file-tree-only layout with VSCode-like header controls", () => {
    render(
      <DeckPanel
        deck={{ id: "deck-1", name: "Deck 1", root: "/workspace/my-app", workspaceId: "ws-1" }}
        deckId="deck-1"
        tree={[]}
        onDeleteTerminal={() => {}}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        onRefreshTree={() => {}}
      />
    );

    expect(screen.getByText("my-app")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新規ファイル" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新規フォルダ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
    expect(screen.queryByText("Terminal")).not.toBeInTheDocument();
  });

  it("renders file icons as image elements in deck tree", () => {
    render(
      <DeckPanel
        deck={{ id: "deck-1", name: "Deck 1", root: "/workspace/my-app", workspaceId: "ws-1" }}
        deckId="deck-1"
        tree={[
          {
            name: "main.ts",
            path: "/workspace/my-app/main.ts",
            type: "file",
            expanded: false,
            loading: false,
          },
        ]}
        onDeleteTerminal={() => {}}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        onRefreshTree={() => {}}
      />
    );

    const iconImg = document.querySelector(".tree-icon-img");
    expect(iconImg).toBeTruthy();
    expect((iconImg as HTMLImageElement).getAttribute("src")).toMatch(/^\/vscode-icons\//);
  });
});
