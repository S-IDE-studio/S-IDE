/**
 * Agent Config Panel Content (Workspace-Specific)
 * Displays workspace-specific agent configuration
 */

import { useCallback, useEffect, useState } from "react";
import type { Workspace } from "../../types";

interface WorkspaceAgentConfig {
  workspaceId: string;
  agentType: string;
  config: Record<string, unknown>;
}

interface WorkspaceAgentConfigProps {
  workspaceId: string;
  workspaces?: Workspace[];
}

export function AgentConfigLocalPanelContent({
  workspaceId,
  workspaces,
}: WorkspaceAgentConfigProps) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedAgentType, setSelectedAgentType] = useState<string>("claude");

  const workspace = workspaces?.find((w) => w.id === workspaceId);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      let success = false;
      let configData: any = null;

      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/agent-config`);
        if (response.ok) {
          configData = await response.json();
          success = true;
        }
      } catch (error) {
        console.error("Failed to fetch workspace agent config:", error);
      }

      if (success && configData) {
        setConfig(configData.config || {});
      } else {
        setMessage("Failed to load config");
      }
      setLoading(false);
    };

    fetchConfig();
  }, [workspaceId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage("");

    let success = false;
    let errorText = "";

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/agent-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType: selectedAgentType, config }),
      });

      if (response.ok) {
        success = true;
      } else {
        errorText = await response.text();
      }
    } catch (error) {
      console.error("Failed to save config:", error);
      errorText = "Connection error";
    }

    if (success) {
      setMessage("Config saved successfully");
    } else {
      setMessage(errorText ? `Failed to save: ${errorText}` : "Failed to save config");
    }
    setSaving(false);
  }, [workspaceId, selectedAgentType, config]);

  const handleCopyFromGlobal = useCallback(async () => {
    let success = false;
    let fetchedData = null;

    try {
      const response = await fetch(`/api/agents/${selectedAgentType}/config`);
      if (response.ok) {
        fetchedData = await response.json();
        success = true;
      }
    } catch (error) {
      console.error("Failed to copy global config:", error);
    }

    if (success) {
      setConfig(fetchedData);
      setMessage("Config copied from global settings");
    } else {
      setMessage("Failed to copy global config");
    }
  }, [selectedAgentType]);

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
        <h2>Agent Config (Workspace)</h2>
        {workspace && (
          <div className="workspace-indicator">
            <span>Workspace: {workspace.name}</span>
          </div>
        )}
        <div className="agent-selector">
          <select
            value={selectedAgentType}
            onChange={(e) => setSelectedAgentType(e.target.value)}
            className="dropdown"
          >
            <option value="claude">Claude</option>
            <option value="codex">Codex</option>
            <option value="copilot">Copilot</option>
            <option value="cursor">Cursor</option>
            <option value="kimi">Kimi</option>
          </select>
        </div>
      </div>

      <div className="agent-config-content">
        <div className="config-actions config-actions--top">
          <button type="button" className="ghost-button" onClick={handleCopyFromGlobal}>
            Copy from Global
          </button>
        </div>

        <div className="config-editor">
          <label htmlFor="config-json">Configuration (JSON)</label>
          <textarea
            id="config-json"
            value={config ? JSON.stringify(config, null, 2) : ""}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setConfig(parsed);
              } catch {
                // Invalid JSON, don't update
              }
            }}
            className="code-editor"
            rows={20}
            spellCheck={false}
          />
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
            onClick={() => {
              setConfig({});
              setMessage("Config cleared");
            }}
          >
            Clear
          </button>
          <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Config"}
          </button>
        </div>
      </div>
    </div>
  );
}
