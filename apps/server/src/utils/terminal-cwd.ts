import type { Deck, Workspace } from "../types.js";

/**
 * Resolve the terminal working directory.
 * Prefer current workspace.path (source of truth), fall back to persisted deck.root.
 */
export function resolveTerminalCwd(deck: Deck, workspace?: Workspace): string {
  return workspace?.path || deck.root;
}
