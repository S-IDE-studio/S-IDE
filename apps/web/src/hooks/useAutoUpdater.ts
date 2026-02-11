import { useEffect, useState } from "react";

// Check if running in Tauri
function isTauriApp(): boolean {
  return (
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
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

  const checkForUpdates = async () => {
    if (!isTauriApp()) {
      setError("Updates are only available in the desktop app");
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");

      const update = await check();

      if (update?.available) {
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
    } catch (err) {
      console.error("[AutoUpdater] Check failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsChecking(false);
    }
  };

  const installUpdate = async () => {
    if (!updateInfo.available) return;

    setIsInstalling(true);
    setError(null);

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");

      const update = await check();

      if (update?.available) {
        console.log("[AutoUpdater] Downloading and installing update...");
        await update.downloadAndInstall();

        console.log("[AutoUpdater] Update installed, relaunching...");
        await relaunch();
      }
    } catch (err) {
      console.error("[AutoUpdater] Install failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setIsInstalling(false);
    }
  };

  // Check on mount
  useEffect(() => {
    if (isTauriApp()) {
      checkForUpdates();
    }
  }, []);

  return {
    updateInfo,
    isChecking,
    isInstalling,
    error,
    checkForUpdates,
    installUpdate,
  };
}
