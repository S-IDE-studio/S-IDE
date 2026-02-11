import type { IDockviewPanelProps } from "dockview";
import { EditorPanelContent } from "../../panel/EditorPanelContent";
import { useDockviewContext } from "../DockviewContext";

/**
 * Adapter for Editor panel in dockview
 * Wraps EditorPanelContent with dockview context and params
 */
export function EditorPanelAdapter(
  props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  const ctx = useDockviewContext();
  const tab = props.params.tab;

  if (!tab.data.editor) {
    return <div className="panel-error">Missing editor data</div>;
  }

  const file = tab.data.editor;
  const isSaving = ctx.savingFileId === file.id;

  // Note: props.api is not available on IDockviewPanelProps in this version
  // The active state can be determined by checking if this panel is the focused one
  // For now, we'll default to true or derive from context if available
  const isActive = true; // TODO: Track active panel state

  return (
    <EditorPanelContent
      file={file}
      active={isActive}
      onChange={(fileId, content) => ctx.onChangeFile(fileId, content)}
      onSave={() => ctx.onSaveFile(file.id)}
      saving={isSaving}
    />
  );
}
