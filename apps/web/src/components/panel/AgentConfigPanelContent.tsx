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
  config?: Record<string, unknown>;
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

interface AgentConfigFileView {
  label: string;
  path: string;
  exists: boolean;
  size?: number;
  content?: string;
  error?: string;
}

interface AgentConfigSummary {
  skills?: Skill[];
  mcpServers?: MCPServerConfig[];
}

interface AgentType {
  id: string;
  name: string;
  icon: string;
}

interface RuntimeAgentInfo {
  id: string;
  name: string;
  enabled?: boolean;
}

const AGENTS: AgentType[] = [
  { id: "claude", name: "Claude", icon: "bot" },
  { id: "codex", name: "Codex", icon: "code" },
  { id: "copilot", name: "Copilot", icon: "github" },
  { id: "cursor", name: "Cursor", icon: "mouse-pointer" },
  { id: "kimi", name: "Kimi", icon: "sparkles" },
  { id: "opencode", name: "OpenCode", icon: "terminal" },
];

interface AgentConfigPanelContentProps {
  initialAgentId?: string;
}

export function AgentConfigPanelContent({ initialAgentId }: AgentConfigPanelContentProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(initialAgentId || "claude");
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [configFiles, setConfigFiles] = useState<AgentConfigFileView[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");
  const [runtimeAgents, setRuntimeAgents] = useState<RuntimeAgentInfo[]>([]);
  const [selectedTargetAgentIds, setSelectedTargetAgentIds] = useState<string[]>([]);
  const [bulkInstalling, setBulkInstalling] = useState(false);
  const [bulkIncludeSkills, setBulkIncludeSkills] = useState(true);
  const [bulkIncludeMcpServers, setBulkIncludeMcpServers] = useState(true);
  const [bulkReplaceExisting, setBulkReplaceExisting] = useState(false);

  const fetchConfig = useCallback(async (agentId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      } else {
        setConfig(null);
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch agent config:", error);
      setConfig(null);
      setLoading(false);
    }
  }, []);

  const fetchRuntimeAgents = useCallback(async () => {
    try {
      const response = await fetch("/api/agents");
      if (!response.ok) return;
      const data = (await response.json()) as RuntimeAgentInfo[];
      setRuntimeAgents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch runtime agents:", error);
    }
  }, []);

  const fetchConfigFiles = useCallback(async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/config-files/${agentId}`);
      if (!response.ok) {
        setConfigFiles([]);
        setSelectedFilePath("");
        return;
      }
      const data = (await response.json()) as {
        files?: AgentConfigFileView[];
        summary?: AgentConfigSummary;
      };
      const files = Array.isArray(data.files) ? data.files : [];
      setConfigFiles(files);
      const firstExisting = files.find((f) => f.exists);
      setSelectedFilePath(firstExisting?.path || files[0]?.path || "");

      const summary = data.summary;
      if (summary) {
        setConfig((prev) => ({
          ...(prev || {}),
          ...(Array.isArray(summary.skills) ? { skills: summary.skills } : {}),
          ...(Array.isArray(summary.mcpServers) ? { mcpServers: summary.mcpServers } : {}),
        }));
      }
    } catch (error) {
      console.error("Failed to fetch config files:", error);
      setConfigFiles([]);
      setSelectedFilePath("");
    }
  }, []);

  useEffect(() => {
    fetchConfig(selectedAgentId);
    fetchConfigFiles(selectedAgentId);
  }, [selectedAgentId, fetchConfig, fetchConfigFiles]);

  useEffect(() => {
    fetchRuntimeAgents();
  }, [fetchRuntimeAgents]);

  useEffect(() => {
    if (initialAgentId && initialAgentId !== selectedAgentId) {
      setSelectedAgentId(initialAgentId);
    }
  }, [initialAgentId, selectedAgentId]);

  useEffect(() => {
    setSelectedTargetAgentIds((prev) =>
      prev.filter((id) => runtimeAgents.some((agent) => agent.id === id) && id !== selectedAgentId)
    );
  }, [runtimeAgents, selectedAgentId]);

  const selectedFile = configFiles.find((file) => file.path === selectedFilePath);
  const selectedAgentSupportsSave = selectedAgentId !== "opencode";

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
      setSaving(false);
    } catch (error) {
      console.error("Failed to save config:", error);
      setMessage("Failed to save config");
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

  const toggleTargetAgent = useCallback((agentId: string) => {
    setSelectedTargetAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  }, []);

  const handleBulkInstall = useCallback(async () => {
    if (!config) return;
    if (selectedTargetAgentIds.length === 0) {
      setMessage("Failed: Select at least one target agent");
      return;
    }

    const skills = bulkIncludeSkills
      ? (config.skills || []).filter((skill) => skill.enabled !== false)
      : [];
    const mcpServers = bulkIncludeMcpServers
      ? (config.mcpServers || []).filter((mcp) => mcp.enabled !== false)
      : [];

    if (skills.length === 0 && mcpServers.length === 0) {
      setMessage("Failed: No installable Skills/MCP servers in source agent");
      return;
    }

    setBulkInstalling(true);
    try {
      const response = await fetch("/api/agents/bulk-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAgentIds: selectedTargetAgentIds,
          skills,
          mcpServers,
          replaceExisting: bulkReplaceExisting,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setMessage(`Failed: ${errorText}`);
        return;
      }

      const data = (await response.json()) as {
        success?: boolean;
        results?: Array<{ success: boolean }>;
      };
      const successCount = Array.isArray(data.results)
        ? data.results.filter((entry) => entry.success).length
        : 0;
      setMessage(
        data.success
          ? `Installed to ${successCount} agents`
          : `Partial success: installed to ${successCount} agents`
      );
    } catch (error) {
      console.error("Bulk install failed:", error);
      setMessage("Failed: Bulk install request failed");
    } finally {
      setBulkInstalling(false);
    }
  }, [
    bulkIncludeMcpServers,
    bulkIncludeSkills,
    bulkReplaceExisting,
    config,
    selectedTargetAgentIds,
  ]);

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

      <div className="config-section">
        <div className="config-section-header">
          <h3>Config Files</h3>
        </div>
        <div className="config-section-list">
          {configFiles.length === 0 && <div className="config-empty">No known config files</div>}
          {configFiles.length > 0 && (
            <>
              <select
                className="dropdown"
                value={selectedFilePath}
                onChange={(e) => setSelectedFilePath(e.target.value)}
              >
                {configFiles.map((file) => (
                  <option key={file.path} value={file.path}>
                    {file.label} {file.exists ? "" : "(not found)"}
                  </option>
                ))}
              </select>

              {selectedFile && (
                <div className="config-item" style={{ marginTop: 8, display: "block" }}>
                  <div className="config-item-desc">{selectedFile.path}</div>
                  {selectedFile.error && (
                    <div className="settings-message error" style={{ marginTop: 8 }}>
                      {selectedFile.error}
                    </div>
                  )}
                  {!selectedFile.error && selectedFile.exists && (
                    <textarea
                      readOnly
                      value={selectedFile.content || ""}
                      style={{
                        width: "100%",
                        minHeight: 220,
                        marginTop: 8,
                        background: "#0b0b0b",
                        color: "#d4d4d4",
                        border: "1px solid #2a2a2a",
                        borderRadius: 6,
                        padding: 10,
                        fontFamily:
                          '"Cascadia Code", "JetBrains Mono", "Consolas", "Menlo", monospace',
                        fontSize: 12,
                      }}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="config-section">
        <div className="config-section-header">
          <h3>Bulk Install (Multi-Agent)</h3>
        </div>
        <div className="config-section-list">
          <div className="config-item" style={{ display: "block" }}>
            <div className="config-item-desc">Source: {selectedAgentId}</div>

            <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={bulkIncludeSkills}
                  onChange={(e) => setBulkIncludeSkills(e.target.checked)}
                />
                Skills
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={bulkIncludeMcpServers}
                  onChange={(e) => setBulkIncludeMcpServers(e.target.checked)}
                />
                MCP Servers
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={bulkReplaceExisting}
                  onChange={(e) => setBulkReplaceExisting(e.target.checked)}
                />
                Replace Existing
              </label>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="config-item-desc" style={{ marginBottom: 6 }}>
                Target Agents
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {runtimeAgents
                  .filter((agent) => agent.id !== selectedAgentId)
                  .map((agent) => (
                    <label key={agent.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedTargetAgentIds.includes(agent.id)}
                        onChange={() => toggleTargetAgent(agent.id)}
                      />
                      {agent.name}
                    </label>
                  ))}
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="primary-button"
                onClick={handleBulkInstall}
                disabled={bulkInstalling}
              >
                {bulkInstalling ? "Installing..." : "Install to Selected Agents"}
              </button>
            </div>
          </div>
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
          <button
            type="button"
            className="ghost-button"
            onClick={handleCopyConfig}
            disabled={!selectedAgentSupportsSave}
          >
            Copy to Other Agents
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={saving || !selectedAgentSupportsSave}
          >
            {saving ? "Saving..." : "Save Config"}
          </button>
        </div>
      </div>
    </div>
  );
}
