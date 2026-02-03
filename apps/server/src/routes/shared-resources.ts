/**
 * Shared Resources API Routes
 *
 * API endpoints for managing shared MCPs and Skills across agents.
 */

import { Hono } from "hono";
import type { AgentId } from "../types.js";
import type { SharedMCPConfig, SharedSkillConfig } from "../mcp/server.js";
import { getMCPServer } from "../mcp/server.js";

const app = new Hono();

/**
 * List all shared MCPs
 */
app.get("/mcps", (c) => {
  const mcpServer = getMCPServer();
  const mcps = mcpServer.listSharedMCPs();
  return c.json({ mcps });
});

/**
 * Add a shared MCP
 */
app.post("/mcps", async (c) => {
  try {
    const body = await c.req.json<{
      id: string;
      name: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
      sharedWith: AgentId[];
    }>();

    // Validate required fields
    if (!body.id || !body.name || !body.command || !body.sharedWith) {
      return c.json({ error: "Missing required fields: id, name, command, sharedWith" }, 400);
    }

    const mcpServer = getMCPServer();
    const config: SharedMCPConfig = {
      id: body.id,
      name: body.name,
      command: body.command,
      args: body.args,
      env: body.env,
      sharedWith: body.sharedWith,
    };

    mcpServer.addSharedMCP(config);

    // Notify agents of the change
    mcpServer.notifyAgentsOfSharedResourceChange("mcp", body.id);

    return c.json({ success: true, mcp: config });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to add shared MCP" },
      500
    );
  }
});

/**
 * Remove a shared MCP
 */
app.delete("/mcps/:id", (c) => {
  const mcpId = c.req.param("id");
  if (!mcpId) {
    return c.json({ error: "MCP ID required" }, 400);
  }

  const mcpServer = getMCPServer();
  mcpServer.removeSharedMCP(mcpId);

  // Notify agents of the change
  mcpServer.notifyAgentsOfSharedResourceChange("mcp", mcpId);

  return c.json({ success: true });
});

/**
 * Get shared MCPs for a specific agent
 */
app.get("/mcps/agent/:agentId", (c) => {
  const agentId = c.req.param("agentId") as AgentId;
  if (!agentId) {
    return c.json({ error: "Agent ID required" }, 400);
  }

  const mcpServer = getMCPServer();
  const mcps = mcpServer.getSharedMCPsForAgent(agentId);

  return c.json({ mcps });
});

/**
 * List all shared Skills
 */
app.get("/skills", (c) => {
  const mcpServer = getMCPServer();
  const skills = mcpServer.listSharedSkills();
  return c.json({ skills });
});

/**
 * Add a shared Skill
 */
app.post("/skills", async (c) => {
  try {
    const body = await c.req.json<{
      id: string;
      name: string;
      description?: string;
      config?: Record<string, unknown>;
      sharedWith: AgentId[];
    }>();

    // Validate required fields
    if (!body.id || !body.name || !body.sharedWith) {
      return c.json({ error: "Missing required fields: id, name, sharedWith" }, 400);
    }

    const mcpServer = getMCPServer();
    const config: SharedSkillConfig = {
      id: body.id,
      name: body.name,
      description: body.description,
      config: body.config,
      sharedWith: body.sharedWith,
    };

    mcpServer.addSharedSkill(config);

    // Notify agents of the change
    mcpServer.notifyAgentsOfSharedResourceChange("skill", body.id);

    return c.json({ success: true, skill: config });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to add shared Skill" },
      500
    );
  }
});

/**
 * Remove a shared Skill
 */
app.delete("/skills/:id", (c) => {
  const skillId = c.req.param("id");
  if (!skillId) {
    return c.json({ error: "Skill ID required" }, 400);
  }

  const mcpServer = getMCPServer();
  mcpServer.removeSharedSkill(skillId);

  // Notify agents of the change
  mcpServer.notifyAgentsOfSharedResourceChange("skill", skillId);

  return c.json({ success: true });
});

/**
 * Get shared Skills for a specific agent
 */
app.get("/skills/agent/:agentId", (c) => {
  const agentId = c.req.param("agentId") as AgentId;
  if (!agentId) {
    return c.json({ error: "Agent ID required" }, 400);
  }

  const mcpServer = getMCPServer();
  const skills = mcpServer.getSharedSkillsForAgent(agentId);

  return c.json({ skills });
});

export function createSharedResourcesRouter() {
  return app;
}
