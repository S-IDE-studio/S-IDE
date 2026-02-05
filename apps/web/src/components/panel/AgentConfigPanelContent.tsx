/**
 * Agent Config Panel Content (Global)
 * Displays global agent settings (~/.claude/) with GUI for Skills, MCP servers, workflows, SubAgents
 */

import { useCallback, useEffect, useState } from "react";

interface Skill {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

interface AgentConfig {
  skills?: Skill[];
  mcpServers?: MCPServerConfig[];
  workflows?: Workflow[];
  [key: string]: unknown;
}

interface AgentType {
  id: string;
  name: string;
  icon: string;
}

const AGENTS: AgentType[] = [
  { id: "claude", name: "Claude", icon: "bot" },
  { id: "codex", name: "Codex", icon: "code" },
  { id: "copilot", name: "Copilot", icon: "github" },
  { id: "cursor", name: "Cursor", icon: "mouse-pointer" },
  { id: "kimi", name: "Kimi", icon: "sparkles" },
];

export function AgentConfigPanelContent() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("claude");
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchConfig = useCallback(async (agentId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error("Failed to fetch agent config:", error);
      setMessage("Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig(selectedAgentId);
  }, [selectedAgentId, fetchConfig]);

  const handleSave = useCallback(async () => {
    if (!config) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/agents/${selectedAgentId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setMessage("Config saved successfully");
      } else {
        const error = await response.text();
        setMessage(`Failed to save: ${error}`);
      }
    } catch (error) {
      console.error("Failed to save config:", error);
      setMessage("Failed to save config");
    } finally {
      setSaving(false);
    }
  }, [config, selectedAgentId]);

  const handleCopyConfig = useCallback(async () => {
    if (!config) return;

    try {
      await fetch(`/api/agents/${selectedAgentId}/copy-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setMessage("Config copied to other agents");
    } catch (error) {
      console.error("Failed to copy config:", error);
      setMessage("Failed to copy config");
    }
  }, [config, selectedAgentId]);

  if (loading) {
    return (
      <div className="panel-content-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="agent-config-panel">
      <div className="agent-config-header">
        <h2>Agent Config (Global)</h2>
        <div className="agent-selector">
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="dropdown"
          >
            {AGENTS.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="agent-config-content">
        {/* Skills Section */}
        <div className="config-section">
          <div className="config-section-header">
            <h3>Skills</h3>
            <button type="button" className="ghost-button" onClick={() => {}}>
              Add Skill
            </button>
          </div>
          <div className="config-section-list">
            {config?.skills?.map((skill) => (
              <div key={skill.id} className="config-item">
                <div className="config-item-info">
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        skills: config.skills?.map((s) =>
                          s.id === skill.id ? { ...s, enabled: e.target.checked } : s
                        ),
                      });
                    }}
                  />
                  <span className="config-item-name">{skill.name}</span>
                  {skill.description && (
                    <span className="config-item-desc">{skill.description}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setConfig({
                      ...config,
                      skills: config.skills?.filter((s) => s.id !== skill.id),
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            )) || <div className="config-empty">No skills configured</div>}
          </div>
        </div>

        {/* MCP Servers Section */}
        <div className="config-section">
          <div className="config-section-header">
            <h3>MCP Servers</h3>
            <button type="button" className="ghost-button" onClick={() => {}}>
              Add Server
            </button>
          </div>
          <div className="config-section-list">
            {config?.mcpServers?.map((server) => (
              <div key={server.id} className="config-item">
                <div className="config-item-info">
                  <input
                    type="checkbox"
                    checked={server.enabled}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        mcpServers: config.mcpServers?.map((s) =>
                          s.id === server.id ? { ...s, enabled: e.target.checked } : s
                        ),
                      });
                    }}
                  />
                  <span className="config-item-name">{server.name}</span>
                  <code className="config-item-command">{server.command}</code>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setConfig({
                      ...config,
                      mcpServers: config.mcpServers?.filter((s) => s.id !== server.id),
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            )) || <div className="config-empty">No MCP servers configured</div>}
          </div>
        </div>

        {/* Workflows Section */}
        <div className="config-section">
          <div className="config-section-header">
            <h3>Workflows</h3>
            <button type="button" className="ghost-button" onClick={() => {}}>
              Add Workflow
            </button>
          </div>
          <div className="config-section-list">
            {config?.workflows?.map((workflow) => (
              <div key={workflow.id} className="config-item">
                <div className="config-item-info">
                  <input
                    type="checkbox"
                    checked={workflow.enabled}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        workflows: config.workflows?.map((w) =>
                          w.id === workflow.id ? { ...w, enabled: e.target.checked } : w
                        ),
                      });
                    }}
                  />
                  <span className="config-item-name">{workflow.name}</span>
                  {workflow.description && (
                    <span className="config-item-desc">{workflow.description}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setConfig({
                      ...config,
                      workflows: config.workflows?.filter((w) => w.id !== workflow.id),
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            )) || <div className="config-empty">No workflows configured</div>}
          </div>
        </div>

        {message && (
          <div className={`settings-message ${message.includes("Failed") ? "error" : "success"}`}>
            {message}
          </div>
        )}

        <div className="config-actions">
          <button type="button" className="ghost-button" onClick={handleCopyConfig}>
            Copy to Other Agents
          </button>
          <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Config"}
          </button>
        </div>
      </div>
    </div>
  );
}
