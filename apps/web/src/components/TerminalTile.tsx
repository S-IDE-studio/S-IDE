import { useEffect, useRef } from 'react';
import { Terminal, type IDisposable } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import type { TerminalSession } from '../types';

interface TerminalTileProps {
  session: TerminalSession;
  wsUrl: string;
  isActive: boolean;
  onFocus: () => void;
}

export function TerminalTile({
  session,
  wsUrl,
  isActive,
  onFocus
}: TerminalTileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    containerRef.current.innerHTML = '';
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
      theme: {
        background: '#000000',
        foreground: '#ffffff'
      }
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;
    term.open(containerRef.current);
    fitAddon.fit();
    term.write(`ターミナル準備完了: ${session.title}\r\n`);

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    const socket = new WebSocket(wsUrl);
    socket.addEventListener('open', () => {
      term.write('\r\n接続しました。\r\n');
    });
    socket.addEventListener('message', (event) => {
      term.write(event.data);
    });
    socket.addEventListener('close', () => {
      term.write('\r\n切断しました。\r\n');
    });

    const dataDisposable: IDisposable = term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      socket.close();
      fitAddonRef.current = null;
      term.dispose();
    };
  }, [session.id, session.title, wsUrl]);

  return (
    <div
      className={`terminal-tile ${isActive ? 'is-active' : ''}`}
      onClick={onFocus}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onFocus();
        }
      }}
    >
      <div className="terminal-tile-header">
        <span>{session.title}</span>
      </div>
      <div className="terminal-tile-body" ref={containerRef} />
    </div>
  );
}
