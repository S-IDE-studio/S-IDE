/**
 * Server Settings Panel Content
 * Displays server configuration settings
 */

import { useCallback, useEffect, useState } from "react";

interface ServerSettings {
  port: number;
  basicAuthEnabled: boolean;
  basicAuthUser?: string;
  corsOrigin?: string;
}

export function ServerSettingsPanelContent() {
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      let response;
      try {
        response = await fetch("/api/settings");
      } catch (error) {
        console.error("Failed to fetch settings:", error);
        setMessage("Failed to load settings");
      }

      if (response && response.ok) {
        let data;
        try {
          data = await response.json();
        } catch (error) {
          console.error("Failed to parse settings:", error);
        }
        if (data) {
          setSettings(data);
        }
      }
      setLoading(false);
    };

    fetchSettings();
  }, []);

  const handleSave = useCallback(async () => {
    if (!settings) return;

    setSaving(true);
    setMessage("");

    let response;
    let errorOccurred = false;

    try {
      response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      errorOccurred = true;
    }

    if (errorOccurred) {
      setMessage("Failed to save settings");
    } else if (response) {
      if (response.ok) {
        setMessage("Settings saved. Reload to apply changes.");
      } else {
        let error;
        try {
          error = await response.text();
        } catch (e) {
          error = "Unknown error";
        }
        setMessage(`Failed to save: ${error}`);
      }
    }
    setSaving(false);
  }, [settings]);

  if (loading) {
    return (
      <div className="panel-content-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!settings) {
    return <div className="panel-error">Failed to load settings</div>;
  }

  return (
    <div className="server-settings-panel">
      <div className="server-settings-header">
        <h2>Server Settings</h2>
      </div>

      <div className="server-settings-content">
        <div className="settings-group">
          <h3>Server Configuration</h3>

          <div className="settings-field">
            <label htmlFor="port">Port</label>
            <input
              id="port"
              type="number"
              value={settings.port}
              onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value, 10) })}
              className="text-input"
            />
          </div>

          <div className="settings-field">
            <label htmlFor="cors">CORS Origin</label>
            <input
              id="cors"
              type="text"
              value={settings.corsOrigin || ""}
              onChange={(e) => setSettings({ ...settings, corsOrigin: e.target.value })}
              placeholder="e.g., http://localhost:3000"
              className="text-input"
            />
          </div>
        </div>

        <div className="settings-group">
          <h3>Authentication</h3>

          <div className="settings-field">
            <label>
              <input
                type="checkbox"
                checked={settings.basicAuthEnabled}
                onChange={(e) => setSettings({ ...settings, basicAuthEnabled: e.target.checked })}
              />
              Enable Basic Auth
            </label>
          </div>

          {settings.basicAuthEnabled && (
            <>
              <div className="settings-field">
                <label htmlFor="basicAuthUser">Username</label>
                <input
                  id="basicAuthUser"
                  type="text"
                  value={settings.basicAuthUser || ""}
                  onChange={(e) => setSettings({ ...settings, basicAuthUser: e.target.value })}
                  className="text-input"
                />
              </div>

              <div className="settings-field">
                <label htmlFor="basicAuthPassword">Password</label>
                <input
                  id="basicAuthPassword"
                  type="password"
                  placeholder="Enter new password to change"
                  className="text-input"
                />
                <small>Leave empty to keep current password</small>
              </div>
            </>
          )}
        </div>

        {message && (
          <div className={`settings-message ${message.includes("Failed") ? "error" : "success"}`}>
            {message}
          </div>
        )}

        <div className="settings-actions">
          <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
