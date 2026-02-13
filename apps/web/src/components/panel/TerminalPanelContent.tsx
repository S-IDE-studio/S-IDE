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
import {
  getActiveTerminalId,
  registerTerminalSender,
  setActiveTerminalId,
} from "../../utils/terminalInputBridge";
import { createResizeGuardState, shouldEmitResize } from "../../utils/terminalResizeGuard";

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
    let resizeRafId: number | null = null;
    let hasConnectedOnce = false;
    const resizeGuardState = createResizeGuardState();
    const unregisterTerminalSender = registerTerminalSender(terminal.id, (payload) => {
      const currentSocket = socketRef.current;
      if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
        return false;
      }
      currentSocket.send(payload);
      return true;
    });

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
          // Set tabindex to make container focusable for keyboard events
          containerRef.current.tabIndex = 0;
          term.open(containerRef.current);

          // Find the canvas element and ensure it can receive keyboard events
          const canvas = containerRef.current.querySelector("canvas");
          if (canvas) {
            canvas.tabIndex = 0;
            console.log("[Terminal] Found canvas element, setting tabindex");
          } else {
            console.warn("[Terminal] No canvas element found after open");
          }

          // Focus terminal when opened and on click
          const focusHandler = () => {
            console.log("[Terminal] Click handler: focusing terminal");
            setActiveTerminalId(terminal.id);
            term.focus();
            if (canvas) canvas.focus();
          };
          containerRef.current.addEventListener("click", focusHandler);

          // Debug: Track keydown events on container
          containerRef.current.addEventListener("keydown", (e) => {
            console.log(
              "[Terminal] Container keydown:",
              e.key,
              "target:",
              e.target,
              "currentTarget:",
              e.currentTarget
            );
          });

          // Initial focus after a delay to ensure DOM is ready
          requestAnimationFrame(() => {
            setActiveTerminalId(terminal.id);
            term.focus();
            if (canvas) canvas.focus();
            console.log("[Terminal] Initial focus applied, terminal element:", term.element);
          });
          console.log("[Terminal] Opened terminal with rows:", term.rows, "cols:", term.cols);
        }
      } catch (err) {
        console.warn("[Terminal] Error during terminal open:", err);
      }

      requestAnimationFrame(() => {
        if (!cancelled) {
          const commandText = terminal.command || "Terminal";
          try {
            term.write(`${TEXT_BOOT}${commandText}\r\n\r\n`);
          } catch (err) {
            console.warn("[Terminal] Error during initial write:", err);
          }
        }
      });
    }, 0);

    const sendResize = (force = false) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const cols = term.cols;
      const rows = term.rows;
      if (!cols || !rows) return;
      const next = { cols, rows };
      if (!shouldEmitResize(resizeGuardState, next, { force, now: Date.now() })) {
        return;
      }

      socket.send(`${RESIZE_MESSAGE_PREFIX}${cols},${rows}`);
    };

    const fitAndMaybeResize = (force = false) => {
      if (cancelled || !fitAddonRef.current) return;
      try {
        fitAddonRef.current.fit();
        sendResize(force);
      } catch (err) {
        console.warn("[Terminal] Error during resize:", err);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
      }
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        fitAndMaybeResize(false);
      });
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

        // Build URL without conditional expressions for React Compiler optimization
        const baseUrl = `${wsBase}/api/terminals/${terminal.id}`;
        let finalUrl = baseUrl;
        if (authEnabled) {
          finalUrl = `${baseUrl}?token=${token}`;
        }

        console.log("[Terminal] Connecting to WebSocket:", finalUrl);
        const socket = new WebSocket(finalUrl);
        socketRef.current = socket;

        socket.addEventListener("open", () => {
          console.log("[Terminal] WebSocket opened for terminal:", terminal.id);
          reconnectAttempts = 0;
          hasConnectedOnce = true;
          fitAndMaybeResize(true);
          if (isReconnect) {
            term.write(`\r\n\x1b[32m${TEXT_CONNECTED}\x1b[0m\r\n`);
          } else {
            term.write(`\r\n${TEXT_CONNECTED}\r\n\r\n`);
          }
        });

        socket.addEventListener("error", (event) => {
          console.error("[Terminal] WebSocket error:", event);
          console.error("[Terminal] WebSocket readyState:", socket.readyState);
        });

        socket.addEventListener("close", (event) => {
          console.log("[Terminal] WebSocket closed:", event.code, event.reason);
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
            reconnectAttempts = reconnectAttempts + 1;
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
          console.log(
            "[Terminal] onData fired:",
            JSON.stringify(data),
            "socket state:",
            socketRef.current?.readyState
          );
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            console.log("[Terminal] Sending data to WebSocket:", JSON.stringify(data));
            socketRef.current.send(data);
          } else {
            console.warn(
              "[Terminal] Cannot send - socket not open. State:",
              socketRef.current?.readyState,
              "WebSocket.OPEN:",
              WebSocket.OPEN
            );
          }
        });
        console.log("[Terminal] onData handler registered for terminal:", terminal.id);
      } catch (err) {
        console.error("[Terminal] Failed to connect:", err);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && hasConnectedOnce) {
          reconnectAttempts = reconnectAttempts + 1;
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
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
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
      unregisterTerminalSender();
      if (getActiveTerminalId() === terminal.id) {
        setActiveTerminalId(null);
      }
      term.dispose();
    };
  }, [terminal.id, terminal.command, wsBase]);

  return <div ref={containerRef} className="terminal-panel-content" />;
}

export const MemoizedTerminalPanelContent = memo(TerminalPanelContent);
