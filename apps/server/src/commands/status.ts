/**
 * Status Command
 *
 * Check daemon status (port, PID, uptime)
 */

import type { Command } from "commander";
import { PidManager } from "../utils/pid-manager.js";

const SIDE_IDE_DIR = `${process.env.HOME || process.env.USERPROFILE}/.side-ide`;
const PID_FILE = `${SIDE_IDE_DIR}/side-server.pid`;

interface StatusResponse {
  status: string;
  uptime?: number;
  pid?: number;
  version?: string;
  ports?: { http: number; ws: number };
  database?: string;
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Check daemon status")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (options: { port: string; host: string }) => {
      const pidManager = new PidManager(PID_FILE);
      const pid = pidManager.read();
      const isRunning = pidManager.isProcessRunning();

      if (!isRunning) {
        console.log("Daemon Status: Not running");
        console.log(`PID File: ${PID_FILE} (${pid ? `stale PID: ${pid}` : "not found"})`);
        process.exit(1);
      }

      // Try to fetch detailed status from API
      try {
        const response = await fetch(`http://${options.host}:${options.port}/api/health`);
        if (response.ok) {
          const data = (await response.json()) as StatusResponse;
          console.log("Daemon Status: Running");
          console.log(`  PID: ${data.pid || pid}`);
          console.log(`  Uptime: ${formatUptime(data.uptime || 0)}`);
          console.log(`  Version: ${data.version || "unknown"}`);
          console.log(`  HTTP Port: ${data.ports?.http || options.port}`);
          console.log(`  WebSocket Port: ${data.ports?.ws || options.port}`);
          console.log(`  Database: ${data.database || "unknown"}`);
        } else {
          console.log("Daemon Status: Running (API unavailable)");
          console.log(`  PID: ${pid}`);
        }
      } catch {
        console.log("Daemon Status: Running (API unavailable)");
        console.log(`  PID: ${pid}`);
      }
    });
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}
