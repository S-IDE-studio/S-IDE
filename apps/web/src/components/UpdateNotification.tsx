import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

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

export function UpdateNotification({
  updateInfo,
  onDownload,
  onSkip,
}: UpdateNotificationProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content update-notification-modal">
        <div className="modal-header">
          <h2 className="modal-title">{LABEL_TITLE}</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onSkip}
            aria-label="閉じる"
          >
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
              <span className="update-value update-version-new">
                {updateInfo.latest_version}
              </span>
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
          <button
            type="button"
            className="ghost-button"
            onClick={onSkip}
          >
            {LABEL_SKIP}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onDownload}
          >
            {LABEL_DOWNLOAD}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for update checking
export function useUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  const checkForUpdates = async () => {
    setIsChecking(true);
    try {
      const result = await invoke<UpdateInfo | null>("check_update");
      if (result) {
        setUpdateInfo(result);
        setShowNotification(true);
      }
    } catch (error) {
      console.error("Update check failed:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const downloadAndInstall = async () => {
    setIsDownloading(true);
    try {
      await invoke("download_and_install");
      // App will restart automatically
    } catch (error) {
      console.error("Download failed:", error);
      setIsDownloading(false);
      throw error;
    }
  };

  const skipUpdate = () => {
    setShowNotification(false);
    setUpdateInfo(null);
  };

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
