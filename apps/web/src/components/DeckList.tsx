interface DeckListItem {
  id: string;
  name: string;
  root: string;
  workspaceName: string;
}

interface DeckListProps {
  decks: DeckListItem[];
  activeDeckId: string | null;
  onSelect: (deckId: string) => void;
  onCreate: () => void;
}

export function DeckList({
  decks,
  activeDeckId,
  onSelect,
  onCreate
}: DeckListProps) {
  return (
    <section className="panel deck-list">
      <div className="panel-header">
        <div>
          <div className="panel-title">デッキ</div>
          <div className="panel-subtitle">同じワークスペースで複数作成可能</div>
        </div>
        <button type="button" className="chip" onClick={onCreate}>
          デッキ作成
        </button>
      </div>
      <div className="panel-body">
        {decks.map((deck) => (
          <button
            key={deck.id}
            type="button"
            className={`deck-item ${
              deck.id === activeDeckId ? 'is-active' : ''
            }`}
            onClick={() => onSelect(deck.id)}
          >
            <div className="deck-name">{deck.name}</div>
            <div className="deck-root">{deck.workspaceName}</div>
            <div className="deck-root">{deck.root}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
