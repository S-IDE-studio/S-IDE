import fs from "node:fs/promises";
import path from "node:path";
import {
  getWorkspaceKey as sharedGetWorkspaceKey,
  getWorkspaceName as sharedGetWorkspaceName,
  normalizeWorkspacePath as sharedNormalizeWorkspacePath,
} from "@side-ide/shared/utils-node";
import { DEFAULT_ROOT } from "../config.js";
import { createHttpError, type HttpError } from "./error.js";

export function normalizeWorkspacePath(inputPath = ""): string {
  return sharedNormalizeWorkspacePath(inputPath || "", DEFAULT_ROOT);
}

export function getWorkspaceKey(workspacePath: string): string {
  return sharedGetWorkspaceKey(workspacePath);
}

export function getWorkspaceName(workspacePath: string, index: number): string {
  return sharedGetWorkspaceName(workspacePath, index);
}

/**
 * Validates and resolves a path safely within a workspace root.
 * Prevents path traversal and symlink escape attacks.
 */
export async function resolveSafePath(workspacePath: string, inputPath = ""): Promise<string> {
  // Validate input path is a string
  if (typeof inputPath !== "string") {
    throw createHttpError("Invalid path: path must be a string", 400);
  }

  // Check for null bytes (path traversal via null byte injection)
  if (inputPath.includes("\0")) {
    throw createHttpError("Invalid path: null bytes not allowed", 400);
  }

  // Check for excessive length
  if (inputPath.length > 1000) {
    throw createHttpError("Invalid path: path too long", 400);
  }

  // Normalize the input to prevent directory traversal
  const normalizedInput = path.normalize(inputPath);

  // Check for obvious path traversal attempts (after normalization)
  if (normalizedInput.includes("..")) {
    throw createHttpError("Invalid path: path traversal not allowed", 400);
  }

  // Don't allow absolute paths
  if (path.isAbsolute(normalizedInput)) {
    throw createHttpError("Invalid path: absolute paths not allowed", 400);
  }

  // Resolve workspace root to absolute path
  const root = path.resolve(workspacePath);

  // Validate root path exists
  try {
    await fs.access(root);
  } catch {
    throw createHttpError("Workspace root does not exist", 400);
  }

  // Join root with normalized input
  const resolved = path.join(root, normalizedInput);

  // Double-check the resolved path is within root using path.relative
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw createHttpError("Path escapes workspace root", 400);
  }

  // Additional check: ensure resolved path starts with root
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw createHttpError("Path escapes workspace root", 400);
  }

  // Try to resolve the real path (following symlinks)
  try {
    const realPath = await fs.realpath(resolved);
    const realRoot = await fs.realpath(root);

    // Ensure the real path is still within the real root
    const realRelative = path.relative(realRoot, realPath);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      throw createHttpError("Symlink target escapes workspace root", 400);
    }

    // Additional check: ensure real path starts with real root
    if (!realPath.startsWith(realRoot + path.sep) && realPath !== realRoot) {
      throw createHttpError("Symlink target escapes workspace root", 400);
    }

    return realPath;
  } catch (error) {
    // If it's an HttpError we threw, re-throw it
    if ((error as HttpError)?.status) {
      throw error;
    }

    // File might not exist yet (e.g., for new file creation)
    // Verify the parent directory is safe
    const parentDir = path.dirname(resolved);

    try {
      const realParent = await fs.realpath(parentDir);
      const realRoot = await fs.realpath(root);

      const parentRelative = path.relative(realRoot, realParent);
      if (parentRelative.startsWith("..") || path.isAbsolute(parentRelative)) {
        throw createHttpError("Parent directory escapes workspace root", 400);
      }

      // Additional check: ensure parent starts with real root
      if (!realParent.startsWith(realRoot + path.sep) && realParent !== realRoot) {
        throw createHttpError("Parent directory escapes workspace root", 400);
      }

      // Parent is safe, return the unresolved path for the new file
      return resolved;
    } catch (parentError) {
      // If parent doesn't exist, check if we're still within root
      if ((parentError as HttpError)?.status) {
        throw parentError;
      }

      // Verify the resolved path is still within root bounds
      if (!resolved.startsWith(root + path.sep) && resolved !== root) {
        throw createHttpError("Path escapes workspace root", 400);
      }

      return resolved;
    }
  }
}

/**
 * Validates a file path without resolving it.
 * Useful for quick validation before more expensive operations.
 */
export function validatePathSyntax(inputPath: string): boolean {
  if (!inputPath || typeof inputPath !== "string") {
    return false;
  }

  // Check for null bytes
  if (inputPath.includes("\0")) {
    return false;
  }

  // Check for path traversal
  const normalized = path.normalize(inputPath);
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    return false;
  }

  // Check for excessive length
  if (inputPath.length > 1000) {
    return false;
  }

  return true;
}
