/**
 * OpenAI Codex Agent Adapter
 *
 * Adapter for OpenAI Codex CLI agent.
 * Reads config from ~/.codex/config.toml and ~/.codex/auth.json
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BaseAgent } from "../base/BaseAgent.js";
import type {
  AgentConfig,
  AgentInfo,
  AgentTask,
  MCPInfo,
  SkillInfo,
  TaskResult,
  TerminalOptions,
  TerminalSession,
} from "../types.js";

/**
 * OpenAI Codex configuration format
 */
interface CodexConfigFile {
  api_key?: string;
  base_url?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  provider?: string;
  [key: string]: unknown;
}

/**
 * OpenAI Codex auth format
 */
interface CodexAuthFile {
  apiKey?: string;
  token?: string;
  provider?: string;
  [key: string]: unknown;
}

/**
 * OpenAI Codex Agent Adapter
 */
export class CodexAgent extends BaseAgent {
  private tomlPath: string;
  private authPath: string;

  constructor() {
    super(
      "codex",
      "OpenAI Codex",
      "/icons/agents/codex.svg",
      "OpenAI's Codex CLI - AI-powered coding assistant"
    );

    // Codex config locations
    const configDir = path.join(os.homedir(), ".codex");
    this.tomlPath = path.join(configDir, "config.toml");
    this.authPath = path.join(configDir, "auth.json");
  }

