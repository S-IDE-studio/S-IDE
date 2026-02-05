import { memo } from "react";
import Editor from "@monaco-editor/react";
import type { EditorFile } from "../../types";
import { EDITOR_FONT_FAMILY, EDITOR_FONT_SIZE } from "../../constants";

interface EditorPanelContentProps {
  file: EditorFile;
  active?: boolean;
  onChange?: (fileId: string, contents: string) => void;
  onSave?: () => void;
  saving?: boolean;
}

export function EditorPanelContent({
  file,
  active = false,
  onChange,
  onSave,
  saving = false,
}: EditorPanelContentProps) {
  return (
    <div className={`editor-panel-content ${active ? "active" : ""}`}>
      <Editor
        height="100%"
        width="100%"
        theme="vs-dark"
        language={file.language}
        value={file.contents}
        onChange={(value) => onChange?.(file.id, value ?? "")}
        options={{
          fontFamily: EDITOR_FONT_FAMILY,
          fontSize: EDITOR_FONT_SIZE,
          minimap: { enabled: false },
          automaticLayout: true,
          readOnly: saving,
        }}
      />
    </div>
  );
}

export const MemoizedEditorPanelContent = memo(EditorPanelContent);
