import { CheckCircle2, Loader2, Network, RefreshCw, Server, Terminal, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface EnvironmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EnvironmentInfo {
  node: CommandInfo;
  npm: CommandInfo;
  pnpm: CommandInfo;
}

interface CommandInfo {
  available: boolean;
  version: string | null;
}

interface PortStatus {
  port: number;
  available: boolean;
  in_use: boolean;
}

export function EnvironmentModal({ isOpen, onClose }: EnvironmentModalProps) {
  const [isTauri, setIsTauri] = useState(false);
  const [loading, setLoading] = useState(true);
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
  const [ports, setPorts] = useState<PortStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const portsToCheck = [3000, 5173, 5174, 5175, 5176, 8787];

  useEffect(() => {
    setIsTauri(typeof window !== "undefined" && "__TAURI__" in window);
  }, []);

  useEffect(() => {
    if (isOpen && isTauri) {
      loadEnvironmentInfo();
    }
  }, [isOpen, isTauri]);

  const loadEnvironmentInfo = async () => {
    setLoading(true);
    try {
      const tauri = await import("@tauri-apps/api/core");

      // Load environment info
      const envResult = (await tauri.invoke("check_environment")) as EnvironmentInfo;
      setEnvInfo(envResult);

      // Check ports
      const portResults = await Promise.all(
        portsToCheck.map((port) => tauri.invoke("check_port", { port }))
      );
      setPorts(portResults as PortStatus[]);
    } catch (e) {
      console.error("Failed to load environment info:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEnvironmentInfo();
    setRefreshing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content environment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Environment Status</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {!isTauri ? (
            <div className="env-message">
              <p>This feature is only available in the desktop app.</p>
            </div>
          ) : loading ? (
            <div className="env-loading">
              <Loader2 size={24} className="spinner" />
              <span>Checking environment...</span>
            </div>
          ) : (
            <div className="env-content">
              {/* Header with refresh button */}
              <div className="env-header">
                <button
                  type="button"
                  className="env-refresh-btn"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw size={16} className={refreshing ? "spinner" : ""} />
                  Refresh
                </button>
              </div>

              {/* Required Tools */}
              <section className="env-section">
                <h3>
                  <Terminal size={18} />
                  Required Tools
                </h3>
                <div className="env-items">
                  <CommandItem name="Node.js" info={envInfo?.node ?? null} />
                  <CommandItem name="npm" info={envInfo?.npm ?? null} />
                  <CommandItem name="pnpm" info={envInfo?.pnpm ?? null} optional />
                </div>
              </section>

              {/* Port Status */}
              <section className="env-section">
                <h3>
                  <Network size={18} />
                  Port Status
                </h3>
                <div className="env-items">
                  {ports.map((p) => (
                    <PortItem key={p.port} status={p} />
                  ))}
                </div>
              </section>

              {/* Actions */}
              <section className="env-section">
                <h3>
                  <Server size={18} />
                  Quick Actions
                </h3>
                <div className="env-actions">
                  <button
                    type="button"
                    className="env-action-btn"
                    onClick={() => window.open("https://nodejs.org/", "_blank")}
                  >
                    Install Node.js
                  </button>
                  <button
                    type="button"
                    className="env-action-btn"
                    onClick={() =>
                      window.open(
                        "https://docs.npmjs.com/downloading-and-installing-node-js-and-npm",
                        "_blank"
                      )
                    }
                  >
                    Install npm
                  </button>
                  <button
                    type="button"
                    className="env-action-btn"
                    onClick={() => window.open("https://pnpm.io/installation", "_blank")}
                  >
                    Install pnpm
                  </button>
                </div>
              </section>

              {/* Help */}
              <section className="env-section env-help">
                <p>
                  <strong>Troubleshooting:</strong> If any required tools are missing, install them
                  using the buttons above or visit the official documentation.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CommandItem({
  name,
  info,
  optional = false,
}: {
  name: string;
  info: CommandInfo | null;
  optional?: boolean;
}) {
  if (!info) {
    return (
      <div className="env-item env-item-loading">
        <Loader2 size={16} className="spinner" />
        <span>{name}</span>
      </div>
    );
  }

  return (
    <div className="env-item">
      <div className="env-item-icon">
        {info.available ? (
          <CheckCircle2 size={18} className="success" />
        ) : (
          <XCircle size={18} className={optional ? "warning" : "error"} />
        )}
      </div>
      <div className="env-item-content">
        <div className="env-item-name">
          {name}
          {optional && <span className="env-item-badge">Optional</span>}
        </div>
        {info.available && info.version && <div className="env-item-version">{info.version}</div>}
        {!info.available && (
          <div className="env-item-status">
            {optional ? "Not installed (optional)" : "Not installed - required"}
          </div>
        )}
      </div>
    </div>
  );
}

function PortItem({ status }: { status: PortStatus }) {
  return (
    <div className="env-item">
      <div className="env-item-icon">
        {status.available ? (
          <CheckCircle2 size={18} className="success" />
        ) : (
          <XCircle size={18} className="warning" />
        )}
      </div>
      <div className="env-item-content">
        <div className="env-item-name">Port {status.port}</div>
        <div className="env-item-status">{status.available ? "Available" : "In use"}</div>
      </div>
    </div>
  );
}
