/**
 * MCP Server Management API Routes
 *
 * Provides endpoints for managing MCP (Model Context Protocol) servers.
 * These servers provide additional tools and capabilities to agents.
 */

import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import { handleError, createHttpError } from "../utils/error.js";

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  id: string;
  name: string;
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  agentId?: string;
  createdAt: string;
  status?: "active" | "inactive" | "error";
  tools?: MCPTool[];
}

/**
 * MCP Tool information
 */
export interface MCPTool {
  name: string;
  enabled: boolean;
  description?: string;
}

/**
 * Create MCP server router
 */
export function createMCPServerRouter(db: DatabaseSync) {
  const router = new Hono();

  /**
   * GET /api/mcp/servers - List all MCP servers
   */
  router.get("/servers", async (c) => {
    try {
      const agentId = c.req.query("agentId");

      let query = "SELECT * FROM mcp_servers";
      const params: string[] = [];

      if (agentId) {
        query += " WHERE agent_id = ? OR agent_id IS NULL";
        params.push(agentId);
      }

      query += " ORDER BY created_at DESC";

      const stmt = db.prepare(query);
      const rows = params.length > 0 ? stmt.all(...params) : stmt.all();

      const servers = (rows as unknown[]).map((row: any) => {
        const server: MCPServerConfig = {
          id: row.id,
          name: row.name,
          type: row.type,
          command: row.command || undefined,
          args: row.args ? JSON.parse(row.args) : undefined,
          url: row.url || undefined,
          env: row.env ? JSON.parse(row.env) : undefined,
          enabled: Boolean(row.enabled),
          agentId: row.agent_id || undefined,
          createdAt: row.created_at,
          status: row.enabled ? "active" : "inactive",
        };

        // Get tools for this server
        const toolsStmt = db.prepare("SELECT tool_name, enabled FROM mcp_tool_states WHERE server_id = ?");
        const toolRows = toolsStmt.all(row.id) as unknown[];
        server.tools = toolRows.map((t: any) => ({
          name: t.tool_name,
          enabled: Boolean(t.enabled),
        }));

        return server;
      });

      return c.json({ servers });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/mcp/servers/:id - Get a specific MCP server
   */
  router.get("/servers/:id", async (c) => {
    try {
      const id = c.req.param("id");

      const stmt = db.prepare("SELECT * FROM mcp_servers WHERE id = ?");
      const row = stmt.get(id) as any;

      if (!row) {
        throw createHttpError("MCP server not found", 404);
      }

      const server: MCPServerConfig = {
        id: row.id,
        name: row.name,
        type: row.type,
        command: row.command || undefined,
        args: row.args ? JSON.parse(row.args) : undefined,
        url: row.url || undefined,
        env: row.env ? JSON.parse(row.env) : undefined,
        enabled: Boolean(row.enabled),
        agentId: row.agent_id || undefined,
        createdAt: row.created_at,
        status: row.enabled ? "active" : "inactive",
      };

      // Get tools
      const toolsStmt = db.prepare("SELECT tool_name, enabled FROM mcp_tool_states WHERE server_id = ?");
      const toolRows = toolsStmt.all(row.id) as unknown[];
      server.tools = toolRows.map((t: any) => ({
        name: t.tool_name,
        enabled: Boolean(t.enabled),
      }));

      return c.json(server);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/mcp/servers - Create a new MCP server
   */
  router.post("/servers", async (c) => {
    try {
      const body = (await c.req.json()) as Partial<MCPServerConfig>;

      // Validate required fields
      if (!body.name || !body.type) {
        throw createHttpError("Name and type are required", 400);
      }

      if (body.type === "stdio" && !body.command) {
        throw createHttpError("Command is required for stdio servers", 400);
      }

      if (body.type === "sse" && !body.url) {
        throw createHttpError("URL is required for SSE servers", 400);
      }

      const id = body.id || crypto.randomUUID();
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO mcp_servers (id, name, type, command, args, url, env, enabled, agent_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        body.name,
        body.type,
        body.command || null,
        body.args ? JSON.stringify(body.args) : null,
        body.url || null,
        body.env ? JSON.stringify(body.env) : null,
        body.enabled !== false ? 1 : 0,
        body.agentId || null,
        now
      );

      const server: MCPServerConfig = {
        id,
        name: body.name,
        type: body.type,
        command: body.command,
        args: body.args,
        url: body.url,
        env: body.env,
        enabled: body.enabled !== false,
        agentId: body.agentId,
        createdAt: now,
        status: body.enabled !== false ? "active" : "inactive",
        tools: [],
      };

      return c.json(server, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * DELETE /api/mcp/servers/:id - Delete an MCP server
   */
  router.delete("/servers/:id", async (c) => {
    try {
      const id = c.req.param("id");

      const stmt = db.prepare("DELETE FROM mcp_servers WHERE id = ?");
      const result = stmt.run(id);

      if (result.changes === 0) {
        throw createHttpError("MCP server not found", 404);
      }

      return c.json({ success: true });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/mcp/servers/:id/toggle - Toggle MCP server enabled state
   */
  router.post("/servers/:id/toggle", async (c) => {
    try {
      const id = c.req.param("id");

      // Get current state
      const getStmt = db.prepare("SELECT enabled FROM mcp_servers WHERE id = ?");
      const row = getStmt.get(id) as { enabled: number } | undefined;

      if (!row) {
        throw createHttpError("MCP server not found", 404);
      }

      const newEnabled = row.enabled ? 0 : 1;

      // Toggle state
      const updateStmt = db.prepare("UPDATE mcp_servers SET enabled = ? WHERE id = ?");
      updateStmt.run(newEnabled, id);

      return c.json({ success: true, enabled: Boolean(newEnabled) });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/mcp/servers/:id/restart - Restart an MCP server
   */
  router.post("/servers/:id/restart", async (c) => {
    try {
      const id = c.req.param("id");

      // Check if server exists
      const stmt = db.prepare("SELECT id FROM mcp_servers WHERE id = ?");
      const row = stmt.get(id);

      if (!row) {
        throw createHttpError("MCP server not found", 404);
      }

      // TODO: Implement actual process restart logic
      // For now, just return success
      return c.json({ success: true, message: "Server restart requested" });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/mcp/servers/:id/tools - Get tools for an MCP server
   */
  router.get("/servers/:id/tools", async (c) => {
    try {
      const id = c.req.param("id");

      // Check if server exists
      const serverStmt = db.prepare("SELECT id FROM mcp_servers WHERE id = ?");
      const serverRow = serverStmt.get(id);

      if (!serverRow) {
        throw createHttpError("MCP server not found", 404);
      }

      // Get tools
      const toolsStmt = db.prepare("SELECT tool_name, enabled FROM mcp_tool_states WHERE server_id = ?");
      const toolRows = toolsStmt.all(id) as unknown[];
      
      const tools = toolRows.map((t: any) => ({
        name: t.tool_name,
        enabled: Boolean(t.enabled),
      }));

      return c.json({ tools });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/mcp/servers/:id/tools/:name/toggle - Toggle tool enabled state
   */
  router.post("/servers/:id/tools/:name/toggle", async (c) => {
    try {
      const id = c.req.param("id");
      const toolName = c.req.param("name");

      // Check if server exists
      const serverStmt = db.prepare("SELECT id FROM mcp_servers WHERE id = ?");
      const serverRow = serverStmt.get(id);

      if (!serverRow) {
        throw createHttpError("MCP server not found", 404);
      }

      // Get current tool state
      const getStmt = db.prepare("SELECT enabled FROM mcp_tool_states WHERE server_id = ? AND tool_name = ?");
      const toolRow = getStmt.get(id, toolName) as { enabled: number } | undefined;

      if (!toolRow) {
        // Tool doesn't exist, create it as enabled
        const insertStmt = db.prepare(
          "INSERT INTO mcp_tool_states (server_id, tool_name, enabled) VALUES (?, ?, 1)"
        );
        insertStmt.run(id, toolName);
        return c.json({ success: true, enabled: true });
      }

      // Toggle state
      const newEnabled = toolRow.enabled ? 0 : 1;
      const updateStmt = db.prepare(
        "UPDATE mcp_tool_states SET enabled = ? WHERE server_id = ? AND tool_name = ?"
      );
      updateStmt.run(newEnabled, id, toolName);

      return c.json({ success: true, enabled: Boolean(newEnabled) });
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}
