import { createContext, useContext } from "react";
import type { DockviewApi } from "dockview";
import type {
  Deck,
  DeckState,
  FileTreeNode,
  GitFileStatus,
  TerminalSession,
  UnifiedTab,
  WorkspaceState,
} from "../../types";

/**
 * Context value for dockview panel components
 * Provides shared state and handlers that cannot be passed through dockview params
 * (because params should be serializable, not functions or React objects)
 */
export interface DockviewContextValue {
  // Workspace related
  workspaceStates: Record<string, WorkspaceState>;
  updateWorkspaceState: (id: string, state: Partial<WorkspaceState>) => void;

  // Deck related
  decks: Deck[];
  deckStates: Record<string, DeckState>;
  activeDeckIds: Record<string, string>;

  // Git
  gitFiles: Record<string, GitFileStatus[]>;

  // File operations
  onToggleDir: (wsId: string, node: FileTreeNode) => void;
  onOpenFile: (wsId: string, node: FileTreeNode) => void;
  onRefreshTree: (wsId: string) => void;
  onCreateFile: (wsId: string, path: string) => void;
  onCreateDirectory: (wsId: string, path: string) => void;
  onDeleteFile: (wsId: string, path: string) => void;
  onDeleteDirectory: (wsId: string, path: string) => void;

  // Editor operations
  onChangeFile: (fileId: string, content: string) => void;
  onSaveFile: (fileId: string) => void;
  savingFileId: string | null;

  // Terminal operations
  wsBase: string;
  onDeleteTerminal: (termId: string) => void;
  onReorderTerminals: (deckId: string, newOrder: TerminalSession[]) => void;
  onCreateTerminal: (deckId: string, command?: string) => void;

  // Tab operations
  openTab: (tab: UnifiedTab) => void;

  // DockviewApi
  dockviewApi: DockviewApi | null;
}

const DockviewContext = createContext<DockviewContextValue | null>(null);

/**
 * Hook to access dockview context
 * Throws an error if used outside of DockviewContextProvider
 */
export function useDockviewContext(): DockviewContextValue {
  const context = useContext(DockviewContext);
  if (!context) {
    throw new Error(
      "useDockviewContext must be used within a DockviewContextProvider"
    );
  }
  return context;
}

/**
 * Provider component for dockview context
 * Wrap DockviewLayout with this provider to supply context to panel components
 */
export interface DockviewContextProviderProps {
  children: React.ReactNode;
  value: DockviewContextValue;
}

export function DockviewContextProvider({
  children,
  value,
}: DockviewContextProviderProps): React.JSX.Element {
  return (
    <DockviewContext.Provider value={value}>{children}</DockviewContext.Provider>
  );
}
