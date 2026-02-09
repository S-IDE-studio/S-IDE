export * from "./utils.js";
/**
 * Normalize a workspace path to an absolute path (Node.js version)
 * @param inputPath - Input path (can be relative or absolute)
 * @param defaultPath - Default path to use if inputPath is empty
 * @returns Normalized absolute path
 */
export declare function normalizeWorkspacePath(inputPath: string, defaultPath: string): string;
/**
 * Get a workspace key for indexing (handles case-insensitivity on Windows)
 * Node.js version with proper platform detection
 * @param workspacePath - Workspace path
 * @returns Normalized key for indexing
 */
export declare function getWorkspaceKey(workspacePath: string): string;
/**
 * Extract a workspace name from its path (Node.js version)
 * @param workspacePath - Workspace path
 * @param fallbackIndex - Index to use for fallback name
 * @returns Workspace name
 */
export declare function getWorkspaceName(workspacePath: string, fallbackIndex: number): string;
//# sourceMappingURL=utils-node.d.ts.map
