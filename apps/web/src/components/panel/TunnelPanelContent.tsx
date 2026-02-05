/**
 * Tunnel Panel Content - Remote access with QR code display
 */

import { Check, Copy, Globe, Loader2, Power, PowerOff, QrCode, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { COPY_FEEDBACK_TIMEOUT } from "../../constants";
import { useTunnelStatus } from "../../hooks/useTunnelStatus";

// Default port for Vite dev server
const DEFAULT_TUNNEL_PORT = 5176;

export function TunnelPanelContent() {
  const tunnelStatus = useTunnelStatus();
  const [isTauri, setIsTauri] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
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
      await tauri.invoke("start_tunnel", { port: DEFAULT_TUNNEL_PORT });
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

  const toggleQR = () => {
    setShowQR((prev) => !prev);
  };

  return (
    <div className="tunnel-panel-content">
      <div className="tunnel-panel-header">
        <h2>
          <Globe size={20} />
          Remote Access
        </h2>
        <div className="tunnel-status-badge">
          {tunnelStatus.running ? (
            <span className="status-active">● Connected</span>
          ) : (
            <span className="status-inactive">○ Disconnected</span>
          )}
        </div>
      </div>

      <div className="tunnel-panel-body">
        {/* Tunnel URL Display */}
        <div className="tunnel-url-section">
          <label className="url-label">Public URL</label>
          <div className="url-display">
            {tunnelStatus.running && tunnelStatus.url ? (
              <>
                <span className="url-text" title="Click to copy" onClick={handleCopyUrl}>
                  {tunnelStatus.url}
                </span>
                <button
                  type="button"
                  className="copy-url-btn"
                  onClick={handleCopyUrl}
                  title={copied ? "Copied!" : "Copy URL"}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
                <button type="button" className="qr-btn" onClick={toggleQR} title="Show QR Code">
                  <QrCode size={16} />
                  <span>QR</span>
                </button>
              </>
            ) : (
              <span className="url-placeholder">No active tunnel</span>
            )}
          </div>
        </div>

        {/* Tunnel Password Display */}
        {tunnelStatus.running && tunnelStatus.password && (
          <div className="tunnel-password-section">
            <label className="url-label">Tunnel Password (required for first access)</label>
            <div className="password-display">
              <span className="password-text">{tunnelStatus.password}</span>
              <button
                type="button"
                className="copy-password-btn"
                onClick={() => {
                  navigator.clipboard.writeText(tunnelStatus.password!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT);
                }}
                title="Copy Password"
              >
                <Copy size={16} />
                <span>Copy Password</span>
              </button>
            </div>
            <p className="password-hint">Enter this password when prompted by localtunnel</p>
          </div>
        )}

        {tunnelStatus.running && tunnelStatus.url && (
          <p className="url-hint">
            Click the URL or Copy button to copy it, then paste in your phone browser
          </p>
        )}

        {/* QR Code Modal */}
        {showQR && tunnelStatus.url && (
          <div className="qr-modal-overlay" onClick={toggleQR}>
            <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
              <div className="qr-modal-header">
                <h3>Scan to Access</h3>
                <button type="button" className="icon-button" onClick={toggleQR}>
                  <X size={18} />
                </button>
              </div>
              <div className="qr-code-container">
                <QRCodeSVG
                  value={tunnelStatus.url}
                  size={200}
                  level="M"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <div className="qr-url-text">{tunnelStatus.url}</div>
              <button type="button" className="btn-primary" onClick={handleCopyUrl}>
                {copied ? "Copied!" : "Copy URL"}
              </button>
            </div>
          </div>
        )}

        {/* Tunnel Actions */}
        <div className="tunnel-actions-section">
          {starting ? (
            <button type="button" className="btn-primary" disabled>
              <Loader2 size={16} className="spinner" />
              Starting...
            </button>
          ) : tunnelStatus.running ? (
            <button type="button" className="btn-danger" onClick={handleStopTunnel}>
              <PowerOff size={16} />
              Stop Tunnel
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleStartTunnel}>
              <Power size={16} />
              Start Tunnel
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="tunnel-instructions">
          <h4>How to access from your phone</h4>
          <ol>
            <li>Click "Start Tunnel" to create a public URL</li>
            <li>Copy the URL by clicking it or the "Copy" button</li>
            <li>Copy the password (shown below URL)</li>
            <li>Paste the URL in your phone browser</li>
            <li>Enter the password when prompted</li>
            <li>Or scan the QR code (click "QR" button)</li>
          </ol>
          <p className="tunnel-warning">
            <strong>Important:</strong> localtunnel requires a password for security. You only need
            to enter it once per session.
          </p>
          <p className="tunnel-note">
            Uses localtunnel to expose your local server to the internet. Only use in trusted
            networks. The URL and password change each time you start the tunnel.
          </p>
        </div>
      </div>
    </div>
  );
}
