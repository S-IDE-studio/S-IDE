import Editor from "@monaco-editor/react";
import type { EditorFile } from "../../types";
import { EDITOR_FONT_FAMILY, EDITOR_FONT_SIZE } from "../../constants";

interface EditorPanelContentProps {
  file: EditorFile;
}

export function EditorPanelContent({ file }: EditorPanelContentProps) {
  return (
    <Editor
      height="100%"
      width="100%"
      theme="vs-dark"
      language={file.language}
      value={file.contents}
      options={{
        fontFamily: EDITOR_FONT_FAMILY,
        fontSize: EDITOR_FONT_SIZE,
        minimap: { enabled: false },
        automaticLayout: true,
      }}
    />
  );
}
