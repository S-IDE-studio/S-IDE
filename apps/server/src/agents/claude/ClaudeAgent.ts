/**
 * Claude Code Agent Adapter
 *
 * Adapter for Claude Code CLI agent.
 * Wraps the existing Context Manager functionality.
 */

import os from "node:os";
import path from "node:path";
import { BaseAgent } from "../base/BaseAgent.js";
import type {
  AgentConfig,
  AgentInfo,
  AgentTask,
  Context,
  ContextOptions,
  MCPConfig,
  MCPInfo,
  SkillConfig,
  SkillInfo,
  TaskResult,
  TerminalOptions,
  TerminalSession,
} from "../types.js";

/**
 * Claude Code Agent Adapter
 *
 * Implements AgentInterface for Claude Code by wrapping the existing
 * Context Manager and providing terminal launch functionality.
 */
export class ClaudeAgent extends BaseAgent {
  private contextController: unknown | null = null;
  private sessionStore: unknown | null = null;

  constructor() {
    super(
      "claude",
      "Claude Code",
      "/icons/agents/claude.svg",
      "Anthropic's Claude Code CLI - Advanced AI coding assistant"
    );
    // Override config path for Claude
    this.configPath = path.join(os.homedir(), ".claude");
  }

  // ==================== Lifecycle ====================

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await super.initialize();

