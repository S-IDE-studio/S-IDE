import { useCallback, useEffect, useState } from "react";
import {
  createDeck as apiCreateDeck,
  createTerminal as apiCreateTerminal,
  deleteTerminal as apiDeleteTerminal,
  renameDeck as apiRenameDeck,
  listDecks,
  listTerminals,
} from "../api";
import type { Deck, TerminalGroup } from "../types";
import { createEmptyDeckState, getErrorMessage } from "../utils";

interface UseDecksProps {
  setStatusMessage: (message: string) => void;
  initializeDeckStates: (deckIds: string[]) => void;
  updateDeckState: (
    deckId: string,
    updater: (state: import("../types").DeckState) => import("../types").DeckState
  ) => void;
  deckStates: Record<string, import("../types").DeckState>;
  setDeckStates: React.Dispatch<React.SetStateAction<Record<string, import("../types").DeckState>>>;
  initialDeckIds?: string[];
}

export const useDecks = ({
  setStatusMessage,
  initializeDeckStates,
  updateDeckState,
  deckStates,
  setDeckStates,
  initialDeckIds,
}: UseDecksProps) => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckIds, setActiveDeckIds] = useState<string[]>(initialDeckIds ?? []);
  const [terminalGroups, setTerminalGroups] = useState<TerminalGroup[]>([]);
  const [creatingTerminalDeckIds, setCreatingTerminalDeckIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    listDecks()
      .then((data) => {
        if (signal.aborted) return;
        setDecks(data);
        initializeDeckStates(data.map((deck) => deck.id));
      })
      .catch((error: unknown) => {
        if (signal.aborted) return;
        setStatusMessage(`デッキを取得できませんでした: ${getErrorMessage(error)}`);
      });

    return () => {
      abortController.abort();
    };
  }, [setStatusMessage, initializeDeckStates]);

  useEffect(() => {
    // Don't do anything until decks are loaded
    if (decks.length === 0) {
      return;
    }
    // Filter out invalid deck IDs
    const validIds = activeDeckIds.filter((id) => decks.some((deck) => deck.id === id));
    // If all IDs are valid, keep them
    if (validIds.length === activeDeckIds.length && validIds.length > 0) {
      return;
    }
    // If we have some valid IDs, use them; otherwise fall back to first deck
    if (validIds.length > 0) {
      setActiveDeckIds(validIds);
    } else if (decks[0]) {
      setActiveDeckIds([decks[0].id]);
    }
  }, [decks, activeDeckIds]);

  // Load terminals for all active decks
  useEffect(() => {
    const abortControllers = new Map<string, AbortController>();

    activeDeckIds.forEach((deckId) => {
      const current = deckStates[deckId];
      if (current?.terminalsLoaded) return;

      const abortController = new AbortController();
      abortControllers.set(deckId, abortController);

      listTerminals(deckId)
        .then((sessions) => {
          if (abortController.signal.aborted) return;
          updateDeckState(deckId, (state) => ({
            ...state,
            terminals: sessions,
            terminalsLoaded: true,
          }));
        })
        .catch((error: unknown) => {
          if (abortController.signal.aborted) return;
          updateDeckState(deckId, (state) => ({
            ...state,
            terminalsLoaded: true,
          }));
          setStatusMessage(`ターミナルを取得できませんでした: ${getErrorMessage(error)}`);
        });
    });

    return () => {
      abortControllers.forEach((controller) => controller.abort());
    };
  }, [activeDeckIds, deckStates, updateDeckState, setStatusMessage]);

  // Helper to generate next deck number for a workspace
  const getNextDeckNumber = useCallback(
    (workspaceId: string) => {
      const workspaceDecks = decks.filter((d) => d.workspaceId === workspaceId);
      // Extract numbers from existing deck names (format: "Deck {number}")
      const existingNumbers = workspaceDecks
        .map((d) => {
          const match = d.name.match(/^Deck\s+(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0);
      const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      return maxNumber + 1;
    },
    [decks]
  );

  const handleCreateDeck = useCallback(
    async (name: string, workspaceId: string) => {
      try {
        // Generate default name if not provided
        const deckName = name.trim() || `Deck ${getNextDeckNumber(workspaceId)}`;
        const deck = await apiCreateDeck(deckName, workspaceId);
        setDecks((prev) => [...prev, deck]);
        setActiveDeckIds((prev) => [...prev.filter((id) => id !== deck.id), deck.id]);
        setDeckStates((prev) => ({
          ...prev,
          [deck.id]: createEmptyDeckState(),
        }));
        return deck;
      } catch (error: unknown) {
        setStatusMessage(`デッキの作成に失敗しました: ${getErrorMessage(error)}`);
        return null;
      }
    },
    [setStatusMessage, setDeckStates, getNextDeckNumber]
  );

  const handleCreateTerminal = useCallback(
    async (
      deckId: string,
      terminalsCount: number,
      command?: string,
      customTitle?: string
    ): Promise<{ id: string; title: string; command?: string } | null> => {
      console.log("[useDecks] handleCreateTerminal called:", {
        deckId,
        terminalsCount,
        command,
        customTitle,
      });
      // Set loading state
      setCreatingTerminalDeckIds((prev) => new Set(prev).add(deckId));
      try {
        const index = terminalsCount + 1;
        const title = customTitle || `ターミナル ${index}`;
        console.log("[useDecks] Creating terminal with title:", title);
        const session = await apiCreateTerminal(deckId, title, command);
        console.log("[useDecks] Terminal created:", session);
        const terminal = {
          id: session.id,
          title: session.title || title,
          command: command || "",
        };
        updateDeckState(deckId, (state) => {
          return {
            ...state,
            terminals: [...state.terminals, { id: terminal.id, title: terminal.title }],
            terminalsLoaded: true,
            view: "terminal",
          };
        });
        return terminal;
      } catch (error: unknown) {
        console.error("[useDecks] Failed to create terminal:", error);
        setStatusMessage(`ターミナルを起動できませんでした: ${getErrorMessage(error)}`);
        return null;
      } finally {
        // Clear loading state
        setCreatingTerminalDeckIds((prev) => {
          const next = new Set(prev);
          next.delete(deckId);
          return next;
        });
      }
    },
    [updateDeckState, setStatusMessage]
  );

  const handleDeleteTerminal = useCallback(
    async (deckId: string, terminalId: string) => {
      try {
        await apiDeleteTerminal(terminalId);
        updateDeckState(deckId, (state) => ({
          ...state,
          terminals: state.terminals.filter((t) => t.id !== terminalId),
        }));
      } catch (error: unknown) {
        setStatusMessage(`ターミナルを削除できませんでした: ${getErrorMessage(error)}`);
      }
    },
    [updateDeckState, setStatusMessage]
  );

  // Terminal group management functions
  const handleCreateGroup = useCallback((name: string, color: string) => {
    const newGroup: TerminalGroup = {
      id: `group-${Date.now()}`,
      name,
      color,
      terminalIds: [],
      collapsed: false,
    };
    setTerminalGroups((prev) => [...prev, newGroup]);
  }, []);

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      setTerminalGroups((prev) => prev.filter((g) => g.id !== groupId));
      // Ungroup terminals when group is deleted
      setDeckStates((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((deckId) => {
          updated[deckId] = {
            ...updated[deckId],
            terminals: updated[deckId].terminals.map((t) =>
              t.groupId === groupId ? { ...t, groupId: undefined } : t
            ),
          };
        });
        return updated;
      });
    },
    [setDeckStates]
  );

  const handleUpdateGroup = useCallback(
    (groupId: string, updates: Partial<Omit<TerminalGroup, "id">>) => {
      setTerminalGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g)));
    },
    []
  );

  const handleToggleGroupCollapsed = useCallback((groupId: string) => {
    setTerminalGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g))
    );
  }, []);

  const handleAssignTerminalToGroup = useCallback(
    (deckId: string, terminalId: string, groupId: string | undefined) => {
      updateDeckState(deckId, (state) => ({
        ...state,
        terminals: state.terminals.map((t) => (t.id === terminalId ? { ...t, groupId } : t)),
      }));
    },
    [updateDeckState]
  );

  const handleUpdateTerminalColor = useCallback(
    (deckId: string, terminalId: string, color: string | undefined) => {
      updateDeckState(deckId, (state) => ({
        ...state,
        terminals: state.terminals.map((t) => (t.id === terminalId ? { ...t, color } : t)),
      }));
    },
    [updateDeckState]
  );

  const handleUpdateTerminalTags = useCallback(
    (deckId: string, terminalId: string, tags: string[]) => {
      updateDeckState(deckId, (state) => ({
        ...state,
        terminals: state.terminals.map((t) => (t.id === terminalId ? { ...t, tags } : t)),
      }));
    },
    [updateDeckState]
  );

  const handleRenameDeck = useCallback(
    async (deckId: string, name: string) => {
      try {
        const updated = await apiRenameDeck(deckId, name);
        setDecks((prev) => prev.map((d) => (d.id === deckId ? updated : d)));
        return updated;
      } catch (error: unknown) {
        setStatusMessage(`デッキ名の変更に失敗しました: ${getErrorMessage(error)}`);
        return null;
      }
    },
    [setStatusMessage]
  );

  return {
    decks,
    activeDeckIds,
    setActiveDeckIds,
    terminalGroups,
    handleCreateDeck,
    handleRenameDeck,
    handleCreateTerminal,
    handleDeleteTerminal,
    handleCreateGroup,
    handleDeleteGroup,
    handleUpdateGroup,
    handleToggleGroupCollapsed,
    handleAssignTerminalToGroup,
    handleUpdateTerminalColor,
    handleUpdateTerminalTags,
    creatingTerminalDeckIds,
  };
};
