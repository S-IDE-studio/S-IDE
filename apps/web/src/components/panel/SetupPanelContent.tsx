/**
 * Setup Panel Content
 * Environment setup and verification panel (converted from EnvironmentModal)
 */

import { CheckCircle2, Loader2, Network, RefreshCw, Server, Terminal, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { COMMON_PORTS_TO_CHECK } from "../../constants";

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

export function SetupPanelContent() {
  const [isTauri, setIsTauri] = useState(false);
  const [loading, setLoading] = useState(true);
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
  const [ports, setPorts] = useState<PortStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const portsToCheck = COMMON_PORTS_TO_CHECK;

  useEffect(() => {
    setIsTauri(typeof window !== "undefined" && "__TAURI__" in window);
  }, []);

  const loadEnvironmentInfo = useCallback(async () => {
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
  }, [portsToCheck]);

  useEffect(() => {
    if (isTauri) {
      loadEnvironmentInfo();
    }
  }, [isTauri, loadEnvironmentInfo]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEnvironmentInfo();
    setRefreshing(false);
  };

  if (!isTauri) {
    return (
      <div className="setup-panel">
        <div className="panel-message">
          <p>This feature is only available in the desktop app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-panel">
      <div className="setup-panel-header">
        <h2>Environment Setup</h2>
        <button
          type="button"
          className="icon-button"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh"
        >
          <RefreshCw size={18} className={refreshing ? "spinner" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="setup-loading">
          <Loader2 size={24} className="spinner" />
          <span>Checking environment...</span>
        </div>
      ) : (
        <div className="setup-panel-content">
          {/* Required Tools */}
          <section className="setup-section">
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
          <section className="setup-section">
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
          <section className="setup-section">
            <h3>
              <Server size={18} />
              Quick Actions
            </h3>
            <div className="setup-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => window.open("https://nodejs.org/", "_blank")}
              >
                Install Node.js
              </button>
              <button
                type="button"
                className="secondary-button"
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
                className="secondary-button"
                onClick={() => window.open("https://pnpm.io/installation", "_blank")}
              >
                Install pnpm
              </button>
            </div>
          </section>

          {/* Help */}
          <section className="setup-section setup-help">
            <p>
              <strong>Troubleshooting:</strong> If any required tools are missing, install them
              using the buttons above or visit the official documentation.
            </p>
          </section>
        </div>
      )}
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
