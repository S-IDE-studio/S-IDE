import { memo } from "react";
import { TerminalPane } from "../TerminalPane";
import type { TerminalSession, TerminalGroup } from "../../types";

interface DeckPanelProps {
  deck: { id: string; name: string; root: string; workspaceId: string };
  // TerminalPane props
  terminals?: TerminalSession[];
  wsBase?: string;
  deckId: string;
  onDeleteTerminal: (terminalId: string) => void;
  onReorderTerminals?: (deckId: string, newOrder: TerminalSession[]) => void;
  terminalGroups?: TerminalGroup[];
  onCreateTerminal?: () => void;
  onToggleGroupCollapsed?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onRenameGroup?: (groupId: string) => void;
  isCreatingTerminal?: boolean;
}

export function DeckPanel({
  deck,
  terminals = [],
  wsBase = "",
  deckId,
  onDeleteTerminal,
  onReorderTerminals,
  terminalGroups = [],
  onCreateTerminal,
  onToggleGroupCollapsed,
  onDeleteGroup,
  onRenameGroup,
  isCreatingTerminal = false,
}: DeckPanelProps) {
  return (
    <div className="deck-panel-content">
      <TerminalPane
        terminals={terminals}
        wsBase={wsBase}
        deckId={deckId}
        onDeleteTerminal={onDeleteTerminal}
        onReorderTerminals={onReorderTerminals}
        terminalGroups={terminalGroups}
        onCreateTerminal={onCreateTerminal}
        onToggleGroupCollapsed={onToggleGroupCollapsed}
        onDeleteGroup={onDeleteGroup}
        onRenameGroup={onRenameGroup}
        isCreatingTerminal={isCreatingTerminal}
      />
    </div>
  );
}

export const MemoizedDeckPanel = memo(DeckPanel);
