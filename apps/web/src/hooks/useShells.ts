/**
 * Hook for managing shell selection and available shells
 */

import type { ShellInfo } from "@side-ide/shared/types";
import { useCallback, useEffect, useState } from "react";
import { getAvailableShells, getDefaultShell, setDefaultShell as setDefaultShellApi } from "../api";

interface UseShellsResult {
  shells: ShellInfo[];
  defaultShell: ShellInfo | null;
  isUserConfigured: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setDefaultShell: (shellId: string) => Promise<void>;
}

export function useShells(): UseShellsResult {
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [defaultShell, setDefaultShellState] = useState<ShellInfo | null>(null);
  const [isUserConfigured, setIsUserConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShells = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shellsData, defaultShellData] = await Promise.all([
        getAvailableShells(),
        getDefaultShell(),
      ]);
      setShells(shellsData.shells);
      setDefaultShellState(defaultShellData);
      setIsUserConfigured(defaultShellData.isUserConfigured);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load shells";
      setError(message);
      console.error("[useShells] Failed to load shells:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shellsData, defaultShellData] = await Promise.all([
        getAvailableShells(),
        getDefaultShell(),
      ]);
      setShells(shellsData.shells);
      setDefaultShellState(defaultShellData);
      setIsUserConfigured(defaultShellData.isUserConfigured);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh shells";
      setError(message);
      console.error("[useShells] Failed to refresh shells:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const setDefaultShell = useCallback(async (shellId: string) => {
    try {
      const result = await setDefaultShellApi(shellId);
      setDefaultShellState(result.shell);
      setIsUserConfigured(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to set default shell";
      setError(message);
      console.error("[useShells] Failed to set default shell:", err);
      throw err;
    }
  }, []);

  useEffect(() => {
    loadShells();
  }, [loadShells]);

  return {
    shells,
    defaultShell,
    isUserConfigured,
    loading,
    error,
    refresh,
    setDefaultShell,
  };
}
