/**
 * Resolve the terminal working directory.
 * Prefer current workspace.path (source of truth), fall back to persisted deck.root.
 */
export function resolveTerminalCwd(deck, workspace) {
  return workspace?.path || deck.root;
}
