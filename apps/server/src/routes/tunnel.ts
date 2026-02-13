/**
 * Tunnel Management API Routes
 *
 * REST API endpoints for managing remote access tunnels.
 * Uses localtunnel for creating public HTTPS URLs to local servers.
 */

import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import type { Tunnel } from "localtunnel";
import localtunnel from "localtunnel";
import { createHttpError, handleError } from "../utils/error.js";

/**
 * Tunnel status information
 */
interface TunnelStatus {
  running: boolean;
  url?: string;
  password?: string;
  startedAt?: string;
  connections?: number;
  port?: number;
  type?: string;
}

/**
 * Tunnel log entry
 */
interface TunnelLog {
  timestamp: string;
  level: "info" | "error" | "warning";
  message: string;
}

/**
 * Active tunnel state
 */
let activeTunnel: Tunnel | null = null;
let tunnelStatus: TunnelStatus = {
  running: false,
};
let tunnelLogs: TunnelLog[] = [];

/**
 * Add a log entry
 */
function addLog(level: "info" | "error" | "warning", message: string): void {
  const log: TunnelLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  tunnelLogs.push(log);

  // Keep only last 100 logs
  if (tunnelLogs.length > 100) {
    tunnelLogs = tunnelLogs.slice(-100);
  }

  console.log(`[TUNNEL] [${level.toUpperCase()}] ${message}`);
}

/**
 * Start localtunnel
 */
async function startLocaltunnel(port: number, subdomain?: string): Promise<Tunnel> {
  addLog("info", `Starting localtunnel on port ${port}...`);

  try {
    const tunnel = await localtunnel({
      port,
      subdomain,
    });

    // Handle tunnel events
    tunnel.on("close", () => {
      addLog("warning", "Tunnel closed");
      if (activeTunnel === tunnel) {
        activeTunnel = null;
        tunnelStatus.running = false;
      }
    });

    tunnel.on("error", (err: Error) => {
      addLog("error", `Tunnel error: ${err.message}`);
    });

    addLog("info", `Tunnel established: ${tunnel.url}`);
    return tunnel;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addLog("error", `Failed to start tunnel: ${message}`);
    throw error;
  }
}

/**
 * Create tunnel router
 */
export function createTunnelRouter(db?: DatabaseSync) {
  const router = new Hono();

  /**
   * GET /api/tunnel/status - Get current tunnel status
   */
  router.get("/status", async (c) => {
    try {
      return c.json(tunnelStatus);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/tunnel/start - Start tunnel
   */
  router.post("/start", async (c) => {
    try {
      if (activeTunnel) {
        throw createHttpError("Tunnel is already running", 400);
      }

      const body = (await c.req.json()) as { port?: number; subdomain?: string };
      const port = body?.port || 8787;
      const subdomain = body?.subdomain;

      // Validate port
      if (port < 1 || port > 65535) {
        throw createHttpError("Invalid port number", 400);
      }

      // Start the tunnel
      const tunnel = await startLocaltunnel(port, subdomain);
      activeTunnel = tunnel;

      const password = generateRandomPassword();

      tunnelStatus = {
        running: true,
        url: tunnel.url,
        password,
        startedAt: new Date().toISOString(),
        connections: 0,
        port,
        type: "localtunnel",
      };

      // Save to database if available
      if (db) {
        const id = crypto.randomUUID();
        const stmt = db.prepare(`
          INSERT INTO tunnel_configs (id, type, port, auto_start, settings, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          id,
          "localtunnel",
          port,
          0,
          JSON.stringify({ subdomain }),
          new Date().toISOString()
        );
      }

      return c.json({
        success: true,
        message: "Tunnel started",
        ...tunnelStatus,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/tunnel/stop - Stop tunnel
   */
  router.post("/stop", async (c) => {
    try {
      if (!activeTunnel) {
        throw createHttpError("No tunnel is running", 400);
      }

      addLog("info", "Stopping tunnel...");

      activeTunnel.close();
      activeTunnel = null;

      tunnelStatus = {
        running: false,
      };

      return c.json({
        success: true,
        message: "Tunnel stopped",
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/tunnel/logs - Get tunnel logs
   */
  router.get("/logs", async (c) => {
    try {
      return c.json({
        logs: tunnelLogs.map(
          (log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
        ),
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/tunnel/tailscale/status - Get Tailscale status (placeholder)
   */
  router.get("/tailscale/status", async (c) => {
    try {
      // This would integrate with Tailscale CLI
      // For now, return a placeholder
      return c.json({
        installed: false,
        status: "not_available",
        message: "Tailscale integration requires CLI tools",
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}

/**
 * Generate a random password for tunnel access
 */
function generateRandomPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
