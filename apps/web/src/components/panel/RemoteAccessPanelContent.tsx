/**
 * Remote Access Panel Content - Tailscale guided access (minimal UI)
 */

import { Check, Copy, Globe, Link2, QrCode, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { COPY_FEEDBACK_TIMEOUT } from "../../constants";
import { useRemoteAccessStatus } from "../../hooks/useRemoteAccessStatus";
import { useServerStatus } from "../../hooks/useServerStatus";
import { openExternalUrl } from "../../utils/externalLink";
import { buildRemoteAccessUrl, pickRemoteAccessHost } from "../../utils/remoteAccess";

export function RemoteAccessPanelContent() {
  const remote = useRemoteAccessStatus();
  const server = useServerStatus();
  const [serverPort, setServerPort] = useState<number>(8787);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
    if (!isTauri) return;

    // Pull server port from settings (best-effort).
    const ac = new AbortController();
    fetch("/api/settings", { signal: ac.signal })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (typeof data?.port === "number") setServerPort(data.port);
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const host = pickRemoteAccessHost({ dnsName: remote.dnsName, ips: remote.ips });
  const url = remote.serveEnabled ? remote.serveUrl : null;
  const ipHost = remote.ips.find((ip) => ip.includes(".")) ?? remote.ips[0] ?? null;
  const httpIpUrl =
    ipHost && serverPort
      ? buildRemoteAccessUrl({ host: ipHost, port: serverPort, scheme: "http" })
      : null;
  const connected =
    remote.isTauri &&
    remote.installed &&
    remote.backendState === "Running" &&
    !!host &&
    remote.serveEnabled;

  const canStart =
    remote.isTauri &&
    remote.installed &&
    remote.backendState === "Running" &&
    server.status === "running" &&
    !remote.serveEnabled;

  const canStop = remote.isTauri && remote.installed && remote.serveEnabled;

  const handleCopyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT);
    } catch (e) {
      console.error("Failed to copy URL:", e);
    }
  };

  const handleStart = async () => {
    setActionError(null);
    setStarting(true);
    try {
      const tauri = await import("@tauri-apps/api/core");
      await tauri.invoke("start_remote_access_https", { port: serverPort });
    } catch (e) {
      setActionError(typeof e === "string" ? e : String(e));
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setActionError(null);
    setStopping(true);
    try {
      const tauri = await import("@tauri-apps/api/core");
      await tauri.invoke("stop_remote_access");
    } catch (e) {
      setActionError(typeof e === "string" ? e : String(e));
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="tunnel-panel-content">
      <div className="tunnel-panel-header">
        <h2>
          <Globe size={20} />
          Remote Access
        </h2>
        <div className="tunnel-status-badge">
          {connected ? (
            <span className="status-active">● Connected</span>
          ) : (
            <span className="status-inactive">○ Disconnected</span>
          )}
        </div>
      </div>

      <div className="tunnel-panel-body">
        {remote.isTauri && (
          <div className="tunnel-url-section" style={{ marginBottom: 12 }}>
            {!remote.installed ? null : remote.backendState === "NeedsLogin" ? null : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!remote.serveEnabled ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void handleStart()}
                    disabled={!canStart || starting}
                    title={
                      server.status !== "running"
                        ? "Start the server first"
                        : "Enable HTTPS Remote Access"
                    }
                  >
                    {starting ? "Starting..." : "Start HTTPS Remote Access"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void handleStop()}
                    disabled={!canStop || stopping}
                    title="Disable Remote Access"
                  >
                    {stopping ? "Stopping..." : "Stop Remote Access"}
                  </button>
                )}
              </div>
            )}
            {actionError && (
              <p className="tunnel-warning">
                <strong>Remote Access error:</strong> {actionError}
              </p>
            )}
          </div>
        )}

        <div className="tunnel-url-section">
          <label className="url-label">URL</label>
          <div className="url-display">
            {connected && url ? (
              <>
                <span className="url-text" title="Click to copy" onClick={handleCopyUrl}>
                  {url}
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
                <button
                  type="button"
                  className="qr-btn"
                  onClick={() => setShowQR(true)}
                  title="Show QR Code"
                >
                  <QrCode size={16} />
                  <span>QR</span>
                </button>
              </>
            ) : (
              <span className="url-placeholder">
                {remote.isTauri &&
                remote.installed &&
                remote.backendState === "Running" &&
                !remote.serveEnabled
                  ? "Press Start to enable HTTPS"
                  : "Not ready"}
              </span>
            )}
          </div>

          {remote.isTauri &&
            remote.installed &&
            remote.backendState === "Running" &&
            remote.serveEnabled && (
              <div className="tunnel-note" style={{ marginTop: 10 }}>
                <strong>DNS troubleshooting (phone):</strong> If you see “DNS address not found”,
                open the Tailscale app on your phone and enable “Use Tailscale DNS”, then reconnect
                the VPN.
                {httpIpUrl ? (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>
                      Fallback (HTTP via Tailscale IP):
                    </div>
                    <div className="url-display" style={{ marginTop: 4 }}>
                      <span
                        className="url-text"
                        title="Click to copy"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(httpIpUrl);
                            setCopied(true);
                            if (timeoutRef.current) clearTimeout(timeoutRef.current);
                            timeoutRef.current = setTimeout(
                              () => setCopied(false),
                              COPY_FEEDBACK_TIMEOUT
                            );
                          } catch {}
                        }}
                      >
                        {httpIpUrl}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

          {remote.isTauri && server.status !== "running" && (
            <p className="tunnel-warning">
              <strong>Server not responding:</strong> If this shows Stopped, Remote Access will not
              work. Try restarting the desktop app. If it keeps happening when creating terminals,
              it may indicate the backend process is exiting unexpectedly.
            </p>
          )}

          {!remote.isTauri && (
            <p className="tunnel-note">Remote Access is only available in the Desktop app.</p>
          )}

          {remote.isTauri && !remote.installed && (
            <>
              <p className="tunnel-note">Tailscale is not detected on this machine.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void openExternalUrl("https://tailscale.com/download")}
              >
                <Link2 size={16} />
                Install Tailscale
              </button>
            </>
          )}

          {remote.isTauri &&
            remote.installed &&
            remote.backendState === "NeedsLogin" &&
            remote.authUrl && (
              <>
                <p className="tunnel-note">Tailscale needs login on this PC.</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void openExternalUrl(remote.authUrl!)}
                >
                  <Link2 size={16} />
                  Open Login
                </button>
              </>
            )}
        </div>

        {connected && url && (
          <div className="tunnel-instructions">
            <h4>Phone setup</h4>
            <ol>
              <li>Install Tailscale on your phone</li>
              <li>Sign in with the same account</li>
              <li>Ensure both devices are connected</li>
              <li>Open the URL above (or scan QR)</li>
            </ol>
          </div>
        )}

        {showQR && url && (
          <div className="qr-modal-overlay" onClick={() => setShowQR(false)}>
            <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
              <div className="qr-modal-header">
                <h3>Scan to Access</h3>
                <button type="button" className="icon-button" onClick={() => setShowQR(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="qr-code-container">
                <QRCodeSVG
                  value={url}
                  size={200}
                  level="M"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <div className="qr-url-text">{url}</div>
              <button type="button" className="btn-primary" onClick={handleCopyUrl}>
                {copied ? "Copied!" : "Copy URL"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
