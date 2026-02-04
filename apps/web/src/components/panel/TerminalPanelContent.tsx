interface TerminalPanelContentProps {
  terminal: { id: string; command: string; cwd: string };
}

export function TerminalPanelContent({ terminal }: TerminalPanelContentProps) {
  return <div className="terminal-panel-content">Terminal: {terminal.command}</div>;
}
