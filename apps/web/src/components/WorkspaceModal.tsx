import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

// Check if running in Tauri (Tauri v2 uses __TAURI_INTERNALS__)
// This must be evaluated at runtime, not at module load time
function isTauriApp(): boolean {
  return typeof window !== "undefined" && (
    "__TAURI_INTERNALS__" in window || 
    "__TAURI__" in window
  );
}

interface WorkspaceModalProps {
  isOpen: boolean;
  defaultRoot: string;
  onSubmit: (path: string) => Promise<void>;
  onClose: () => void;
}

export const WorkspaceModal = ({ isOpen, defaultRoot, onSubmit, onClose }: WorkspaceModalProps) => {
  // Check if running in Tauri (evaluated once per component mount)
  const isInTauriApp = useMemo(() => isTauriApp(), []);
  
  const [workspacePath, setWorkspacePath] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setWorkspacePath("");
    }
  }, [isOpen]);

  const handleSelectFolder = async () => {
    if (isInTauriApp) {
      // Tauri: Use native dialog
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: true,
          multiple: false,
          title: "ワークスペースとして開くフォルダを選択",
        });
        if (selected && typeof selected === "string") {
          setWorkspacePath(selected);
        }
      } catch (error) {
        console.error("Failed to open folder dialog:", error);
      }
    } else {
      // Web: Use file input
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // webkitRelativePath gives the full path relative to the selected folder
      const firstFile = files[0];
      const path = firstFile.webkitRelativePath.split("/").slice(0, -1).join("/");
      setWorkspacePath(path || firstFile.name);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspacePath.trim()) return;
    await onSubmit(workspacePath);
    setWorkspacePath("");
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <form className="modal" onSubmit={handleSubmit}>
          <div className="modal-title">{"ワークスペース追加"}</div>

          <label className="field">
            <span>フォルダ</span>
            <div className="field-row">
              <input
                type="text"
                value={workspacePath}
                placeholder="フォルダを選択してください"
                readOnly
              />
              <button type="button" className="secondary-button" onClick={handleSelectFolder}>
                選択...
              </button>
            </div>
          </label>

          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="primary-button" disabled={!workspacePath.trim()}>
              追加
            </button>
          </div>
        </form>
      </div>

      {/* Hidden file input for web */}
      {!isTauriApp && (
        <input
          ref={fileInputRef}
          type="file"
          {...({ webkitdirectory: true } as React.InputHTMLAttributes<HTMLInputElement>)}
          {...({ directory: true } as React.InputHTMLAttributes<HTMLInputElement>)}
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      )}
    </>
  );
};
