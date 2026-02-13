import type { Deck, UnifiedTab } from "../types";

type ResolveArgs = {
  activePanelTab: UnifiedTab | null;
  decks: Deck[];
  activeDeckIds: string[];
  editorWorkspaceId: string | null;
};

function firstDeckForWorkspace(
  decks: Deck[],
  workspaceId: string,
  activeDeckIds: string[]
): Deck | null {
  for (const id of activeDeckIds) {
    const d = decks.find((deck) => deck.id === id && deck.workspaceId === workspaceId);
    if (d) return d;
  }
  return decks.find((deck) => deck.workspaceId === workspaceId) || null;
}

export function resolveDeckIdForNewTerminal({
  activePanelTab,
  decks,
  activeDeckIds,
  editorWorkspaceId,
}: ResolveArgs): string | null {
  if (activePanelTab?.kind === "deck") {
    const deckId = activePanelTab.data.deck?.id;
    if (deckId && decks.some((d) => d.id === deckId)) return deckId;
  }

  const workspaceIdFromTab =
    activePanelTab?.kind === "workspace"
      ? activePanelTab.data.workspace?.id
      : activePanelTab?.kind === "deck"
        ? activePanelTab.data.deck?.workspaceId
        : activePanelTab?.kind === "terminal"
          ? activePanelTab.data.terminal?.workspaceId || null
          : null;

  const workspaceId = workspaceIdFromTab || editorWorkspaceId;
  if (workspaceId) {
    const deck = firstDeckForWorkspace(decks, workspaceId, activeDeckIds);
    if (deck) return deck.id;
  }

  const firstActiveDeck = activeDeckIds.find((id) => decks.some((d) => d.id === id));
  if (firstActiveDeck) return firstActiveDeck;

  return decks[0]?.id || null;
}
