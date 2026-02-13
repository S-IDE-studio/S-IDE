/**
 * Agent Status Panel Content
 * Displays unified agent management with context/token usage display
 */

import { useCallback, useEffect, useState } from "react";

interface AgentStatus {
  id: string;
  name: string;
  icon: string;
  status: "idle" | "running" | "error";
  contextUsage: number;
  contextLimit: number;
  tokenUsage: number;
  tokenLimit: number;
  uptime: number;
}

export function AgentStatusPanelContent() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgentStatus = async () => {
      let response;
      try {
        response = await fetch("/api/agents/status");
      } catch (error) {
        console.error("Failed to fetch agent status:", error);
      }

      if (response && response.ok) {
        let data;
        try {
          data = await response.json();
        } catch (error) {
          console.error("Failed to parse agent status:", error);
        }

        if (data && data.agents) {
          setAgents(data.agents);
        } else {
          setAgents([]);
        }
      }
      setLoading(false);
    };

    fetchAgentStatus();

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchAgentStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRestartAgent = useCallback(async (agentId: string) => {
    try {
      await fetch(`/api/agents/${agentId}/restart`, { method: "POST" });
    } catch (error) {
      console.error("Failed to restart agent:", error);
    }
  }, []);

  const handleStopAgent = useCallback(async (agentId: string) => {
    try {
      await fetch(`/api/agents/${agentId}/stop`, { method: "POST" });
    } catch (error) {
      console.error("Failed to stop agent:", error);
    }
  }, []);

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const getStatusColor = (status: AgentStatus["status"]) => {
    switch (status) {
      case "running":
        return "#22c55e";
      case "error":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  if (loading) {
    return (
      <div className="panel-content-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="agent-status-panel">
      <div className="agent-status-header">
        <h2>Agent Status</h2>
        <div className="agent-status-summary">
          {agents.length > 0 && (
            <span className="agent-count">
              {agents.filter((a) => a.status === "running").length} / {agents.length} running
            </span>
          )}
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="panel-empty panel-view-empty">
          <p className="panel-empty-description">No agents configured</p>
        </div>
      ) : (
        <div className="agent-status-list">
          {agents.map((agent) => (
            <div key={agent.id} className="agent-status-card">
              <div className="agent-status-card-header">
                <div className="agent-info">
                  <h3 className="agent-name">{agent.name}</h3>
                  <span
                    className="agent-status-indicator"
                    style={{ backgroundColor: getStatusColor(agent.status) }}
                  >
                    {agent.status}
                  </span>
                </div>
                <div className="agent-actions">
                  {agent.status === "running" && (
                    <>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleRestartAgent(agent.id)}
                        title="Restart"
                      >
                        Restart
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleStopAgent(agent.id)}
                        title="Stop"
                      >
                        Stop
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="agent-status-metrics">
                <div className="agent-metric">
                  <span className="metric-label">Context</span>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{
                        width: `${(agent.contextUsage / agent.contextLimit) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="metric-value">
                    {agent.contextUsage.toLocaleString()} / {agent.contextLimit.toLocaleString()}
                  </span>
                </div>

                <div className="agent-metric">
                  <span className="metric-label">Tokens</span>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{ width: `${(agent.tokenUsage / agent.tokenLimit) * 100}%` }}
                    />
                  </div>
                  <span className="metric-value">
                    {agent.tokenUsage.toLocaleString()} / {agent.tokenLimit.toLocaleString()}
                  </span>
                </div>

                <div className="agent-metric">
                  <span className="metric-label">Uptime</span>
                  <span className="metric-value">{formatUptime(agent.uptime)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
