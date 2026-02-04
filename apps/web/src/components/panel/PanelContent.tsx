import { memo } from "react";
import type { UnifiedTab } from "../../types";
import { AgentPanel } from "./AgentPanel";
import { WorkspacePanel } from "./WorkspacePanel";
import { DeckPanel } from "./DeckPanel";
import { TerminalPanelContent } from "./TerminalPanelContent";
import { EditorPanelContent } from "./EditorPanelContent";

interface PanelContentProps {
  tab: UnifiedTab;
}

export function PanelContent({ tab }: PanelContentProps) {
  switch (tab.kind) {
    case "agent":
      return <AgentPanel agent={tab.data.agent!} />;
    case "workspace":
      return <WorkspacePanel workspace={tab.data.workspace!} />;
    case "deck":
      return <DeckPanel deck={tab.data.deck!} />;
    case "terminal":
      return <TerminalPanelContent terminal={tab.data.terminal!} />;
    case "editor":
      return <EditorPanelContent file={tab.data.editor!} />;
    default:
      return <div>Unknown tab type</div>;
  }
}

export const MemoizedPanelContent = memo(PanelContent);
