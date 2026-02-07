import { Check, Copy, Globe, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COPY_FEEDBACK_TIMEOUT } from "../constants";
import { useRemoteAccessStatus } from "../hooks/useRemoteAccessStatus";
import { openExternalUrl } from "../utils/externalLink";
import { pickRemoteAccessHost } from "../utils/remoteAccess";

export function RemoteAccessControl() {
  const remote = useRemoteAccessStatus();
  const [serverPort, setServerPort] = useState<number>(8787);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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
  const connected =
    remote.installed && remote.backendState === "Running" && Boolean(host) && remote.serveEnabled;

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

  if (!remote.isTauri) return null;

  return (
    <div className="tunnel-control">
      <div className="tunnel-status">
        <Globe size={14} />
        <span className="tunnel-label">{connected ? "Remote Access" : "Remote Access (Off)"}</span>
        {connected && url && (
          <span className="tunnel-url">
            <button
              type="button"
              className="copy-url-btn"
              onClick={handleCopyUrl}
              title={copied ? "Copied!" : "Copy URL"}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
            <span className="url-text">{url}</span>
          </span>
        )}
      </div>
      <div className="tunnel-actions">
        {!remote.installed ? (
          <button
            type="button"
            className="tunnel-btn start"
            onClick={() => void openExternalUrl("https://tailscale.com/download")}
            title="Install Tailscale"
          >
            <Link2 size={14} />
          </button>
        ) : remote.backendState === "NeedsLogin" && remote.authUrl ? (
          <button
            type="button"
            className="tunnel-btn start"
            onClick={() => void openExternalUrl(remote.authUrl!)}
            title="Log in to Tailscale"
          >
            <Link2 size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
