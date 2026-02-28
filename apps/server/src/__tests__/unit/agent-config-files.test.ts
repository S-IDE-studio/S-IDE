import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getAgentConfigFileCandidates,
  redactSensitiveContent,
} from "../../utils/agent-config-files.js";

describe("getAgentConfigFileCandidates", () => {
  const homeDir = os.homedir();

  it("should return claude config file candidates from ~/.claude", () => {
    const candidates = getAgentConfigFileCandidates("claude", homeDir);
    const candidatePaths = candidates.map((entry) => entry.path);

    expect(candidatePaths).toContain(path.join(homeDir, ".claude", "settings.json"));
    expect(candidatePaths).toContain(path.join(homeDir, ".claude", "mcp_servers.json"));
  });

  it("should include opencode config candidates", () => {
    const candidates = getAgentConfigFileCandidates("opencode", homeDir);
    const candidatePaths = candidates.map((entry) => entry.path);

    expect(candidatePaths).toContain(path.join(homeDir, ".opencode", "config.json"));
    expect(candidatePaths).toContain(path.join(homeDir, ".opencode", "config.toml"));
  });

  it("should return empty list for unsupported agent id", () => {
    expect(getAgentConfigFileCandidates("unknown", homeDir)).toEqual([]);
  });

  it("should redact sensitive keys in JSON and TOML content", () => {
    const sample = `{"access_token":"abc","name":"ok"}
OPENAI_API_KEY="secret"
args = ["/c", "npx", "--api-key", "top-secret"]
model = "gpt-5"`;
    const redacted = redactSensitiveContent(sample);

    expect(redacted).toContain('"access_token": "***REDACTED***"');
    expect(redacted).toContain('OPENAI_API_KEY = "***REDACTED***"');
    expect(redacted).toContain('--api-key", "***REDACTED***"');
    expect(redacted).toContain('model = "gpt-5"');
  });
});
