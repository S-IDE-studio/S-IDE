interface DeckPanelProps {
  deck: { id: string; name: string; root: string; workspaceId: string };
}

export function DeckPanel({ deck }: DeckPanelProps) {
  return <div className="deck-panel-content">Deck: {deck.name}</div>;
}
