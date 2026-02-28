import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import toml from "toml";

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_RETURNED_FILES = 20;

export type AgentConfigViewId = "claude" | "codex" | "kimi" | "cursor" | "copilot" | "opencode";

export interface AgentConfigFileCandidate {
  label: string;
  path: string;
}

export interface AgentConfigFileView {
  label: string;
  path: string;
  exists: boolean;
  size?: number;
  content?: string;
  error?: string;
}

export interface AgentConfigSummarySkill {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

export interface AgentConfigSummaryMcp {
  id: string;
  name: string;
  command: string;
  args?: string[];
  enabled: boolean;
}

export interface AgentConfigSummary {
  skills: AgentConfigSummarySkill[];
  mcpServers: AgentConfigSummaryMcp[];
}

const SUPPORTED_AGENT_IDS = new Set<AgentConfigViewId>([
  "claude",
  "codex",
  "kimi",
  "cursor",
  "copilot",
  "opencode",
]);

export function isSupportedAgentConfigViewId(agentId: string): agentId is AgentConfigViewId {
  return SUPPORTED_AGENT_IDS.has(agentId as AgentConfigViewId);
}

export function getAgentConfigFileCandidates(
  agentId: string,
  homeDir: string = os.homedir()
): AgentConfigFileCandidate[] {
  const h = homeDir;
  const candidates: Record<AgentConfigViewId, AgentConfigFileCandidate[]> = {
    claude: [
      { label: "settings.json", path: path.join(h, ".claude", "settings.json") },
      { label: "mcp_servers.json", path: path.join(h, ".claude", "mcp_servers.json") },
      { label: "skills.json", path: path.join(h, ".claude", "skills.json") },
    ],
    codex: [
      { label: "config.toml", path: path.join(h, ".codex", "config.toml") },
      { label: "auth.json", path: path.join(h, ".codex", "auth.json") },
    ],
    kimi: [
      { label: "config.toml", path: path.join(h, ".kimi", "config.toml") },
      { label: "auth.json", path: path.join(h, ".kimi", "auth.json") },
    ],
    cursor: [
      {
        label: "state.vscdb",
        path:
          process.platform === "win32"
            ? path.join(h, "AppData", "Roaming", "Cursor", "User", "globalStorage", "state.vscdb")
            : process.platform === "darwin"
              ? path.join(
                  h,
                  "Library",
                  "Application Support",
                  "Cursor",
                  "User",
                  "globalStorage",
                  "state.vscdb"
                )
              : path.join(h, ".config", "Cursor", "User", "globalStorage", "state.vscdb"),
      },
    ],
    copilot: [
      { label: "hosts.json", path: path.join(h, ".config", "github-copilot", "hosts.json") },
      { label: "apps.json", path: path.join(h, ".config", "github-copilot", "apps.json") },
      {
        label: "hosts.json (Windows)",
        path: path.join(h, "AppData", "Roaming", "GitHub Copilot", "hosts.json"),
      },
    ],
    opencode: [
      { label: "config.json", path: path.join(h, ".opencode", "config.json") },
      { label: "config.toml", path: path.join(h, ".opencode", "config.toml") },
      { label: "auth.json", path: path.join(h, ".opencode", "auth.json") },
      {
        label: "config.json (~/.config)",
        path: path.join(h, ".config", "opencode", "config.json"),
      },
      {
        label: "config.toml (~/.config)",
        path: path.join(h, ".config", "opencode", "config.toml"),
      },
    ],
  };

  if (!isSupportedAgentConfigViewId(agentId)) {
    return [];
  }

  return candidates[agentId];
}

export async function readAgentConfigFiles(agentId: string): Promise<AgentConfigFileView[]> {
  const uniquePaths = new Set<string>();
  const files = getAgentConfigFileCandidates(agentId).filter((entry) => {
    if (uniquePaths.has(entry.path)) {
      return false;
    }
    uniquePaths.add(entry.path);
    return true;
  });

  const selected = files.slice(0, MAX_RETURNED_FILES);
  const result = await Promise.all(selected.map(readConfigFileCandidate));
  return result;
}

export async function readAgentConfigSummary(agentId: string): Promise<AgentConfigSummary> {
  if (!isSupportedAgentConfigViewId(agentId)) {
    return { skills: [], mcpServers: [] };
  }

  const homeDir = os.homedir();

  if (agentId === "claude") {
    return readClaudeSummary(homeDir);
  }
  if (agentId === "codex") {
    return readCodexSummary(homeDir);
  }

  return { skills: [], mcpServers: [] };
}

const SENSITIVE_KEY_PATTERN =
  /(api[_-]?key|token|access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|password|secret)/i;
const SECRET_ARG_SWITCHES = new Set(["--api-key", "--apikey", "--token", "--secret"]);

export function redactSensitiveContent(content: string): string {
  let redacted = content;

  // JSON style: "key": "value"
  redacted = redacted.replace(/"([^"]+)"\s*:\s*"([^"]*)"/g, (full, key: string, value: string) => {
    if (!SENSITIVE_KEY_PATTERN.test(key)) {
      return full;
    }
    if (value.length === 0) {
      return full;
    }
    return `"${key}": "***REDACTED***"`;
  });

  // TOML / ENV style: key = "value" or key=value
  redacted = redacted.replace(
    /^([A-Za-z0-9_.-]+)\s*=\s*(".*?"|'.*?'|[^\r\n#]+)$/gm,
    (full, key: string) => {
      if (!SENSITIVE_KEY_PATTERN.test(key)) {
        return full;
      }
      return `${key} = "***REDACTED***"`;
    }
  );

  // CLI args style: "--api-key", "value"
  redacted = redacted.replace(
    /(--api[_-]?key"\s*,\s*")([^"]+)(")/gi,
    (_full, prefix: string, _value: string, suffix: string) => {
      return `${prefix}***REDACTED***${suffix}`;
    }
  );

  return redacted;
}

async function readClaudeSummary(homeDir: string): Promise<AgentConfigSummary> {
  const settingsPath = path.join(homeDir, ".claude", "settings.json");
  const mcpPath = path.join(homeDir, ".claude", "mcp_servers.json");

  const skills: AgentConfigSummarySkill[] = [];
  const mcpServers: AgentConfigSummaryMcp[] = [];

  try {
    const raw = await fs.readFile(settingsPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      enabledPlugins?: Record<string, boolean>;
    };

    if (parsed.enabledPlugins && typeof parsed.enabledPlugins === "object") {
      for (const [pluginId, enabled] of Object.entries(parsed.enabledPlugins)) {
        skills.push({
          id: pluginId,
          name: pluginId,
          enabled: Boolean(enabled),
        });
      }
    }
  } catch {
    // best-effort parsing
  }

  try {
    const raw = await fs.readFile(mcpPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      mcpServers?: Record<
        string,
        { command?: string; args?: string[]; enabled?: boolean; url?: string }
      >;
      servers?: Record<
        string,
        { command?: string; args?: string[]; enabled?: boolean; url?: string }
      >;
    };

    const source = parsed.mcpServers || parsed.servers || {};
    for (const [id, value] of Object.entries(source)) {
      mcpServers.push({
        id,
        name: id,
        command: value.command || value.url || "",
        args: Array.isArray(value.args) ? sanitizeArgs(value.args) : undefined,
        enabled: value.enabled !== false,
      });
    }
  } catch {
    // best-effort parsing
  }

  return { skills, mcpServers };
}

async function readCodexSummary(homeDir: string): Promise<AgentConfigSummary> {
  const configPath = path.join(homeDir, ".codex", "config.toml");
  const skillsDir = path.join(homeDir, ".codex", "skills");

  const skills: AgentConfigSummarySkill[] = [];
  const mcpServers: AgentConfigSummaryMcp[] = [];

  try {
    const skillEntries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of skillEntries) {
      if (!entry.isDirectory()) {
        continue;
      }
      skills.push({
        id: entry.name,
        name: entry.name,
        enabled: true,
      });
    }
  } catch {
    // best-effort parsing
  }

  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const parsed = toml.parse(raw) as {
      mcp_servers?: Record<string, { command?: string; args?: string[]; url?: string }>;
    };

    const source = parsed.mcp_servers || {};
    for (const [id, value] of Object.entries(source)) {
      mcpServers.push({
        id,
        name: id,
        command: value.command || value.url || "",
        args: Array.isArray(value.args) ? sanitizeArgs(value.args) : undefined,
        enabled: true,
      });
    }
  } catch {
    // best-effort parsing
  }

  return { skills, mcpServers };
}

function sanitizeArgs(args: string[]): string[] {
  return args.map((arg, index) => {
    const prev = index > 0 ? args[index - 1]?.toLowerCase() : "";
    if (SECRET_ARG_SWITCHES.has(prev)) {
      return "***REDACTED***";
    }
    if (SENSITIVE_KEY_PATTERN.test(arg) && arg.includes("=")) {
      const [left] = arg.split("=");
      return `${left}=***REDACTED***`;
    }
    return arg;
  });
}

async function readConfigFileCandidate(
  candidate: AgentConfigFileCandidate
): Promise<AgentConfigFileView> {
  try {
    const stat = await fs.stat(candidate.path);
    if (!stat.isFile()) {
      return {
        label: candidate.label,
        path: candidate.path,
        exists: false,
      };
    }

    if (stat.size > MAX_FILE_SIZE) {
      return {
        label: candidate.label,
        path: candidate.path,
        exists: true,
        size: stat.size,
        error: "File is too large to preview (over 1MB).",
      };
    }

    const rawContent = await fs.readFile(candidate.path, "utf-8");
    const content = redactSensitiveContent(rawContent);
    return {
      label: candidate.label,
      path: candidate.path,
      exists: true,
      size: stat.size,
      content,
    };
  } catch {
    return {
      label: candidate.label,
      path: candidate.path,
      exists: false,
    };
  }
}
