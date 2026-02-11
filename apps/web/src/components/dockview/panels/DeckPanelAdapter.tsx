import type { IDockviewPanelProps } from "dockview";
import { DeckPanel } from "../../panel/DeckPanel";
import { useDockviewContext } from "../DockviewContext";

/**
 * Adapter for Deck panel in dockview
 * Wraps DeckPanel with dockview context and params
 */
export function DeckPanelAdapter(
  props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  const ctx = useDockviewContext();
  const tab = props.params.tab;

  if (!tab.data.deck) {
    return <div className="panel-error">Missing deck data</div>;
  }

  const deck = tab.data.deck;
  const deckState = ctx.deckStates[deck.id];
  const wsState = ctx.workspaceStates[deck.workspaceId];
  const activeDeckId = ctx.activeDeckIds[deck.workspaceId];

  return (
    <DeckPanel
      deck={deck}
      deckId={deck.id}
      // FileTree props
      tree={wsState?.tree}
      treeLoading={wsState?.treeLoading}
      treeError={wsState?.treeError}
      gitFiles={ctx.gitFiles[deck.workspaceId]}
      onToggleDir={(node) => ctx.onToggleDir(deck.workspaceId, node)}
      onOpenFile={(node) => ctx.onOpenFile(deck.workspaceId, node)}
      onRefreshTree={() => ctx.onRefreshTree(deck.workspaceId)}
      onCreateFile={(path) => ctx.onCreateFile(deck.workspaceId, path)}
      onCreateDirectory={(path) => ctx.onCreateDirectory(deck.workspaceId, path)}
      onDeleteFile={(path) => ctx.onDeleteFile(deck.workspaceId, path)}
      onDeleteDirectory={(path) => ctx.onDeleteDirectory(deck.workspaceId, path)}
      // TerminalPane props
      terminals={deckState?.terminals}
      terminalGroups={[]} // TODO: Add to DeckState if needed
      wsBase={ctx.wsBase}
      isCreatingTerminal={false} // TODO: Add to DeckState if needed
      onDeleteTerminal={ctx.onDeleteTerminal}
      onReorderTerminals={ctx.onReorderTerminals}
      onCreateTerminal={() => ctx.onCreateTerminal(deck.id)}
    />
  );
}
