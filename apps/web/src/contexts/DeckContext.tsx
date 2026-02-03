/**
 * Deck Context
 *
 * Provides deck state and operations throughout the app
 */

import { createContext, useCallback, useContext, useState } from "react";
import type { Deck, DeckState, TerminalGroup } from "../types";
import { createEmptyDeckState } from "../utils";

export interface DeckContextValue {
  decks: Deck[];
  deckStates: Record<string, DeckState>;
  activeDeckIds: string[];
  terminalGroups: TerminalGroup[];
  creatingTerminalDeckIds: Set<string>;
  setDecks: React.Dispatch<React.SetStateAction<Deck[]>>;
  setDeckStates: React.Dispatch<React.SetStateAction<Record<string, DeckState>>>;
  setActiveDeckIds: React.Dispatch<React.SetStateAction<string[]>>;
  setTerminalGroups: React.Dispatch<React.SetStateAction<TerminalGroup[]>>;
  setCreatingTerminalDeckIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  updateDeckState: (deckId: string, updater: (state: DeckState) => DeckState) => void;
  initializeDeckStates: (deckIds: string[]) => void;
  getActiveDeckStates: () => DeckState[];
  getWorkspaceById: (workspaceId: string) => Deck | undefined;
}

export const DeckContext = createContext<DeckContextValue | null>(null);

interface DeckProviderProps {
  children: React.ReactNode;
}

export function DeckProvider({ children }: DeckProviderProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckStates, setDeckStates] = useState<Record<string, DeckState>>({});
  const [activeDeckIds, setActiveDeckIds] = useState<string[]>([]);
  const [terminalGroups, setTerminalGroups] = useState<TerminalGroup[]>([]);
  const [creatingTerminalDeckIds, setCreatingTerminalDeckIds] = useState<Set<string>>(new Set());

  const updateDeckState = useCallback(
    (deckId: string, updater: (state: DeckState) => DeckState) => {
      setDeckStates((prev) => {
        const current = prev[deckId] || createEmptyDeckState();
        return { ...prev, [deckId]: updater(current) };
      });
    },
    []
  );

  const initializeDeckStates = useCallback((deckIds: string[]) => {
    setDeckStates((prev) => {
      const next = { ...prev };
      deckIds.forEach((id) => {
        if (!next[id]) {
          next[id] = createEmptyDeckState();
        }
      });
      return next;
    });
  }, []);

  const getActiveDeckStates = useCallback((): DeckState[] => {
    return activeDeckIds.map((deckId) => deckStates[deckId] || createEmptyDeckState());
  }, [activeDeckIds, deckStates]);

  const getWorkspaceById = useCallback(
    (workspaceId: string): Deck | undefined => {
      return decks.find((deck) => deck.workspaceId === workspaceId);
    },
    [decks]
  );

  const value: DeckContextValue = {
    decks,
    deckStates,
    activeDeckIds,
    terminalGroups,
    creatingTerminalDeckIds,
    setDecks,
    setDeckStates,
    setActiveDeckIds,
    setTerminalGroups,
    setCreatingTerminalDeckIds,
    updateDeckState,
    initializeDeckStates,
    getActiveDeckStates,
    getWorkspaceById,
  };

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeckContext(): DeckContextValue {
  const context = useContext(DeckContext);
  if (!context) {
    throw new Error("useDeckContext must be used within DeckProvider");
  }
  return context;
}
