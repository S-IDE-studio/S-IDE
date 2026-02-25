/**
 * Orchestrator API Routes
 *
 * Task orchestration endpoints for managing complex multi-agent tasks.
 */

import { Hono } from "hono";
import {
  getTaskOrchestrator,
  type Task,
  type TaskStatus,
} from "../agents/orchestrator/TaskOrchestrator.js";
import { getAgentObserver } from "../agents/observer/AgentObserver.js";
import { createHttpError, handleError, readJson } from "../utils/error.js";

/**
 * Create orchestrator router
 */
export function createOrchestratorRouter() {
  const router = new Hono();
  const orchestrator = getTaskOrchestrator();

  /**
   * GET /api/orchestrator/tasks - List all tasks
   */
  router.get("/tasks", async (c) => {
    try {
      const status = c.req.query("status") as TaskStatus | undefined;

      let tasks: Task[];
      if (status) {
        tasks = orchestrator.getTasksByStatus(status);
      } else {
        tasks = orchestrator.getAllTasks();
      }

      return c.json({ tasks });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/orchestrator/tasks - Create a new task
   */
  router.post("/tasks", async (c) => {
    try {
      const body = await readJson<{ description: string; userId?: string }>(c);

      if (!body || !body.description) {
        throw createHttpError("Task description is required", 400);
      }

      const task = orchestrator.createTask(body.description, body.userId);

      return c.json({ task }, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/orchestrator/tasks/:id - Get task details
   */
  router.get("/tasks/:id", async (c) => {
    try {
      const taskId = c.req.param("id");
      const task = orchestrator.getTask(taskId);

      if (!task) {
        throw createHttpError("Task not found", 404);
      }

      return c.json({ task });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/orchestrator/tasks/:id/decompose - Decompose task into subtasks
   */
  router.post("/tasks/:id/decompose", async (c) => {
    try {
      const taskId = c.req.param("id");
      const task = orchestrator.getTask(taskId);

      if (!task) {
        throw createHttpError("Task not found", 404);
      }

      const subtasks = await orchestrator.decomposeTask(taskId);

      return c.json({ task: orchestrator.getTask(taskId), subtasks });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/orchestrator/tasks/:id/execute - Execute the task
   */
  router.post("/tasks/:id/execute", async (c) => {
    try {
      const taskId = c.req.param("id");
      const task = orchestrator.getTask(taskId);

      if (!task) {
        throw createHttpError("Task not found", 404);
      }

      if (task.status === "running") {
        throw createHttpError("Task is already running", 409);
      }

      // Execute asynchronously - don't wait for completion
      const result = await orchestrator.executeTask(taskId);

      return c.json({ result, task: orchestrator.getTask(taskId) });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/orchestrator/tasks/:id/cancel - Cancel the task
   */
  router.post("/tasks/:id/cancel", async (c) => {
    try {
      const taskId = c.req.param("id");
      const cancelled = orchestrator.cancelTask(taskId);

      if (!cancelled) {
        throw createHttpError("Task not found or already completed", 400);
      }

      return c.json({ success: true, message: "Task cancelled" });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/orchestrator/observer/metrics - Get current agent metrics
   */
  router.get("/observer/metrics", async (c) => {
    try {
      const observer = getAgentObserver();
      const metrics = observer.getAllMetrics();

      return c.json({ metrics });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/orchestrator/observer/interventions - Get interventions
   */
  router.get("/observer/interventions", async (c) => {
    try {
      const observer = getAgentObserver();
      const agentId = c.req.query("agentId");
      const interventions = observer.getInterventions(agentId);

      return c.json({ interventions });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/orchestrator/observer/interventions/:id/acknowledge - Acknowledge intervention
   */
  router.post("/observer/interventions/:id/acknowledge", async (c) => {
    try {
      const observer = getAgentObserver();
      const interventionId = c.req.param("id");
      const acknowledged = observer.acknowledgeIntervention(interventionId);

      if (!acknowledged) {
        throw createHttpError("Intervention not found", 404);
      }

      return c.json({ success: true });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/orchestrator/observer/override - Observer override (stop task/agent)
   * Demonstrates P-1 > P-2: Observer can override Orchestrator
   */
  router.post("/observer/override", async (c) => {
    try {
      const body = await readJson<{
        targetType: "task" | "agent";
        targetId: string;
        reason: string;
      }>(c);

      if (!body || !body.targetType || !body.targetId || !body.reason) {
        throw createHttpError("targetType, targetId, and reason are required", 400);
      }

      const observer = getAgentObserver();
      let success = false;

      if (body.targetType === "task") {
        success = await observer.overrideOrchestrator(body.targetId, body.reason);
      } else if (body.targetType === "agent") {
        success = await observer.forceStop(body.targetId, body.reason);
      } else {
        throw createHttpError("Invalid targetType", 400);
      }

      return c.json({
        success,
        message: success
          ? `${body.targetType} ${body.targetId} stopped by Observer override`
          : `Failed to stop ${body.targetType} ${body.targetId}`,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/orchestrator/observer/alerts - Get observer alerts
   */
  router.get("/observer/alerts", async (c) => {
    try {
      const observer = getAgentObserver();
      const level = c.req.query("level");
      const alerts = observer.getAlerts(level as "info" | "warning" | "critical");

      return c.json({ alerts });
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}
