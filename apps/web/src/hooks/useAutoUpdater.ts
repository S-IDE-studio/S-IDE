import type { Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";

// Check if running in Tauri
function isTauriApp(): boolean {
  return (
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

// Lazy load Tauri modules to avoid dynamic imports in component
let updaterModule: typeof import("@tauri-apps/plugin-updater") | null = null;
let processModule: typeof import("@tauri-apps/plugin-process") | null = null;

async function loadTauriModules() {
  if (!updaterModule) {
    updaterModule = await import("@tauri-apps/plugin-updater");
  }
  if (!processModule) {
    processModule = await import("@tauri-apps/plugin-process");
  }
  return { updater: updaterModule, process: processModule };
}

export interface UpdateInfo {
  available: boolean;
  version?: string;
  currentVersion?: string;
  body?: string;
  date?: string;
}

export function useAutoUpdater() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ available: false });
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    if (!isTauriApp()) {
      setError("Updates are only available in the desktop app");
      return;
    }

    setIsChecking(true);
    setError(null);

    let update: Update | null = null;
    let checkError: unknown = null;

    try {
      const { updater } = await loadTauriModules();
      update = await updater.check();
    } catch (err) {
      checkError = err;
    }

    // Handle conditional logic outside try/catch for React Compiler optimization
    if (checkError) {
      console.error("[AutoUpdater] Check failed:", checkError);
      setError(checkError instanceof Error ? checkError.message : String(checkError));
      setIsChecking(false);
      return;
    }

    if (update && update.available) {
      setUpdateInfo({
        available: true,
        version: update.version,
        currentVersion: update.currentVersion,
        body: update.body,
        date: update.date,
      });
    } else {
      setUpdateInfo({ available: false });
    }
    setIsChecking(false);
  }, []);

  const installUpdate = useCallback(async () => {
    if (!updateInfo.available) return;

    setIsInstalling(true);
    setError(null);

    let update: Update | null = null;
    let modules: Awaited<ReturnType<typeof loadTauriModules>> | null = null;
    let installError: unknown = null;

    try {
      modules = await loadTauriModules();
      update = await modules.updater.check();
    } catch (err) {
      installError = err;
    }

    // Handle conditional logic outside try/catch for React Compiler optimization
    if (installError) {
      console.error("[AutoUpdater] Install failed:", installError);
      setError(installError instanceof Error ? installError.message : String(installError));
      setIsInstalling(false);
      return;
    }

    if (update && update.available && modules) {
      try {
        console.log("[AutoUpdater] Downloading and installing update...");
        await update.downloadAndInstall();

        console.log("[AutoUpdater] Update installed, relaunching...");
        await modules.process.relaunch();
      } catch (err) {
        console.error("[AutoUpdater] Install failed:", err);
        setError(err instanceof Error ? err.message : String(err));
        setIsInstalling(false);
        return;
      }
    }
  }, [updateInfo.available]);

  // Check on mount
  useEffect(() => {
    if (isTauriApp()) {
      void checkForUpdates();
    }
  }, [checkForUpdates]);

  return {
    updateInfo,
    isChecking,
    isInstalling,
    error,
    checkForUpdates,
    installUpdate,
  };
}
