/**
 * MCP Server Panel Content
 * Displays MCP server management with active state switching and tool settings
 */

import { useCallback, useEffect, useState } from "react";

interface MCPServer {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  status: "active" | "inactive" | "error";
}

export function McpPanelContent() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch MCP servers from API
    const fetchServers = async () => {
      let response;
      try {
        response = await fetch("/api/mcp/servers");
      } catch (error) {
        console.error("Failed to fetch MCP servers:", error);
      }

      if (response && response.ok) {
        let data;
        try {
          data = await response.json();
        } catch (error) {
          console.error("Failed to parse MCP servers:", error);
        }

        if (data && data.servers) {
          setServers(data.servers);
        } else {
          setServers([]);
        }
      }
      setLoading(false);
    };

    fetchServers();
  }, []);

  const handleToggleServer = useCallback(async (serverId: string) => {
    let success = false;
    try {
      const response = await fetch(`/api/mcp/servers/${serverId}/toggle`, {
        method: "POST",
      });
      success = response.ok;
    } catch (error) {
      console.error("Failed to toggle MCP server:", error);
    }

    if (success) {
      setServers((prev) =>
        prev.map((s) =>
          s.id === serverId ? { ...s, status: s.status === "active" ? "inactive" : "active" } : s
        )
      );
    }
  }, []);

  const handleToggleTool = useCallback(async (serverId: string, toolName: string) => {
    let response;
    try {
      response = await fetch(`/api/mcp/servers/${serverId}/tools/${toolName}/toggle`, {
        method: "POST",
      });
    } catch (error) {
      console.error("Failed to toggle MCP tool:", error);
    }

    if (response && response.ok) {
      let data;
      try {
        data = await response.json();
      } catch (error) {
        console.error("Failed to parse toggle result:", error);
      }

      if (data) {
        setServers((prev) => prev.map((s) => (s.id === serverId ? data : s)));
      }
    }
  }, []);

  if (loading) {
    return (
      <div className="panel-content-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="mcp-panel">
      <div className="mcp-panel-header">
        <h2>MCP Servers</h2>
        <button type="button" className="primary-button" onClick={() => {}}>
          Add Server
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="panel-empty panel-view-empty">
          <p className="panel-empty-description">No MCP servers configured</p>
          <p className="panel-empty-hint">
            Add MCP servers in your agent configuration to enable additional tools
          </p>
        </div>
      ) : (
        <div className="mcp-servers-list">
          {servers.map((server) => (
            <div key={server.id} className={`mcp-server-card mcp-server-card--${server.status}`}>
              <div className="mcp-server-header">
                <h3 className="mcp-server-name">{server.name}</h3>
                <button
                  type="button"
                  className={`status-toggle status-toggle--${server.status}`}
                  onClick={() => handleToggleServer(server.id)}
                  title={server.status === "active" ? "Deactivate" : "Activate"}
                >
                  <span className="status-indicator" />
                </button>
              </div>
              <div className="mcp-server-details">
                <code className="mcp-server-command">{server.command}</code>
                {server.args && server.args.length > 0 && (
                  <code className="mcp-server-args">{server.args.join(" ")}</code>
                )}
              </div>
              {server.status === "error" && (
                <div className="mcp-server-error">Error running server</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
