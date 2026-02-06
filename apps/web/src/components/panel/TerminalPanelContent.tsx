import { memo, useEffect, useRef } from "react";
import { type IDisposable, Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { Unicode11Addon } from "xterm-addon-unicode11";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import { getWsToken } from "../../api";
import {
  RECONNECT_BASE_DELAY_MS,
  TERMINAL_BACKGROUND_COLOR,
  TERMINAL_FONT_FAMILY,
  TERMINAL_FONT_SIZE,
  TERMINAL_FOREGROUND_COLOR,
  TERMINAL_SCROLLBACK,
  TERMINAL_WEBSOCKET_NORMAL_CLOSE,
} from "../../constants";

const TEXT_BOOT = "ターミナルを起動しました: ";
const TEXT_CONNECTED = "接続しました。";
const TEXT_RECONNECTING = "再接続中...";
const TEXT_CLOSED = "接続が終了しました。";
const RESIZE_MESSAGE_PREFIX = "\u0000resize:";
const MAX_RECONNECT_ATTEMPTS = 5;

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const dataDisposableRef = useRef<IDisposable | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let cancelled = false;
    let isIntentionalClose = false;
    let reconnectAttempts = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let hasConnectedOnce = false;

    containerRef.current.innerHTML = "";
    containerRef.current.style.width = "100%";
    containerRef.current.style.height = "100%";

    void containerRef.current.offsetWidth;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: TERMINAL_FONT_FAMILY,
      fontSize: TERMINAL_FONT_SIZE,
      allowProposedApi: true,
      scrollback: TERMINAL_SCROLLBACK,
      convertEol: false,
      windowsMode: false,
      cols: 80,
      rows: 24,
      theme: {
        background: TERMINAL_BACKGROUND_COLOR,
        foreground: TERMINAL_FOREGROUND_COLOR,
      },
    });

    const fitAddon = new FitAddon();
    const unicode11Addon = new Unicode11Addon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(unicode11Addon);
    term.loadAddon(webLinksAddon);

    term.unicode.activeVersion = "11";
    fitAddonRef.current = fitAddon;

    const sendResponse = (response: string) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(response);
      }
    };

    // Register terminal query handlers
    term.parser.registerCsiHandler({ final: "n" }, (params) => {
      const param = (params as any).length > 0 ? (params as any).params[0] : 0;
      if (param === 6) {
        const buffer = term.buffer.active;
        const row = buffer.cursorY + buffer.baseY + 1;
        const col = buffer.cursorX + 1;
        sendResponse(`\x1b[${row};${col}R`);
        return true;
      } else if (param === 5) {
        sendResponse("\x1b[0n");
        return true;
      }
      return false;
    });

    term.parser.registerCsiHandler({ final: "c" }, (_params) => {
      sendResponse("\x1b[?62;1;2;4;6;7;8;9;15;22c");
      return true;
    });

    term.parser.registerCsiHandler({ prefix: ">", final: "c" }, (_params) => {
      sendResponse("\x1b[>1;500;0c");
      return true;
    });

    setTimeout(() => {
      if (cancelled) return;
      try {
        if (containerRef.current) {
          term.open(containerRef.current);
        }
      } catch (err) {
        console.warn("[Terminal] Error during terminal open:", err);
      }

      requestAnimationFrame(() => {
        if (!cancelled) {
          try {
            term.write(`${TEXT_BOOT}${terminal.command || "Terminal"}\r\n\r\n`);
          } catch (err) {
            console.warn("[Terminal] Error during initial write:", err);
          }
        }
      });
    }, 0);

    const sendResize = () => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const cols = term.cols;
      const rows = term.rows;
      if (!cols || !rows) return;
      socket.send(`${RESIZE_MESSAGE_PREFIX}${cols},${rows}`);
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!cancelled && fitAddonRef.current) {
        try {
          fitAddon.fit();
          sendResize();
        } catch (err) {
          console.warn("[Terminal] Error during resize:", err);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    const connect = async (isReconnect = false) => {
      if (cancelled) return;

      // Dispose previous data handler if exists
      if (dataDisposableRef.current) {
        try {
          dataDisposableRef.current.dispose();
        } catch {
          // Ignore dispose errors
        }
        dataDisposableRef.current = null;
      }

      try {
        const { token, authEnabled } = await getWsToken();
        if (cancelled) return;

        const finalUrl = authEnabled ? `${wsBase}/api/terminals/${terminal.id}?token=${token}` : `${wsBase}/api/terminals/${terminal.id}`;
        const socket = new WebSocket(finalUrl);
        socketRef.current = socket;

        socket.addEventListener("open", () => {
          reconnectAttempts = 0;
          hasConnectedOnce = true;
          sendResize();
          if (isReconnect) {
            term.write(`\r\n\x1b[32m${TEXT_CONNECTED}\x1b[0m\r\n`);
          } else {
            term.write(`\r\n${TEXT_CONNECTED}\r\n\r\n`);
          }
        });

        socket.addEventListener("message", (event) => {
          if (typeof event.data === "string") {
            term.write(event.data);
          }
        });

        socket.addEventListener("close", (event) => {
          if (cancelled || isIntentionalClose) {
            return;
          }

          if (event.code === TERMINAL_WEBSOCKET_NORMAL_CLOSE) {
            term.write(`\r\n${TEXT_CLOSED}\r\n`);
            return;
          }

          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = RECONNECT_BASE_DELAY_MS * 2 ** (reconnectAttempts - 1);
            term.write(
              `\r\n\x1b[33m${TEXT_RECONNECTING} (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})\x1b[0m\r\n`
            );
            reconnectTimeout = setTimeout(() => connect(true), delay);
          } else {
            term.write(`\r\n\x1b[31m${TEXT_CLOSED}\x1b[0m\r\n`);
          }
        });

        // Set up data handler using socketRef.current (closure will use current value)
        dataDisposableRef.current = term.onData((data) => {
          const currentSocket = socketRef.current;
          if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
            currentSocket.send(data);
          }
        });
      } catch (err) {
        console.error("[Terminal] Failed to connect:", err);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && hasConnectedOnce) {
          reconnectAttempts++;
          const delay = RECONNECT_BASE_DELAY_MS * 2 ** (reconnectAttempts - 1);
          term.write(
            `\r\n\x1b[33m${TEXT_RECONNECTING} (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})\x1b[0m\r\n`
          );
          reconnectTimeout = setTimeout(() => connect(true), delay);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      isIntentionalClose = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      resizeObserver.disconnect();

      // Dispose data handler
      if (dataDisposableRef.current) {
        try {
          dataDisposableRef.current.dispose();
        } catch {
          // Ignore dispose errors
        }
        dataDisposableRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.close();
      }
      socketRef.current = null;
      term.dispose();
    };
  }, [terminal.id, terminal.command, wsBase]);

  return <div ref={containerRef} className="terminal-panel-content" />;
}

export const MemoizedTerminalPanelContent = memo(TerminalPanelContent);
