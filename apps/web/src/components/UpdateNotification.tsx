import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { useEffect, useState } from "react";

interface UpdateInfo {
  current_version: string;
  latest_version: string;
  body: string;
  date: string;
}

interface UpdateNotificationProps {
  updateInfo: UpdateInfo;
  onDownload: () => void;
  onSkip: () => void;
}

const LABEL_TITLE = "更新が利用可能です";
const LABEL_CURRENT = "現在のバージョン";
const LABEL_LATEST = "最新のバージョン";
const LABEL_RELEASE_NOTES = "リリースノート";
const LABEL_DOWNLOAD = "今すぐ更新";
const LABEL_SKIP = "スキップ";

export function UpdateNotification({ updateInfo, onDownload, onSkip }: UpdateNotificationProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content update-notification-modal">
        <div className="modal-header">
          <h2 className="modal-title">{LABEL_TITLE}</h2>
          <button type="button" className="modal-close-btn" onClick={onSkip} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="update-info">
            <div className="update-version-row">
              <span className="update-label">{LABEL_CURRENT}:</span>
              <span className="update-value">{updateInfo.current_version}</span>
            </div>
            <div className="update-version-row">
              <span className="update-label">{LABEL_LATEST}:</span>
              <span className="update-value update-version-new">{updateInfo.latest_version}</span>
            </div>
            <div className="update-date">公開日: {updateInfo.date}</div>
          </div>

          {updateInfo.body && (
            <div className="update-release-notes">
              <h3 className="update-section-title">{LABEL_RELEASE_NOTES}</h3>
              <div className="update-release-notes-body">
                {updateInfo.body.split("\n").map((line, index) => {
                  // Simple markdown-like parsing
                  if (line.startsWith("## ")) {
                    return (
                      <h4 key={index} className="release-note-subheading">
                        {line.substring(3)}
                      </h4>
                    );
                  }
                  if (line.startsWith("- ")) {
                    return (
                      <li key={index} className="release-note-item">
                        {line.substring(2)}
                      </li>
                    );
                  }
                  if (line.trim()) {
                    return (
                      <p key={index} className="release-note-paragraph">
                        {line}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="ghost-button" onClick={onSkip}>
            {LABEL_SKIP}
          </button>
          <button type="button" className="primary-button" onClick={onDownload}>
            {LABEL_DOWNLOAD}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for update checking using Tauri 2.0 updater plugin
export function useUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [update, setUpdate] =
    useState<ReturnType<typeof check> extends Promise<infer T> ? T : null>(null);

  const checkForUpdates = async () => {
    console.log("[UpdateCheck] Starting update check...");
    setIsChecking(true);
    try {
      const result = await check();
      console.log("[UpdateCheck] Update check result:", result);

      if (result?.available) {
        console.log("[UpdateCheck] Update available:", {
          current: result.currentVersion,
          latest: result.version,
        });
        setUpdate(result);
        setUpdateInfo({
          current_version: result.currentVersion,
          latest_version: result.version,
          body: result.body || "",
          date: result.date || "",
        });
        setShowNotification(true);
      } else {
        console.log("[UpdateCheck] No update available. Current version is up to date.");
      }
      setIsChecking(false);
    } catch (error) {
      console.error("[UpdateCheck] Update check failed:", error);
      setIsChecking(false);
    }
  };

  const downloadAndInstall = async () => {
    if (!update) return;
    setIsDownloading(true);
    try {
      // Download and install the update
      await update.downloadAndInstall();
      // Relaunch the app
      await relaunch();
    } catch (error) {
      console.error("Download failed:", error);
      setIsDownloading(false);
      throw error;
    }
  };

  const skipUpdate = () => {
    setShowNotification(false);
    setUpdateInfo(null);
    setUpdate(null);
  };

  // Cleanup function to reset state on unmount
  useEffect(() => {
    return () => {
      // Reset any pending states when component unmounts
      setIsChecking(false);
      setIsDownloading(false);
    };
  }, []);

  // Check for updates on mount (only in Tauri app)
  useEffect(() => {
    // Check if running in Tauri
    const isTauri =
      typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

    if (isTauri) {
      // Wait a bit before checking to let the app settle
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 3000); // 3 seconds delay

      return () => clearTimeout(timer);
    }
  }, []);

  return {
    updateInfo,
    isChecking,
    isDownloading,
    showNotification,
    checkForUpdates,
    downloadAndInstall,
    skipUpdate,
  };
}
