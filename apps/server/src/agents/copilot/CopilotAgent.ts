/**
 * GitHub Copilot Agent Adapter
 *
 * GitHub Copilot is primarily a VS Code extension, but it also has CLI capabilities.
 * Config location: ~/.config/github-copilot/
 */

import fs from "node:fs";
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

const COPILOT_ID = "copilot" as const;
const COPILOT_NAME = "GitHub Copilot";
const COPILOT_ICON = "copilot";
const COPILOT_DESCRIPTION = "GitHub's AI pair programmer";

export class CopilotAgent extends BaseAgent {
  constructor() {
    super(COPILOT_ID, COPILOT_NAME, COPILOT_ICON, COPILOT_DESCRIPTION);
    // Override config path for Copilot
    const path = require("node:path");
    const os = require("node:os");
    this.configPath = path.join(os.homedir(), ".config", "github-copilot");
  }

  /**
   * Get agent info
   */
  async getInfo(): Promise<AgentInfo> {
    const isInstalled = await this.checkIfInstalled();
    const config = await this.getConfig();

    return {
      id: COPILOT_ID,
      name: COPILOT_NAME,
      icon: COPILOT_ICON,
      description: COPILOT_DESCRIPTION,
      enabled: isInstalled,
      installed: isInstalled,
      version: await this.getVersion(),
      configPath: this.configPath,
      configExists: isInstalled,
    };
  }

  /**
   * Load agent configuration from file
   */
  protected async loadConfig(): Promise<void> {
    try {
      const settingsPath = path.join(this.configPath, "settings.json");

      if (!fs.existsSync(settingsPath)) {
        this.config = this.getDefaultConfig();
        return;
      }

      const { ConfigReader } = await import("../config/ConfigReader.js");
      const config = await ConfigReader.readJSON(settingsPath);

      const auth = config.auth as Record<string, unknown> | undefined;

      this.config = {
        apiKey:
          (typeof auth?.token === "string" ? auth.token : undefined) ||
          (typeof config.token === "string" ? config.token : undefined),
        apiEndpoint:
          typeof config.endpoint === "string" ? config.endpoint : "https://api.githubcopilot.com",
        model: typeof config.model === "string" ? config.model : "gpt-4",
        temperature: typeof config.temperature === "number" ? config.temperature : undefined,
        maxTokens: typeof config.maxTokens === "number" ? config.maxTokens : undefined,
        mcpServers: [],
        skills: [],
      };
    } catch (error) {
      console.error("[Copilot] Failed to load config:", error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Save agent configuration to file
   */
  protected async saveConfig(): Promise<void> {
    try {
      const settingsPath = path.join(this.configPath, "settings.json");

      // Ensure directory exists
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }

      // Read existing config
      let existingConfig: Record<string, unknown> = {};
      if (fs.existsSync(settingsPath)) {
        const { ConfigReader } = await import("../config/ConfigReader.js");
        existingConfig = (await ConfigReader.readJSON(settingsPath)) as Record<string, unknown>;
      }

      // Merge with new config
      const updatedConfig = {
        ...existingConfig,
        ...(this.config.apiKey && { auth: { token: this.config.apiKey } }),
        ...(this.config.apiEndpoint && { endpoint: this.config.apiEndpoint }),
        ...(this.config.model && { model: this.config.model }),
        ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
        ...(this.config.maxTokens !== undefined && { maxTokens: this.config.maxTokens }),
      };

      // Write config
      fs.writeFileSync(settingsPath, JSON.stringify(updatedConfig, null, 2), "utf-8");
    } catch (error) {
      console.error("[Copilot] Failed to save config:", error);
      throw error;
    }
  }

  /**
   * Start a terminal with Copilot CLI
   */
  async startTerminal(options: TerminalOptions): Promise<TerminalSession> {
    // Copilot CLI command: gh
    const command = "gh";
    const args = ["copilot", ...this.buildCopilotArgs(options)];

    return {
      id: options.terminalId || `copilot-${Date.now()}`,
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
   * Note: Copilot doesn't natively support MCPs
   */
  async listMCPs(): Promise<MCPInfo[]> {
    // Copilot doesn't have native MCP support
    // Return empty array
    return [];
  }

  /**
   * List configured Skills
   * Note: Copilot doesn't natively support Skills
   */
  async listSkills(): Promise<SkillInfo[]> {
    // Copilot doesn't have native Skills support
    return [];
  }

  /**
   * Execute a task
   */
  async executeTask(task: AgentTask): Promise<TaskResult> {
    try {
      const { execSync } = await import("node:child_process");

      const args = ["gh", "copilot"];

      switch (task.type) {
        case "prompt":
          args.push("explain", task.content);
          break;
        case "command":
          args.push(task.content);
          break;
        case "code":
          args.push("fix", task.content);
          break;
        default:
          return {
            taskId: task.id,
            success: false,
            error: `Unknown task type: ${task.type}`,
          };
      }

      const output = execSync(args.join(" "), {
        encoding: "utf-8",
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
   * Check if Copilot is installed
   */
  private async checkIfInstalled(): Promise<boolean> {
    try {
      // Check if gh CLI is installed
      const { execSync } = await import("node:child_process");
      execSync("gh --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Copilot version
   */
  private async getVersion(): Promise<string | null> {
    try {
      const { execSync } = await import("node:child_process");
      const output = execSync("gh copilot --version 2>&1 || gh --version", {
        encoding: "utf-8",
      });
      const match = output.match(/version (\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Build Copilot CLI arguments
   */
  private buildCopilotArgs(options: Record<string, unknown>): string[] {
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

    // Add prompt or subcommand
    if (options.prompt) {
      args.push("explain", String(options.prompt));
    }

    return args;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AgentConfig {
    return {
      apiEndpoint: "https://api.githubcopilot.com",
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 2000,
      mcpServers: [],
      skills: [],
    };
  }
}
