/**
 * Get a workspace key for indexing (handles case-insensitivity on Windows)
 * Note: For Node.js environments, use utils-node.ts for proper platform detection.
 * This browser version has limited platform detection capabilities.
 * @param workspacePath - Workspace path
 * @returns Normalized key for indexing
 */
export declare function getWorkspaceKey(workspacePath: string): string;
/**
 * Extract a workspace name from its path
 * @param workspacePath - Workspace path
 * @param fallbackIndex - Index to use for fallback name
 * @returns Workspace name
 */
export declare function getWorkspaceName(workspacePath: string, fallbackIndex: number): string;
/**
 * Normalize a workspace path to an absolute path
 * Note: For Node.js usage, import from utils-node.ts for proper path resolution using Node.js path module.
 * @param inputPath - Input path (can be relative or absolute)
 * @param defaultPath - Default path to use if inputPath is empty
 * @returns Normalized absolute path
 */
export declare function normalizeWorkspacePath(inputPath: string, defaultPath: string): string;
/**
 * Get file extension from a path
 * Handles query strings and URLs correctly
 * @param filePath - File path (may contain query strings or URLs)
 * @returns File extension (without dot) or empty string
 */
export declare function getFileExtension(filePath: string): string;
/**
 * Map file extension to Monaco editor language
 * @param filePath - File path
 * @returns Monaco language identifier
 */
export declare function getLanguageFromPath(filePath: string): string;
/**
 * Normalize path separators to forward slashes
 * @param inputPath - Input path
 * @returns Path with forward slashes
 */
export declare function normalizePathSeparators(inputPath: string): string;
/**
 * Check if a file or directory name is hidden (starts with .)
 * Note: This is a simple check for Unix-style hidden files (names starting with dot).
 * On Windows, files marked as hidden via attributes won't be detected by this function.
 * @param name - File or directory name (not full path)
 * @returns True if the name indicates a hidden file/directory
 */
export declare function isHidden(name: string): boolean;
/**
 * Get error message from unknown error type
 * @param error - Error object
 * @returns Error message string
 */
export declare function getErrorMessage(error: unknown): string;
/**
 * HTTP Error class with status code
 */
export declare class HttpError extends Error {
  status: number;
  /**
   * Create an HTTP error with status code
   * @param message - Error message
   * @param status - HTTP status code
   */
  constructor(message: string, status: number);
}
/**
 * Create an HTTP error with status code (legacy function for backwards compatibility)
 * @param message - Error message
 * @param status - HTTP status code
 * @returns HttpError instance
 * @deprecated Use HttpError class directly
 */
export declare function createHttpError(message: string, status: number): HttpError;
/**
 * Truncate string to max length with ellipsis
 * @param str - Input string
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export declare function truncate(str: string, maxLength: number): string;
/**
 * Generate a short ID from a UUID (first 8 characters)
 * @param uuid - Full UUID
 * @returns Short ID
 * @throws Error if uuid is invalid (less than 8 characters)
 */
export declare function shortId(uuid: string): string;
/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export declare function formatFileSize(bytes: number): string;
/**
 * Sort file system entries (directories first, then alphabetically)
 * @param entries - Array of file system entries
 * @returns Sorted array (new array, input is not mutated)
 */
export declare function sortFileEntries<
  T extends {
    name: string;
    type: "file" | "dir";
  },
>(entries: T[]): T[];
//# sourceMappingURL=utils.d.ts.map