  /**
   * Get agent info
   */
  async getInfo(): Promise<AgentInfo> {
    const isInstalled = await this.checkIfInstalled();
    const config = await this.getConfig();

    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      description: this.description,
      enabled: isInstalled,
      installed: isInstalled,
      version: await this.getVersion(),
      configPath: this.tomlPath,
      configExists: isInstalled,
    };
  }

  /**
   * Load agent configuration
   */
  protected async loadConfig(): Promise<void> {
    try {
      if (!fs.existsSync(this.tomlPath)) {
        this.config = this.getDefaultConfig();
        return;
      }

      const { ConfigReader } = await import("../config/ConfigReader.js");
      const config = await ConfigReader.readTOML(this.tomlPath);

      // Also read auth.json for API key
      let apiKey: string | undefined;
      if (fs.existsSync(this.authPath)) {
        const auth = await ConfigReader.readJSON(this.authPath);
        const authFile = auth as CodexAuthFile;
        apiKey =
          typeof authFile.apiKey === "string"
            ? authFile.apiKey
            : typeof authFile.token === "string"
              ? authFile.token
              : undefined;
      }

      const codexConfig = config as CodexConfigFile;

      this.config = {
        apiKey:
          apiKey || (typeof codexConfig.api_key === "string" ? codexConfig.api_key : undefined),
        apiEndpoint:
          typeof codexConfig.base_url === "string"
            ? codexConfig.base_url
            : "https://api.openai.com/v1",
        model: typeof codexConfig.model === "string" ? codexConfig.model : "gpt-4",
        temperature:
          typeof codexConfig.temperature === "number" ? codexConfig.temperature : undefined,
        maxTokens: typeof codexConfig.max_tokens === "number" ? codexConfig.max_tokens : undefined,
        mcpServers: [],
        skills: [],
      };
    } catch (error) {
      console.error("[Codex] Failed to load config:", error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Save agent configuration
   */
  protected async saveConfig(): Promise<void> {
    try {
      const configDir = path.join(os.homedir(), ".codex");

      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Update TOML config
      if (fs.existsSync(this.tomlPath)) {
        const { ConfigReader } = await import("../config/ConfigReader.js");
        let existingConfig = await ConfigReader.readTOML(this.tomlPath);

        // Merge with new config
        existingConfig = {
          ...existingConfig,
          ...(this.config.apiKey && { api_key: this.config.apiKey }),
          ...(this.config.apiEndpoint && { base_url: this.config.apiEndpoint }),
          ...(this.config.model && { model: this.config.model }),
          ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
          ...(this.config.maxTokens !== undefined && { max_tokens: this.config.maxTokens }),
        };

        // Write TOML (convert to string)
        const toml = this.configToTOMLString(existingConfig);
        fs.writeFileSync(this.tomlPath, toml, "utf-8");
      }

      // Update auth.json for API key
      if (this.config.apiKey) {
        const { ConfigReader } = await import("../config/ConfigReader.js");
        let auth: CodexAuthFile = {};
        if (fs.existsSync(this.authPath)) {
          auth = (await ConfigReader.readJSON(this.authPath)) as CodexAuthFile;
        }

        auth.apiKey = this.config.apiKey;
        fs.writeFileSync(this.authPath, JSON.stringify(auth, null, 2), "utf-8");
      }
    } catch (error) {
      console.error("[Codex] Failed to save config:", error);
      throw error;
    }
  }

  /**
   * Start a terminal with Codex CLI
   */
  async startTerminal(options: TerminalOptions): Promise<TerminalSession> {
    // Codex CLI command: codex
    const command = "codex";
    const args = this.buildCodexArgs(options);

    return {
      id: options.terminalId || `codex-${Date.now()}`,
      command,
      args,
      cwd: options.cwd,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
    };
  }

  /**
   * List configured MCPs
   * Codex doesn't natively support MCPs
   */
  async listMCPs(): Promise<MCPInfo[]> {
    return [];
  }

  /**
   * List configured Skills
   * Codex doesn't natively support Skills
   */
  async listSkills(): Promise<SkillInfo[]> {
    return [];
  }

  /**
   * Execute a task
   */
  async executeTask(task: AgentTask): Promise<TaskResult> {
    try {
      const { execSync } = await import("node:child_process");

      // Validate task content to prevent command injection
      if (!task.content || typeof task.content !== "string") {
        return {
          taskId: task.id,
          success: false,
          error: "Invalid task content",
        };
      }

      // Check for dangerous shell metacharacters
      const dangerousPatterns = [
        /[;&|`$()]/, // Shell metacharacters that could enable command chaining
        // biome-ignore lint/suspicious/noControlCharactersInRegex: security check for null bytes
        /\x00/, // Null bytes
        // biome-ignore lint/suspicious/noControlCharactersInRegex: security check for control characters
        /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/, // Control characters
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(task.content)) {
          return {
            taskId: task.id,
            success: false,
            error: "Task content contains invalid characters",
          };
        }
      }

      // Limit content length
      const MAX_CONTENT_LENGTH = 10000;
      if (task.content.length > MAX_CONTENT_LENGTH) {
        return {
          taskId: task.id,
          success: false,
          error: `Task content too long (max: ${MAX_CONTENT_LENGTH} characters)`,
        };
      }

      const args: string[] = ["codex"];

      switch (task.type) {
        case "prompt":
        case "command":
          args.push("--", task.content);
          break;
        case "code":
          args.push("--code", "--", task.content);
          break;
        default:
          return {
            taskId: task.id,
            success: false,
            error: `Unknown task type: ${task.type}`,
          };
      }

      // Use execFileSync instead of execSync to prevent command injection
      // This properly separates arguments from the command
      const { execFileSync } = await import("node:child_process");
      const output = execFileSync(args[0], args.slice(1), {
        encoding: "utf-8" as const,
        cwd: (task.options?.cwd as string) || process.cwd(),
      });

      return {
        taskId: task.id,
        success: true,
        output,
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check if Codex is installed
   */
  private async checkIfInstalled(): Promise<boolean> {
    try {
      // Check if codex command is available
      const { execSync } = await import("node:child_process");
      execSync("codex --version", { stdio: "ignore" });
      return true;
    } catch {
      // Fallback: check if config file exists
      return fs.existsSync(this.tomlPath) || fs.existsSync(this.authPath);
    }
  }

  /**
   * Get Codex version
   */
  private async getVersion(): Promise<string | null> {
    try {
      const { execSync } = await import("node:child_process");
      const output = execSync("codex --version", { encoding: "utf-8" });
      const match = output.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Build Codex CLI arguments
   */
  private buildCodexArgs(options: Record<string, unknown>): string[] {
    const args: string[] = [];

    if (options.model) {
      args.push("--model", String(options.model));
    }

    if (options.temperature) {
      args.push("--temperature", String(options.temperature));
    }

    if (options.maxTokens) {
      args.push("--max-tokens", String(options.maxTokens));
    }

    // Add prompt
    if (options.prompt) {
      args.push(String(options.prompt));
    }

    return args;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AgentConfig {
    return {
      apiEndpoint: "https://api.openai.com/v1",
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 2000,
      mcpServers: [],
      skills: [],
    };
  }

  /**
   * Convert config object to TOML string
   */
  private configToTOMLString(config: Record<string, unknown>): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(config)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === "string") {
        lines.push(`${key} = "${value}"`);
      } else if (typeof value === "number") {
        lines.push(`${key} = ${value}`);
      } else if (typeof value === "boolean") {
        lines.push(`${key} = ${value}`);
      } else if (Array.isArray(value)) {
        lines.push(`${key} = [${value.map((v) => `"${v}"`).join(", ")}]`);
      } else if (typeof value === "object") {
        // Nested object - create table
        lines.push(`[${key}]`);
        for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
          if (typeof nestedValue === "string") {
            lines.push(`  ${nestedKey} = "${nestedValue}"`);
          } else if (typeof nestedValue === "number") {
            lines.push(`  ${nestedKey} = ${nestedValue}`);
          } else if (typeof nestedValue === "boolean") {
            lines.push(`  ${nestedKey} = ${nestedValue}`);
          }
        }
      }
    }

    return `${lines.join("\n")}\n`;
  }
}
