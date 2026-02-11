import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";

export interface ServerConfig {
  port: number;
  host: string;
  defaultRoot?: string;
  maxFileSize?: number;
  terminalBufferLimit?: number;
  basicAuthUser?: string;
  basicAuthPassword?: string;
  corsOrigin?: string;
}

export const DEFAULT_CONFIG: ServerConfig = {
  port: 8787,
  host: "0.0.0.0",
  defaultRoot: homedir(),
  maxFileSize: 10485760, // 10MB
  terminalBufferLimit: 50000,
};

export class ConfigManager {
  private config: ServerConfig;
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Load configuration from file and merge with environment variables.
   * Environment variables have highest priority.
   */
  load(): void {
    // Load from file if exists
    if (existsSync(this.configPath)) {
      try {
        const fileContent = readFileSync(this.configPath, "utf-8");
        const fileConfig = JSON.parse(fileContent) as Partial<ServerConfig>;
        this.config = { ...DEFAULT_CONFIG, ...fileConfig };
      } catch (error) {
        console.error(`[ConfigManager] Failed to load config from ${this.configPath}:`, error);
        this.config = { ...DEFAULT_CONFIG };
      }
    }

    // Merge environment variables (highest priority)
    if (process.env.PORT && process.env.PORT.trim()) {
      const port = Number(process.env.PORT.trim());
      if (!Number.isNaN(port) && port >= 1 && port <= 65535) {
        this.config.port = port;
      }
    }

    if (process.env.HOST && process.env.HOST.trim()) {
      this.config.host = process.env.HOST.trim();
    }

    if (process.env.DEFAULT_ROOT && process.env.DEFAULT_ROOT.trim()) {
      this.config.defaultRoot = process.env.DEFAULT_ROOT.trim();
    }

    if (process.env.MAX_FILE_SIZE && process.env.MAX_FILE_SIZE.trim()) {
      const maxFileSize = Number(process.env.MAX_FILE_SIZE.trim());
      if (!Number.isNaN(maxFileSize) && maxFileSize > 0) {
        this.config.maxFileSize = maxFileSize;
      }
    }

    if (process.env.TERMINAL_BUFFER_LIMIT && process.env.TERMINAL_BUFFER_LIMIT.trim()) {
      const terminalBufferLimit = Number(process.env.TERMINAL_BUFFER_LIMIT.trim());
      if (!Number.isNaN(terminalBufferLimit) && terminalBufferLimit > 0) {
        this.config.terminalBufferLimit = terminalBufferLimit;
      }
    }

    if (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_USER.trim()) {
      this.config.basicAuthUser = process.env.BASIC_AUTH_USER.trim();
    }

    if (process.env.BASIC_AUTH_PASSWORD && process.env.BASIC_AUTH_PASSWORD.trim()) {
      this.config.basicAuthPassword = process.env.BASIC_AUTH_PASSWORD.trim();
    }

    if (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.trim()) {
      this.config.corsOrigin = process.env.CORS_ORIGIN.trim();
    }
  }

  /**
   * Save configuration to JSON file.
   * Creates directory if it doesn't exist.
   */
  save(): void {
    try {
      const dir = dirname(this.configPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const content = JSON.stringify(this.config, null, 2);
      writeFileSync(this.configPath, content, "utf-8");
    } catch (error) {
      console.error(`[ConfigManager] Failed to save config to ${this.configPath}:`, error);
      // Don't throw - be resilient like load()
    }
  }

  /**
   * Get a configuration value by key.
   */
  get<K extends keyof ServerConfig>(key: K): ServerConfig[K] {
    return this.config[key];
  }

  /**
   * Set a configuration value by key.
   */
  set<K extends keyof ServerConfig>(key: K, value: ServerConfig[K]): void {
    this.config[key] = value;
  }

  /**
   * Get a copy of the entire configuration.
   */
  list(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Get the configuration file path.
   */
  getPath(): string {
    return this.configPath;
  }
}
