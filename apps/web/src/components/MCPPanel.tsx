import { AlertCircle, CheckCircle, Network, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { type MCPServer, useLocalServers } from "../hooks/useLocalServers";

interface MCPPanelProps {
  className?: string;
}

export function MCPPanel({ className = "" }: MCPPanelProps) {
  const { servers, isScanning, refresh } = useLocalServers(5000);
  const [selectedServerUrl, setSelectedServerUrl] = useState<string | null>(null);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);

  // Find servers with MCP support
  const serversWithMCP = servers.filter((s) => s.mcpServers && s.mcpServers.length > 0);

  // Auto-select first server with MCP
  useEffect(() => {
    if (serversWithMCP.length > 0 && !selectedServerUrl) {
      setSelectedServerUrl(serversWithMCP[0].url);
    }
  }, [serversWithMCP, selectedServerUrl]);

  // Update MCP servers when selection changes
  useEffect(() => {
    const selected = servers.find((s) => s.url === selectedServerUrl);
    if (selected?.mcpServers) {
      setMcpServers(selected.mcpServers);
    } else {
      setMcpServers([]);
    }
  }, [selectedServerUrl, servers]);

  const selectedServer = servers.find((s) => s.url === selectedServerUrl);

  return (
    <div className={`mcp-panel ${className}`}>
      <div className="mcp-panel-header">
        <h3>
          <Network size={16} />
          MCP Servers
        </h3>
        <button
          className="icon-button"
          onClick={refresh}
          disabled={isScanning}
          title="Refresh servers"
        >
          <RefreshCw size={14} className={isScanning ? "spinning" : ""} />
        </button>
      </div>

      {serversWithMCP.length === 0 ? (
        <div className="mcp-panel-empty">
          {isScanning ? "Scanning for servers..." : "No MCP servers found"}
        </div>
      ) : (
        <>
          {/* Server selector */}
          {serversWithMCP.length > 1 && (
            <div className="mcp-server-selector">
              <label>Server:</label>
              <select
                value={selectedServerUrl ?? ""}
                onChange={(e) => setSelectedServerUrl(e.target.value)}
              >
                {serversWithMCP.map((server) => (
                  <option key={server.url} value={server.url}>
                    {server.name} ({server.url})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Selected server info */}
          {selectedServer && (
            <div className="mcp-selected-server">
              <div className="mcp-server-info">
                <span className="mcp-server-name">{selectedServer.name}</span>
                <span className="mcp-server-url">{selectedServer.url}</span>
              </div>
            </div>
          )}

          {/* MCP server list */}
          <div className="mcp-server-list">
            {mcpServers.map((mcp) => (
              <MCPServerItem key={mcp.name} server={mcp} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface MCPServerItemProps {
  server: MCPServer;
}

function MCPServerItem({ server }: MCPServerItemProps) {
  const getStatusIcon = () => {
    switch (server.status) {
      case "active":
        return <CheckCircle size={14} className="status-active" />;
      case "inactive":
        return <AlertCircle size={14} className="status-inactive" />;
      case "error":
        return <XCircle size={14} className="status-error" />;
      default:
        return null;
    }
  };

  return (
    <div className={`mcp-server-item status-${server.status}`}>
      <div className="mcp-server-item-header">
        {getStatusIcon()}
        <span className="mcp-server-item-name">{server.name}</span>
        <span className="mcp-server-item-status">{server.status}</span>
      </div>
      {server.capabilities.length > 0 && (
        <div className="mcp-server-capabilities">
          {server.capabilities.map((cap) => (
            <span key={cap} className="mcp-capability-tag">
              {cap}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
