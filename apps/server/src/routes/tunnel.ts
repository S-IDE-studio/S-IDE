/**
 * Tunnel Management API Routes
 *
 * REST API endpoints for managing remote access tunnels.
 * Note: Tunnel management is primarily handled by Tauri desktop app.
 * This route provides status and configuration information.
 */

import { Hono } from "hono";
import { handleError } from "../utils/error.js";

/**
 * Tunnel status information
 */
interface TunnelStatus {
  running: boolean;
  url?: string;
  password?: string;
  startedAt?: string;
  connections?: number;
}

/**
 * In-memory tunnel state (shared across requests)
 */
let tunnelState: TunnelStatus = {
  running: false,
};

/**
 * Create tunnel router
 */
export function createTunnelRouter() {
  const router = new Hono();

  /**
   * GET /api/tunnel/status - Get current tunnel status
   */
  router.get("/status", async (c) => {
    try {
      return c.json(tunnelState);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/tunnel/start - Start tunnel (placeholder)
   * Note: Actual tunnel management is handled by Tauri
   */
  router.post("/start", async (c) => {
    try {
      const body = (await c.req.json()) as { port?: number };
      const port = body?.port || 8787;

      // Update state (in real implementation, this would start the tunnel)
      tunnelState = {
        running: true,
        url: `https://random-id.localtunnel.me`, // Placeholder URL
        password: generateRandomPassword(),
        startedAt: new Date().toISOString(),
        connections: 0,
      };

      return c.json({
        success: true,
        message: "Tunnel started",
        ...tunnelState,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/tunnel/stop - Stop tunnel (placeholder)
   * Note: Actual tunnel management is handled by Tauri
   */
  router.post("/stop", async (c) => {
    try {
      tunnelState = {
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
      // Return placeholder logs
      return c.json({
        logs: [
          `[${new Date().toISOString()}] Tunnel system ready`,
          "Note: Tunnel logs are only available in desktop app",
        ],
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
