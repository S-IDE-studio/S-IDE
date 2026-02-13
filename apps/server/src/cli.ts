#!/usr/bin/env node

/**
 * S-IDE Server CLI
 *
 * Command-line interface for managing the S-IDE server
 */

import fs from "node:fs";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { createServer } from "./server.js";

export const program = new Command();

// Version from package.json
const packageJson = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8")
);

program
  .name("side-server")
  .description("S-IDE Server - AI-optimized development environment backend")
  .version(packageJson.version);

/**
 * Get the S-IDE configuration directory
 */
function getConfigDir(): string {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, ".side-ide");

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  return configDir;
}

/**
 * Get the PID file path
 */
function getPidFile(): string {
  return path.join(getConfigDir(), "side-server.pid");
}

/**
 * Get the log directory
 */
function getLogDir(): string {
  const logDir = path.join(getConfigDir(), "logs");

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return logDir;
}

/**
 * Get the config file path
 */
function getConfigFile(): string {
  return path.join(getConfigDir(), "config.json");
}

/**
 * Load configuration from file
 */
function loadConfig(): Record<string, unknown> {
  const configFile = getConfigFile();

  if (fs.existsSync(configFile)) {
    try {
      const content = fs.readFileSync(configFile, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Failed to load config from ${configFile}:`, error);
    }
  }

  return {};
}

/**
 * Save configuration to file
 */
function saveConfig(config: Record<string, unknown>): void {
  const configFile = getConfigFile();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Check if server is running
 */
function isServerRunning(): { running: boolean; pid?: number } {
  const pidFile = getPidFile();

  if (!fs.existsSync(pidFile)) {
    return { running: false };
  }

  try {
    const pidStr = fs.readFileSync(pidFile, "utf-8").trim();
    const pid = Number.parseInt(pidStr, 10);

    if (Number.isNaN(pid)) {
      return { running: false };
    }

    // Check if process exists
    try {
      process.kill(pid, 0); // Signal 0 just checks if process exists
      return { running: true, pid };
    } catch (error) {
      // Process doesn't exist, clean up stale PID file
      fs.unlinkSync(pidFile);
      return { running: false };
    }
  } catch (error) {
    return { running: false };
  }
}

/**
 * Write PID file
 */
function writePidFile(pid: number): void {
  const pidFile = getPidFile();
  fs.writeFileSync(pidFile, pid.toString(), "utf-8");
}

/**
 * Remove PID file
 */
function removePidFile(): void {
  const pidFile = getPidFile();
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
}

/**
 * Setup graceful shutdown
 */
function setupGracefulShutdown(server: Server): void {
  const shutdown = () => {
    console.log("\nShutting down gracefully...");

    server.close(() => {
      console.log("Server closed");
      removePidFile();
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      removePidFile();
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

/**
 * Start command
 */
program
  .command("start")
  .description("Start the S-IDE server")
  .option("-p, --port <port>", "Port to listen on", "8787")
  .option("-h, --host <host>", "Host to bind to", "0.0.0.0")
  .option("-d, --daemon", "Run as daemon (background process)")
  .action(async (options) => {
    const { running, pid } = isServerRunning();

    if (running) {
      console.log(`Server is already running (PID: ${pid})`);
      process.exit(1);
    }

    // Load config and merge with options
    const config = loadConfig();
    const port = Number.parseInt(options.port || config.port || "8787", 10);
    const host = options.host || config.host || "0.0.0.0";

    if (options.daemon) {
      // Fork process for daemon mode
      const { spawn } = await import("node:child_process");
      const logDir = getLogDir();
      const logFile = path.join(logDir, `server-${Date.now()}.log`);

      const child = spawn(
        process.argv[0],
        [process.argv[1], "start", "--port", port.toString(), "--host", host],
        {
          detached: true,
          stdio: ["ignore", fs.openSync(logFile, "a"), fs.openSync(logFile, "a")],
        }
      );

      child.unref();

      console.log(`Server started in daemon mode (PID: ${child.pid})`);
      console.log(`Logs: ${logFile}`);

      writePidFile(child.pid!);
      process.exit(0);
    } else {
      // Run in foreground
      console.log(`Starting S-IDE server on ${host}:${port}...`);

      try {
        const server = await createServer(port);
        writePidFile(process.pid);
        setupGracefulShutdown(server);

        console.log(`✓ Server is running on http://${host}:${port}`);
        console.log(`  PID: ${process.pid}`);
        console.log(`  Press Ctrl+C to stop`);
      } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
      }
    }
  });

