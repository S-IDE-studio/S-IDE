import { Check, Copy, Globe, Loader2, Power, PowerOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COPY_FEEDBACK_TIMEOUT } from "../constants";
import { useTunnelStatus } from "../hooks/useTunnelStatus";

// Default port for Vite dev server
const VITE_DEV_SERVER_PORT = 5176;

export function TunnelControl() {
  const tunnelStatus = useTunnelStatus();
  const [isTauri, setIsTauri] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsTauri(typeof window !== "undefined" && "__TAURI__" in window);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleStartTunnel = async () => {
    if (!isTauri) return;
    setStarting(true);
    try {
      const tauri = await import("@tauri-apps/api/core");
      await tauri.invoke("start_tunnel", { port: VITE_DEV_SERVER_PORT });
    } catch (e) {
      console.error("Failed to start tunnel:", e);
    } finally {
      setStarting(false);
    }
  };

  const handleStopTunnel = async () => {
    if (!isTauri) return;
    try {
      const tauri = await import("@tauri-apps/api/core");
      await tauri.invoke("stop_tunnel");
    } catch (e) {
      console.error("Failed to stop tunnel:", e);
    }
  };

  const handleCopyUrl = async () => {
    if (!tunnelStatus.url) return;
    try {
      await navigator.clipboard.writeText(tunnelStatus.url);
      setCopied(true);
      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT);
    } catch (e) {
      console.error("Failed to copy URL:", e);
    }
  };

  if (!isTauri) {
    return null;
  }

  return (
    <div className="tunnel-control">
      <div className="tunnel-status">
        <Globe size={14} />
        <span className="tunnel-label">
          {tunnelStatus.running ? "Remote Access" : "No Remote Access"}
        </span>
        {tunnelStatus.running && tunnelStatus.url && (
          <span className="tunnel-url">
            <button
              type="button"
              className="copy-url-btn"
              onClick={handleCopyUrl}
              title={copied ? "Copied!" : "Copy URL"}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
            <span className="url-text">{tunnelStatus.url}</span>
          </span>
        )}
      </div>
      <div className="tunnel-actions">
        {starting ? (
          <Loader2 size={14} className="spinner" />
        ) : tunnelStatus.running ? (
          <button
            type="button"
            className="tunnel-btn stop"
            onClick={handleStopTunnel}
            title="Stop tunnel"
          >
            <PowerOff size={14} />
          </button>
        ) : (
          <button
            type="button"
            className="tunnel-btn start"
            onClick={handleStartTunnel}
            title="Start tunnel for remote access"
          >
            <Power size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
