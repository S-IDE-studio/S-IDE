/**
 * Kimi Agent Adapter
 *
 * Kimi is Moonshot AI's code assistant CLI.
 * Config location: ~/.kimi/config.toml
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

const KIMI_ID = "kimi" as const;
const KIMI_NAME = "Kimi";
const KIMI_ICON = "/icons/agents/kimi.svg";
const KIMI_DESCRIPTION = "Moonshot AI's code assistant";

export class KimiAgent extends BaseAgent {
  private tomlPath: string;
  private authPath: string;

  constructor() {
    super(KIMI_ID, KIMI_NAME, KIMI_ICON, KIMI_DESCRIPTION);

    // Kimi config locations
    const configDir = path.join(os.homedir(), ".kimi");
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
      id: KIMI_ID,
      name: KIMI_NAME,
      icon: KIMI_ICON,
      description: KIMI_DESCRIPTION,
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
        const authFile = auth as Record<string, unknown>;
        apiKey =
          typeof authFile.apiKey === "string"
            ? authFile.apiKey
            : typeof authFile.token === "string"
              ? authFile.token
              : undefined;
      }

      this.config = {
        apiKey:
          apiKey ||
          (typeof config.apiKey === "string"
            ? config.apiKey
            : typeof config.api_key === "string"
              ? config.api_key
              : undefined),
        apiEndpoint:
          (typeof config.endpoint === "string"
            ? config.endpoint
            : typeof config.api_endpoint === "string"
              ? config.api_endpoint
              : undefined) || "https://api.moonshot.cn",
        model: typeof config.model === "string" ? config.model : "moonshot-v1-8k",
        temperature: typeof config.temperature === "number" ? config.temperature : undefined,
        maxTokens:
          typeof config.maxTokens === "number"
            ? config.maxTokens
            : typeof config.max_tokens === "number"
              ? config.max_tokens
              : undefined,
        mcpServers: [],
        skills: [],
      };
    } catch (error) {
      console.error("[Kimi] Failed to load config:", error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Save agent configuration
   */
  protected async saveConfig(): Promise<void> {
    try {
      const configDir = path.join(os.homedir(), ".kimi");

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
          ...(this.config.apiEndpoint && { endpoint: this.config.apiEndpoint }),
          ...(this.config.model && { model: this.config.model }),
          ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
          ...(this.config.maxTokens !== undefined && { maxTokens: this.config.maxTokens }),
        };

        // Write TOML (convert to string)
        const toml = this.configToTOMLString(existingConfig);
        fs.writeFileSync(this.tomlPath, toml, "utf-8");
      }

      // Update auth.json for API key
      if (this.config.apiKey) {
        const { ConfigReader } = await import("../config/ConfigReader.js");
        let auth: Record<string, unknown> = {};
        if (fs.existsSync(this.authPath)) {
          auth = (await ConfigReader.readJSON(this.authPath)) as Record<string, unknown>;
        }

        auth.apiKey = this.config.apiKey;
        fs.writeFileSync(this.authPath, JSON.stringify(auth, null, 2), "utf-8");
      }
    } catch (error) {
      console.error("[Kimi] Failed to save config:", error);
      throw error;
    }
  }

  /**
   * List configured MCPs
   * Kimi doesn't natively support MCPs
   */
  async listMCPs(): Promise<MCPInfo[]> {
    return [];
  }

  /**
   * List configured Skills
   * Kimi doesn't natively support Skills
   */
  async listSkills(): Promise<SkillInfo[]> {
    return [];
  }

  /**
   * Start a terminal with Kimi CLI
   */
  async startTerminal(options: TerminalOptions): Promise<TerminalSession> {
    // Kimi CLI command: kimi
    const command = "kimi";
    const args = this.buildKimiArgs(options);

    return {
      id: options.terminalId || `kimi-${Date.now()}`,
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

      const args: string[] = ["kimi"];

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
   * Check if Kimi is installed
   */
  private async checkIfInstalled(): Promise<boolean> {
    try {
      // Check if kimi command is available
      const { execSync } = await import("node:child_process");
      execSync("kimi --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Kimi version
   */
  private async getVersion(): Promise<string | null> {
    try {
      const { execSync } = await import("node:child_process");
      const output = execSync("kimi --version", { encoding: "utf-8" });
      const match = output.match(/version (\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Build Kimi CLI arguments
   */
  private buildKimiArgs(options: Record<string, unknown>): string[] {
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
      apiEndpoint: "https://api.moonshot.cn",
      model: "moonshot-v1-8k",
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
