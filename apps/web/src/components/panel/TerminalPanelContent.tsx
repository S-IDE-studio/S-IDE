import { memo } from "react";
import { DraggableTerminal } from "../DraggableTerminal";
import type { TerminalSession } from "../../types";

interface TerminalPanelContentProps {
  terminal: { id: string; command: string; cwd: string };
  wsBase?: string;
  onDelete?: () => void;
}

export function TerminalPanelContent({
  terminal,
  wsBase = "",
  onDelete,
}: TerminalPanelContentProps) {
  // Convert terminal data to TerminalSession format
  const session: TerminalSession = {
    id: terminal.id,
    title: terminal.command || 'Terminal',
    shell: terminal.command,
  };

  return (
    <div className="terminal-panel-content">
      <DraggableTerminal
        session={session}
        wsUrl={`${wsBase}/api/terminals/${terminal.id}`}
        onDelete={onDelete ?? (() => {})}
        index={0}
        onDragStart={() => {}}
        onDragOver={() => {}}
        onDragEnd={() => {}}
        isDragging={false}
        isDragOver={false}
      />
    </div>
  );
}

export const MemoizedTerminalPanelContent = memo(TerminalPanelContent);
