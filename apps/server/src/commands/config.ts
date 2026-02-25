/**
 * Config Management Commands
 *
 * Get, set, validate configuration
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";

const SIDE_IDE_DIR = join(homedir(), ".side-ide");
const CONFIG_FILE = join(SIDE_IDE_DIR, "config.json");

interface Config {
  port?: number;
  host?: string;
  auth?: {
    user?: string;
    password?: string;
  };
  [key: string]: unknown;
}

export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Manage configuration");

  // config get [key]
  config
    .command("get [key]")
    .description("Get configuration value (or all values if no key specified)")
    .action((key: string | undefined) => {
      if (!existsSync(CONFIG_FILE)) {
        console.log("No configuration file found.");
        console.log(`Expected at: ${CONFIG_FILE}`);
        return;
      }

      try {
        const content = readFileSync(CONFIG_FILE, "utf-8");
        const cfg: Config = JSON.parse(content);

        if (key) {
          const value = getNestedValue(cfg, key);
          if (value === undefined) {
            console.log(`Key not found: ${key}`);
            process.exit(1);
          }
          console.log(`${key} = ${JSON.stringify(value, null, 2)}`);
        } else {
          console.log("Configuration:");
          console.log(JSON.stringify(cfg, null, 2));
        }
      } catch (error) {
        console.error("Failed to read configuration:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // config set <key> <value>
  config
    .command("set <key> <value>")
    .description("Set configuration value")
    .option("--json", "Parse value as JSON")
    .action(
      (
        key: string,
        value: string,
        options: { json: boolean }
      ) => {
        let cfg: Config = {};

        // Load existing config if exists
        if (existsSync(CONFIG_FILE)) {
          try {
            const content = readFileSync(CONFIG_FILE, "utf-8");
            cfg = JSON.parse(content);
          } catch (error) {
            console.error("Failed to read existing config:", error instanceof Error ? error.message : error);
            process.exit(1);
          }
        }

        // Parse value
        let parsedValue: unknown;
        if (options.json) {
          try {
            parsedValue = JSON.parse(value);
          } catch {
            console.error("Invalid JSON value:", value);
            process.exit(1);
          }
        } else {
          // Try to infer type
          if (value === "true") parsedValue = true;
          else if (value === "false") parsedValue = false;
          else if (/^\d+$/.test(value)) parsedValue = Number.parseInt(value, 10);
          else if (/^\d+\.\d+$/.test(value)) parsedValue = Number.parseFloat(value);
          else parsedValue = value;
        }

        // Set value
        setNestedValue(cfg, key, parsedValue);

        // Save config
        try {
          writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
          console.log(`Set ${key} = ${JSON.stringify(parsedValue)}`);
        } catch (error) {
          console.error("Failed to save configuration:", error instanceof Error ? error.message : error);
          process.exit(1);
        }
      }
    );

  // config validate
  config
    .command("validate")
    .description("Validate configuration file")
    .action(() => {
      if (!existsSync(CONFIG_FILE)) {
        console.error(`Configuration file not found: ${CONFIG_FILE}`);
        process.exit(1);
      }

      try {
        const content = readFileSync(CONFIG_FILE, "utf-8");
        const cfg = JSON.parse(content);

        // Basic validation
        const errors: string[] = [];

        if (cfg.port !== undefined) {
          if (typeof cfg.port !== "number" || cfg.port < 1 || cfg.port > 65535) {
            errors.push("port must be a number between 1 and 65535");
          }
        }

        if (cfg.host !== undefined) {
          if (typeof cfg.host !== "string") {
            errors.push("host must be a string");
          }
        }

        if (errors.length > 0) {
          console.error("Configuration validation failed:");
          for (const error of errors) {
            console.error(`  - ${error}`);
          }
          process.exit(1);
        }

        console.log("Configuration is valid.");
      } catch (error) {
        console.error("Failed to validate configuration:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}
