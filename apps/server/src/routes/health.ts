/**
 * Health Check API Routes
 *
 * Provides health status endpoints for monitoring and load balancers.
 */

import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { PORT } from "../config.js";
import { getAllAgents } from "./agents.js";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  pid: number;
  version: string;
  ports: {
    http: number;
    ws: number;
  };
  database: "connected" | "disconnected" | "error";
  mcpServers: {
    running: number;
    error: number;
    stopped: number;
  };
  agents: {
    enabled: number;
    installed: number;
  };
}

interface PortStatus {
  coreDaemon: {
    port: number;
    status: "listening" | "error";
  };
  mcpServers: Array<{
    name: string;
    port: number | null;
    status: "running" | "stopped" | "error";
  }>;
  conflicts: Array<{
    port: number;
    services: string[];
  }>;
}

// Version from package.json
const VERSION = "0.1.0";

/**
 * Create health check router
 */
export function createHealthRouter(db: DatabaseSync) {
  const router = new Hono();

  /**
   * GET /api/health - Detailed health status
   */
  router.get("/", async (c) => {
    try {
      // Check database connection
      let dbStatus: HealthStatus["database"] = "connected";
      try {
        db.prepare("SELECT 1").get();
      } catch {
        dbStatus = "error";
      }

      // Get agent status
      const agents = getAllAgents();
      const installedAgents = agents.length;
      const enabledAgents = agents.filter((agent) => {
        // Check if agent is available (has valid config)
        const config = agent.getConfig?.();
        return config && (config.apiKey || config.enabled !== false);
      }).length;

      // Get MCP server status (placeholder until full MCP management is implemented)
      const mcpStatus = {
        running: agents.length,
        error: 0,
        stopped: 0,
      };

      const health: HealthStatus = {
        status: dbStatus === "connected" ? "healthy" : "degraded",
        uptime: Math.floor(process.uptime()),
        pid: process.pid,
        version: VERSION,
        ports: {
          http: PORT,
          ws: PORT,
        },
        database: dbStatus,
        mcpServers: mcpStatus,
        agents: {
          enabled: enabledAgents,
          installed: installedAgents,
        },
      };

      return c.json(health);
    } catch (error) {
      return c.json(
        {
          status: "unhealthy",
          error: error instanceof Error ? error.message : "Unknown error",
          uptime: Math.floor(process.uptime()),
          pid: process.pid,
          version: VERSION,
        },
        503
      );
    }
  });

  /**
   * GET /api/health/ports - Port usage status
   */
  router.get("/ports", (c) => {
    const agents = getAllAgents();

    const portStatus: PortStatus = {
      coreDaemon: {
        port: PORT,
        status: "listening",
      },
      mcpServers: agents.map((agent) => ({
        name: agent.id,
        port: null, // MCP servers don't use fixed ports in current implementation
        status: "running" as const,
      })),
      conflicts: [],
    };

    return c.json(portStatus);
  });

  /**
   * GET /api/health/live - Liveness probe (for Kubernetes/load balancers)
   * Simple check - if server responds, it's alive
   */
  router.get("/live", (c) => {
    return c.json({ status: "alive" });
  });

  /**
   * GET /api/health/ready - Readiness probe
   * Checks if server is ready to accept requests
   */
  router.get("/ready", async (c) => {
    try {
      // Check database is accessible
      db.prepare("SELECT 1").get();

      return c.json({
        status: "ready",
        checks: {
          database: true,
        },
      });
    } catch (error) {
      return c.json(
        {
          status: "not ready",
          checks: {
            database: false,
          },
        },
        503
      );
    }
  });

  return router;
}