    // Initialize Context Controller
    try {
      const contextManagerPath = path.join(process.cwd(), ".claude", "context-manager");
      const fs = await import("node:fs/promises");

      // Check if context-manager exists before importing
      try {
        await fs.access(contextManagerPath);
      } catch {
        throw new Error("Context Manager not found");
      }

      // Context Manager is optional - use dynamic import
      // @ts-expect-error - Context Manager may not have type declarations
      const contextManagerModule = await import("../../../../.claude/context-manager/index.js");
      const {
        SessionStore: Store,
        SessionMonitor,
        SessionAnalyzer,
        ContextController,
      } = contextManagerModule;

      this.sessionStore = new Store();
      const monitor = new SessionMonitor();
      const analyzer = new SessionAnalyzer();

      this.contextController = new ContextController(this.sessionStore, monitor, analyzer);
    } catch {
      // Context Manager not available - continue without it
      console.warn("[Claude] Context Manager not available");
    }
  }

  async dispose(): Promise<void> {
    this.contextController = null;
    this.sessionStore = null;
    await super.dispose();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const fs = await import("node:fs/promises");
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== Terminal Operations ====================

  async startTerminal(options: TerminalOptions): Promise<TerminalSession> {
    // Claude Code CLI command: claude
    const command = "claude";
    const args = this.buildClaudeArgs(options);

    return {
      id: options.terminalId || `claude-${Date.now()}`,
      command,
      args,
      cwd: options.cwd,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
    };
  }

  // ==================== Context Management ====================

  async createContext(options: ContextOptions): Promise<Context> {
    // Try to use Context Controller if available
    if (this.contextController) {
      try {
        const snapshotId = await (this.contextController as any).createSnapshot({
          files: (options.metadata?.files as string[]) || [],
          prompt: options.initialPrompt || "",
        });

        return {
          id: snapshotId,
          agentId: this.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: options.metadata || {},
          messageCount: 0,
        };
      } catch {
        // Fall back to base implementation
      }
    }

    return super.createContext(options);
  }

  async getContext(contextId: string): Promise<Context | null> {
    // Try to use Context Controller if available
    if (this.contextController) {
      try {
        const snapshot = await (this.contextController as any).getSnapshot(contextId);
        if (snapshot) {
          return {
            id: snapshot.id,
            agentId: this.id,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.updatedAt,
            metadata: snapshot.metadata || {},
            messageCount: snapshot.messageCount || 0,
          };
        }
      } catch {
        // Fall back to base implementation
      }
    }

    return super.getContext(contextId);
  }

  // ==================== Config Management ====================

  /**
   * Load agent configuration from file
   */
  protected async loadConfig(): Promise<void> {
    try {
      const fs = await import("node:fs/promises");
      const settingsPath = path.join(this.configPath, "settings.json");

      try {
        await fs.access(settingsPath);
      } catch {
        this.config = this.getDefaultConfig();
        return;
      }

      const { ConfigReader } = await import("../config/ConfigReader.js");
      const config = await ConfigReader.readJSON(settingsPath);

      this.config = {
        apiKey: typeof config.apiKey === "string" ? config.apiKey : undefined,
        apiEndpoint: typeof config.apiEndpoint === "string" ? config.apiEndpoint : undefined,
        model: typeof config.model === "string" ? config.model : undefined,
        temperature: typeof config.temperature === "number" ? config.temperature : undefined,
        maxTokens: typeof config.maxTokens === "number" ? config.maxTokens : undefined,
        mcpServers: Array.isArray(config.mcpServers) ? (config.mcpServers as MCPConfig[]) : [],
        skills: Array.isArray(config.skills) ? (config.skills as SkillConfig[]) : [],
      };
    } catch (error) {
      console.error("[Claude] Failed to load config:", error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Save agent configuration to file
   */
  protected async saveConfig(): Promise<void> {
    try {
      const fs = await import("node:fs/promises");
      const settingsPath = path.join(this.configPath, "settings.json");

      // Ensure directory exists
      try {
        await fs.mkdir(this.configPath, { recursive: true });
      } catch {
        // Directory may already exist
      }

      // Write config
      await fs.writeFile(settingsPath, JSON.stringify(this.config, null, 2), "utf-8");
    } catch (error) {
      console.error("[Claude] Failed to save config:", error);
      throw error;
    }
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
      configPath: this.configPath,
      configExists: isInstalled,
    };
  }

  /**
   * List configured MCPs
   */
  async listMCPs(): Promise<MCPInfo[]> {
    try {
      const fs = await import("node:fs/promises");
      const mcpServersPath = path.join(this.configPath, "mcp_servers.json");

      try {
        await fs.access(mcpServersPath);
      } catch {
        return [];
      }

      const { ConfigReader } = await import("../config/ConfigReader.js");
      const mcpsData = await ConfigReader.readJSON(mcpServersPath);
      const mcps = Array.isArray(mcpsData)
        ? (mcpsData as Array<{
            id: string;
            name: string;
            command: string;
            args?: string[];
            env?: Record<string, string>;
            disabled?: boolean;
          }>)
        : [];

      return mcps.map((mcp) => ({
        ...mcp,
        enabled: !mcp.disabled,
        status: mcp.disabled ? "inactive" : "active",
      }));
    } catch (error) {
      console.error("[Claude] Failed to list MCPs:", error);
      return [];
    }
  }

  /**
   * List configured Skills
   */
  async listSkills(): Promise<SkillInfo[]> {
    try {
      const fs = await import("node:fs/promises");

      const skillsPath = path.join(this.configPath, "skills.json");

      try {
        await fs.access(skillsPath);
      } catch {
        return [];
      }

      const { ConfigReader } = await import("../config/ConfigReader.js");
      const skillsData = await ConfigReader.readJSON(skillsPath);
      const skills = Array.isArray(skillsData)
        ? (skillsData as Array<{
            id: string;
            name: string;
            description?: string;
            enabled?: boolean;
            config?: Record<string, unknown>;
          }>)
        : [];

      return skills.map((skill) => ({
        ...skill,
        enabled: skill.enabled !== false,
        status: skill.enabled !== false ? "active" : "inactive",
      }));
    } catch (error) {
      console.error("[Claude] Failed to list Skills:", error);
      return [];
    }
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

      const args: string[] = ["claude"];

      switch (task.type) {
        case "prompt":
          args.push("--prompt", task.content);
          break;
        case "command":
          args.push("run", "--", task.content);
          break;
        case "code":
          args.push("code", "--", task.content);
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
   * Check if Claude is installed
   */
  private async checkIfInstalled(): Promise<boolean> {
    try {
      const { execSync } = await import("node:child_process");
      execSync("claude --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Claude version
   */
  private async getVersion(): Promise<string | null> {
    try {
      const { execSync } = await import("node:child_process");
      const output = execSync("claude --version", { encoding: "utf-8" });
      const match = output.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Build Claude CLI arguments
   */
  private buildClaudeArgs(options: Record<string, unknown>): string[] {
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
      model: "claude-sonnet-4-20250514",
      temperature: 0.7,
      maxTokens: 8192,
      mcpServers: [],
      skills: [],
    };
  }
}
