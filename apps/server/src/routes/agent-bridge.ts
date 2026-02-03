/**
 * Agent Bridge API Routes
 *
 * API endpoints for agent-to-agent communication and task handoff.
 */

import { Hono } from "hono";
import type { AgentId } from "../types.js";
import { getMCPServer } from "../mcp/server.js";

const app = new Hono();

/**
 * Send a message to a specific agent
 */
app.post("/:from/send/:to", async (c) => {
  const from = c.req.param("from") as AgentId;
  const to = c.req.param("to") as AgentId;

  if (!from || !to) {
    return c.json({ error: "Both from and to agent IDs required" }, 400);
  }

  try {
    const body = await c.req.json<{ content: unknown }>();
    const mcpServer = getMCPServer();

    const response = await mcpServer.sendMessage(from, to, body.content);

    return c.json({ response });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      500
    );
  }
});

/**
 * Broadcast a message to all agents
 */
app.post("/:from/broadcast", async (c) => {
  const from = c.req.param("from") as AgentId;

  if (!from) {
    return c.json({ error: "From agent ID required" }, 400);
  }

  try {
    const body = await c.req.json<{
      content: unknown;
      exclude?: AgentId[];
    }>();
    const mcpServer = getMCPServer();

    const responses = await mcpServer.broadcastMessage(
      from,
      body.content,
      body.exclude
    );

    return c.json({ responses });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to broadcast message" },
      500
    );
  }
});

/**
 * Hand off a task to another agent
 */
app.post("/:from/handoff/:to", async (c) => {
  const from = c.req.param("from") as AgentId;
  const to = c.req.param("to") as AgentId;

  if (!from || !to) {
    return c.json({ error: "Both from and to agent IDs required" }, 400);
  }

  try {
    const body = await c.req.json<{
      taskId: string;
      context: unknown;
      task: {
        id: string;
        type: "prompt" | "command" | "code" | "custom";
        content: string;
        options?: Record<string, unknown>;
      };
    }>();

    const mcpServer = getMCPServer();
    await mcpServer.handoffTask({
      taskId: body.taskId,
      from,
      to,
      context: body.context,
      task: body.task,
    });

    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to hand off task" },
      500
    );
  }
});

/**
 * Get registered agents
 */
app.get("/registered", (c) => {
  const mcpServer = getMCPServer();
  const agents = mcpServer.getRegisteredAgents();
  return c.json({ agents });
});

export function createAgentBridgeRouter() {
  return app;
}
