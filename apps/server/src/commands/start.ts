import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { ConfigManager } from "../utils/config-manager.js";
import { PidManager } from "../utils/pid-manager.js";

interface StartOptions {
  port?: string;
  host?: string;
  daemon?: boolean;
}

// Constants
const SIDE_IDE_DIR = join(homedir(), ".side-ide");
const PID_FILE = join(SIDE_IDE_DIR, "side-server.pid");
const LOG_FILE = join(SIDE_IDE_DIR, "logs", "server.log");
const CONFIG_FILE = join(SIDE_IDE_DIR, "config.json");

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Start the S-IDE server")
    .option("-p, --port <port>", "Port to listen on")
    .option("-h, --host <host>", "Host to bind to")
    .option("-d, --daemon", "Run as daemon (background process)")
    .action(async (options: StartOptions) => {
      const pidManager = new PidManager(PID_FILE);

      // Check if server is already running
      if (pidManager.isProcessRunning()) {
        const pid = pidManager.read();
        console.error(`Server is already running (PID: ${pid})`);
        process.exit(1);
      }

      // Load configuration
      const configManager = new ConfigManager(CONFIG_FILE);
      configManager.load();

      // Get config values
      const config = {
        port: configManager.get("port"),
        host: configManager.get("host"),
      };

      // Override with CLI options
      if (options.port) {
        config.port = Number.parseInt(options.port, 10);
      }
      if (options.host) {
        config.host = options.host;
      }

      const port = config.port;
      const host = config.host;

      if (options.daemon) {
        // Daemon mode: spawn detached process
        const __filename = fileURLToPath(import.meta.url);
        const serverIndexPath = join(__filename, "..", "..", "index.js");

        // Ensure log directory exists
        const logDir = dirname(LOG_FILE);
        if (!existsSync(logDir)) {
          mkdirSync(logDir, { recursive: true });
        }

        // Open log file for stdout/stderr
        const logFd = openSync(LOG_FILE, "a");

        const child = spawn(process.execPath, [serverIndexPath, `--port=${port}`], {
          detached: true,
          stdio: ["ignore", logFd, logFd],
          env: {
            ...process.env,
            PORT: port.toString(),
            HOST: host,
          },
        });

        // Write PID file
        pidManager.write(child.pid!);

        // Detach from parent
        child.unref();

        console.log(`Server started in daemon mode (PID: ${child.pid})`);
        console.log(`Port: ${port}`);
        console.log(`Host: ${host}`);
        console.log(`Logs: ${LOG_FILE}`);
        console.log(`PID file: ${PID_FILE}`);
      } else {
        // Foreground mode: start server directly
        pidManager.write(process.pid);

        // Setup cleanup handlers
        const cleanup = () => {
          console.log("\nShutting down server...");
          pidManager.remove();
          process.exit(0);
        };

        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);

        console.log(`Starting server...`);
        console.log(`Port: ${port}`);
        console.log(`Host: ${host}`);
        console.log(`PID: ${process.pid}`);

        // Import and start server
        const { startServer } = await import("../server.js");
        await startServer({ port, host });
      }
    });
}
