/**
 * Server List Panel with Advanced Scanning
 *
 * Displays local servers and provides advanced nmap-style scanning
 * with OS detection, version detection, and service fingerprinting.
 */

import { useEffect, useState } from "react";
import type { LocalServer } from "../hooks/useLocalServers";
import {
  checkNmapAvailable,
  type ScanOptions,
  useAdvancedScan,
  useLocalServers,
} from "../hooks/useLocalServers";

interface ServerListPanelProps {
  onServerSelect?: (server: LocalServer) => void;
  selectedUrl?: string;
}

export function ServerListPanel({ onServerSelect, selectedUrl }: ServerListPanelProps) {
  const { servers, isScanning, refresh } = useLocalServers(5000);
  const [expanded, setExpanded] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [nmapAvailable, setNmapAvailable] = useState(false);

  // Advanced scan state
  const [scanOptions, setScanOptions] = useState<ScanOptions>({
    osDetection: false,
    versionDetection: false,
    useNmap: false,
  });
  const [customPorts, setCustomPorts] = useState("");

  const { results, isScanning: isAdvancedScanning, error, scan } = useAdvancedScan();

  // Check nmap availability on mount
  useEffect(() => {
    checkNmapAvailable().then(setNmapAvailable);
  }, []);

  const handleAdvancedScan = async () => {
    const options: ScanOptions = {
      ...scanOptions,
      ports: customPorts
        ? customPorts
            .split(",")
            .map((p) => parseInt(p.trim(), 10))
            .filter((p) => !Number.isNaN(p))
        : undefined,
    };
    await scan(options);
  };

  const toggleOption = (key: keyof ScanOptions) => {
    setScanOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="server-list-panel">
      <div className="server-list-header">
        <h3>Local Servers</h3>
        <div className="server-list-actions">
          <button
            className="icon-button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            title={showAdvanced ? "Simple Scan" : "Advanced Scan"}
          >
            {showAdvanced ? "🔍" : "⚡"}
          </button>
          <button
            className="icon-button"
            onClick={refresh}
            disabled={isScanning}
            title="Refresh servers"
          >
            {isScanning ? "⏳" : "🔄"}
          </button>
          <button
            className="icon-button"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "▼" : "▶"}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Advanced Scan Panel */}
          {showAdvanced && (
            <div className="advanced-scan-panel">
              <div className="scan-options">
                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={scanOptions.osDetection}
                    onChange={() => toggleOption("osDetection")}
                    disabled={!nmapAvailable && !scanOptions.useNmap}
                  />
                  <span>OS Detection</span>
                  {!nmapAvailable && <small> (requires nmap)</small>}
                </label>

                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={scanOptions.versionDetection}
                    onChange={() => toggleOption("versionDetection")}
                  />
                  <span>Version Detection</span>
                </label>

                {nmapAvailable && (
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={scanOptions.useNmap}
                      onChange={() => toggleOption("useNmap")}
                    />
                    <span>Use nmap</span>
                  </label>
                )}

                <div className="custom-ports">
                  <input
                    type="text"
                    placeholder="Custom ports (e.g., 80,443,8080)"
                    value={customPorts}
                    onChange={(e) => setCustomPorts(e.target.value)}
                  />
                </div>

                <button
                  className="btn-primary btn-small"
                  onClick={handleAdvancedScan}
                  disabled={isAdvancedScanning}
                >
                  {isAdvancedScanning ? "Scanning..." : "Advanced Scan"}
                </button>
              </div>

              {error && (
                <div className="scan-error">
                  <strong>Error:</strong> {error}
                </div>
              )}

              {results.length > 0 && (
                <div className="advanced-scan-results">
                  {results.map((result) => (
                    <AdvancedScanResultItem key={result.host} result={result} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Simple Server List */}
          <div className="server-list">
            {servers.length === 0 ? (
              <div className="server-list-empty">
                {isScanning ? "Scanning..." : "No local servers found"}
              </div>
            ) : (
              servers.map((server) => (
                <ServerListItem
                  key={server.port}
                  server={server}
                  isSelected={selectedUrl === server.url}
                  onSelect={() => onServerSelect?.(server)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface ServerListItemProps {
  server: LocalServer;
  isSelected: boolean;
  onSelect: () => void;
}

function ServerListItem({ server, isSelected, onSelect }: ServerListItemProps) {
  const mcpCount = server.mcpServers?.length ?? 0;
  const mcpActiveCount = server.mcpServers?.filter((s) => s.status === "active").length ?? 0;

  return (
    <div className={`server-list-item ${isSelected ? "selected" : ""}`} onClick={onSelect}>
      <div className="server-item-header">
        <span className="server-status-indicator" data-status={server.status}>
          ●
        </span>
        <span className="server-name">{server.name}</span>
        {mcpCount > 0 && (
          <span
            className="server-mcp-badge"
            title={`${mcpActiveCount}/${mcpCount} MCP servers active`}
          >
            MCP {mcpActiveCount}/{mcpCount}
          </span>
        )}
      </div>
      <div className="server-item-details">
        <span className="server-port">:{server.port}</span>
        <span className="server-type">{server.type}</span>
      </div>
      <div className="server-item-url">{server.url}</div>
      {mcpCount > 0 && (
        <div className="server-mcp-list">
          {server.mcpServers?.map((mcp) => (
            <div key={mcp.name} className={`server-mcp-item status-${mcp.status}`}>
              <span className="mcp-status-indicator" data-status={mcp.status}>
                ●
              </span>
              <span className="mcp-name">{mcp.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Advanced Scan Result Components

interface AdvancedScanResultProps {
  result: {
    host: string;
    ports: Array<{
      port: number;
      status: string;
      protocol: string;
      service?: string;
      version?: string;
    }>;
    os_guess?: string;
    services: Array<{
      name: string;
      version?: string;
      info?: string;
    }>;
  };
}

function AdvancedScanResultItem({ result }: AdvancedScanResultProps) {
  const openPorts = result.ports.filter((p) => p.status === "Open");
  const closedPorts = result.ports.filter((p) => p.status === "Closed");
  const filteredPorts = result.ports.filter((p) => p.status === "Filtered");

  return (
    <div className="advanced-scan-result-item">
      <div className="result-header">
        <span className="result-host">{result.host}</span>
        {result.os_guess && <span className="os-badge">OS: {result.os_guess}</span>}
      </div>

      <div className="port-summary">
        <span className="open-count">{openPorts.length} open</span>
        {closedPorts.length > 0 && (
          <span className="closed-count">{closedPorts.length} closed</span>
        )}
        {filteredPorts.length > 0 && (
          <span className="filtered-count">{filteredPorts.length} filtered</span>
        )}
      </div>

      {openPorts.length > 0 && (
        <div className="port-list">
          <table className="port-table">
            <thead>
              <tr>
                <th>Port</th>
                <th>State</th>
                <th>Service</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              {openPorts.map((port) => (
                <tr key={port.port} className="port-open">
                  <td className="port-number">
                    {port.port}/{port.protocol}
                  </td>
                  <td className="port-status">{port.status}</td>
                  <td className="port-service">{port.service || "unknown"}</td>
                  <td className="port-version">{port.version || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.services.length > 0 && (
        <div className="service-details">
          <h4>Services</h4>
          {result.services.map((service, idx) => (
            <div key={idx} className="service-item">
              <span className="service-name">{service.name}</span>
              {service.version && <span className="service-version">{service.version}</span>}
              {service.info && <span className="service-info">{service.info}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