/**
 * Stop command
 */
program
  .command("stop")
  .description("Stop the S-IDE server")
  .action(() => {
    const { running, pid } = isServerRunning();

    if (!running) {
      console.log("Server is not running");
      process.exit(0);
    }

    console.log(`Stopping server (PID: ${pid})...`);

    try {
      process.kill(pid!, "SIGTERM");

      // Wait for process to exit
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds

      const checkInterval = setInterval(() => {
        attempts++;

        try {
          process.kill(pid!, 0);

          if (attempts >= maxAttempts) {
            console.log("Server didn't stop gracefully, forcing...");
            process.kill(pid!, "SIGKILL");
            clearInterval(checkInterval);
            removePidFile();
            console.log("✓ Server stopped (forced)");
          }
        } catch {
          // Process is dead
          clearInterval(checkInterval);
          removePidFile();
          console.log("✓ Server stopped");
        }
      }, 100);
    } catch (error) {
      console.error("Failed to stop server:", error);
      removePidFile();
      process.exit(1);
    }
  });

/**
 * Status command
 */
program
  .command("status")
  .description("Show server status")
  .action(async () => {
    const { running, pid } = isServerRunning();

    if (!running) {
      console.log("Status: Stopped");
      process.exit(0);
    }

    console.log("Status: Running");
    console.log(`PID: ${pid}`);

    // Try to get more info from the server
    const config = loadConfig();
    const port = config.port || 8787;

    try {
      const response = await fetch(`http://localhost:${port}/health`, {
        signal: AbortSignal.timeout(2000),
      });

      if (response.ok) {
        const data = (await response.json()) as { uptime?: number };
        console.log(`Port: ${port}`);
        if (data.uptime) {
          console.log(`Uptime: ${Math.floor(data.uptime)}s`);
        }
      }
    } catch (error) {
      console.log(`Port: ${port} (not responding)`);
    }
  });

/**
 * Config command
 */
const configCmd = program.command("config").description("Manage server configuration");

configCmd
  .command("list")
  .description("List all configuration")
  .action(() => {
    const config = loadConfig();

    if (Object.keys(config).length === 0) {
      console.log("No configuration set");
    } else {
      console.log(JSON.stringify(config, null, 2));
    }
  });

configCmd
  .command("get <key>")
  .description("Get a configuration value")
  .action((key: string) => {
    const config = loadConfig();
    const value = config[key];

    if (value === undefined) {
      console.log(`Configuration key "${key}" not found`);
      process.exit(1);
    }

    console.log(value);
  });

configCmd
  .command("set <key> <value>")
  .description("Set a configuration value")
  .action((key: string, value: string) => {
    const config = loadConfig();

    // Try to parse as number or boolean
    let parsedValue: string | number | boolean = value;
    if (value === "true") {
      parsedValue = true;
    } else if (value === "false") {
      parsedValue = false;
    } else if (
      value.trim() !== "" &&
      !Number.isNaN(Number(value)) &&
      Number.isFinite(Number(value))
    ) {
      parsedValue = Number(value);
    }

    config[key] = parsedValue;
    saveConfig(config);

    console.log(`✓ Set ${key} = ${parsedValue}`);
  });

configCmd
  .command("unset <key>")
  .description("Remove a configuration value")
  .action((key: string) => {
    const config = loadConfig();

    if (config[key] === undefined) {
      console.log(`Configuration key "${key}" not found`);
      process.exit(1);
    }

    delete config[key];
    saveConfig(config);

    console.log(`✓ Unset ${key}`);
  });

// Parse arguments
program.parse();
