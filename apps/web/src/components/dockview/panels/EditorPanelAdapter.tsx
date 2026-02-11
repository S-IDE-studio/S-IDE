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

  // Determine active state using dockview API
  // Check if the current panel is the active panel in dockview
  const isActive = ctx.dockviewApi?.activePanel?.id === tab.id;

  return (
    <EditorPanelContent
      file={file}
      active={isActive ?? false}
      onChange={(fileId, content) => ctx.onChangeFile(fileId, content)}
      onSave={() => ctx.onSaveFile(file.id)}
      saving={isSaving}
    />
  );
}
