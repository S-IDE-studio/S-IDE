import type { TerminalSession } from '../types';
import { TerminalTile } from './TerminalTile';

interface TerminalPaneProps {
  terminals: TerminalSession[];
  activeTerminalId: string | null;
  wsBase: string;
  onSelectTerminal: (terminalId: string) => void;
  onNewTerminal: () => void;
}

export function TerminalPane({
  terminals,
  activeTerminalId,
  wsBase,
  onSelectTerminal,
  onNewTerminal
}: TerminalPaneProps) {
  return (
    <section className="terminal-view">
      <div className="terminal-header">
        <div>
          <div className="panel-title">ターミナル</div>
          <div className="panel-subtitle">複数表示・リサイズ対応</div>
        </div>
        <div className="terminal-actions">
          <button type="button" className="chip" onClick={onNewTerminal}>
            新規ターミナル
          </button>
        </div>
      </div>
      {terminals.length === 0 ? (
        <div className="empty-state">ターミナルを作成してください。</div>
      ) : (
        <div className="terminal-grid">
          {terminals.map((terminal) => (
            <TerminalTile
              key={terminal.id}
              session={terminal}
              wsUrl={`${wsBase}/api/terminals/${terminal.id}`}
              isActive={terminal.id === activeTerminalId}
              onFocus={() => onSelectTerminal(terminal.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
