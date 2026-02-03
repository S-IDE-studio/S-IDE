import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";

const LABEL_TITLE = "更新をダウンロード中...";
const LABEL_PROGRESS = "ダウンロード進捗";
const LABEL_COMPLETE = "ダウンロード完了";
const LABEL_INSTALLING = "インストール中...";

interface UpdateProgressProps {
  onComplete?: () => void;
}

export function UpdateProgress({ onComplete }: UpdateProgressProps) {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const onCompleteRef = useRef(onComplete);

  // Keep ref in sync
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const unlistenProgress = listen<number>("update-progress", (event) => {
      setProgress(event.payload);
    });

    const unlistenComplete = listen("update-complete", () => {
      setIsComplete(true);
      setProgress(100);
      onCompleteRef.current?.();
    });

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
    };
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-content update-progress-modal">
        <div className="modal-header">
          <h2 className="modal-title">{isComplete ? LABEL_COMPLETE : LABEL_TITLE}</h2>
        </div>
        <div className="modal-body">
          <div className="update-progress-container">
            <div className="update-progress-info">
              <span className="update-progress-label">{LABEL_PROGRESS}</span>
              <span className="update-progress-percent">{Math.round(progress)}%</span>
            </div>
            <div className="update-progress-bar">
              <div className="update-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            {isComplete && <p className="update-progress-message">{LABEL_INSTALLING}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for listening to update events
export function useUpdateProgress() {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const unlistenProgress = listen<number>("update-progress", (event) => {
      setProgress(event.payload);
    });

    const unlistenComplete = listen("update-complete", () => {
      setIsComplete(true);
      setProgress(100);
    });

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
    };
  }, []);

  return { progress, isComplete };
}
