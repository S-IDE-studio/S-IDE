/**
 * TaskOrchestrator — タスク分解・委譲・追跡の中核モジュール
 *
 * Core Daemonの内蔵モジュールとして動作し、ユーザーからのタスクを
 * サブタスクに分解し、適切なWorker AgentにMCP経由で委譲する。
 */

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { AgentId } from "../types.js";
import { getMCPServer } from "../../mcp/server.js";

export type TaskStatus =
  | "pending"
  | "decomposing"
  | "delegating"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type SubTaskStatus =
  | "pending"
  | "delegated"
  | "running"
  | "completed"
  | "failed"
  | "retrying";

export interface SubTask {
  id: string;
  parentId: string;
  sequence: number;
  type: "prompt" | "command" | "code" | "file" | "analysis";
  description: string;
  content: string;
  targetAgent: AgentId;
  status: SubTaskStatus;
  dependencies: string[]; // 依存するsubtask IDs
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  maxRetries: number;
}

export interface Task {
  id: string;
  userId?: string;
  description: string;
  status: TaskStatus;
  subtasks: SubTask[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  metadata: {
    totalSubtasks: number;
    completedSubtasks: number;
    failedSubtasks: number;
    estimatedCost?: number;
    actualCost?: number;
  };
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  subtaskResults: Map<string, unknown>;
}

/**
 * TaskOrchestrator
 *
 * ユーザーからのタスクを受け取り、サブタスクに分解、Worker Agentに委譲し、
 * 進捗を追跡して完了を判定する。
 */
export class TaskOrchestrator {
  private tasks = new Map<string, Task>();
  private db: DatabaseSync | null = null;
  private isInitialized = false;

  /**
   * Initialize the orchestrator with database
   */
  initialize(db: DatabaseSync): void {
    this.db = db;
    this.isInitialized = true;
    console.log("[Orchestrator] Initialized");
  }

  /**
   * Create a new task from user input
   */
  createTask(description: string, userId?: string): Task {
    const task: Task = {
      id: randomUUID(),
      userId,
      description,
      status: "pending",
      subtasks: [],
      createdAt: new Date().toISOString(),
      metadata: {
        totalSubtasks: 0,
        completedSubtasks: 0,
        failedSubtasks: 0,
      },
    };

    this.tasks.set(task.id, task);
    this.persistTask(task);

    console.log(`[Orchestrator] Task created: ${task.id}`);
    return task;
  }

  /**
   * Decompose a task into subtasks
   * This is a simplified version - in production, this could use an LLM
   */
  async decomposeTask(taskId: string): Promise<SubTask[]> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = "decomposing";
    this.updateTask(task);

    // Simple rule-based decomposition for now
    const subtasks: SubTask[] = this.generateSubtasks(task);

    task.subtasks = subtasks;
    task.metadata.totalSubtasks = subtasks.length;
    task.status = "delegating";
    this.updateTask(task);

    console.log(`[Orchestrator] Task ${taskId} decomposed into ${subtasks.length} subtasks`);
    return subtasks;
  }

  /**
   * Generate subtasks based on task description
   * Simple rule-based approach - can be enhanced with LLM
   */
  private generateSubtasks(task: Task): SubTask[] {
    const description = task.description.toLowerCase();
    const subtasks: SubTask[] = [];

    // Detect task type and create appropriate subtasks
    if (description.includes("create") || description.includes("make") || description.includes("generate")) {
      subtasks.push(this.createSubTask(task.id, 1, "analysis", "Analyze requirements", "Understand what needs to be created", "claude", []));
      subtasks.push(this.createSubTask(task.id, 2, "code", "Generate code/files", task.description, "claude", [subtasks[0].id]));
      subtasks.push(this.createSubTask(task.id, 3, "command", "Verify creation", "Check that files were created correctly", "codex", [subtasks[1].id]));
    } else if (description.includes("fix") || description.includes("bug") || description.includes("error")) {
      subtasks.push(this.createSubTask(task.id, 1, "analysis", "Analyze error", "Understand the error and its cause", "claude", []));
      subtasks.push(this.createSubTask(task.id, 2, "analysis", "Find relevant code", "Locate the code that needs to be fixed", "codex", [subtasks[0].id]));
      subtasks.push(this.createSubTask(task.id, 3, "code", "Implement fix", "Fix the bug", "claude", [subtasks[1].id]));
      subtasks.push(this.createSubTask(task.id, 4, "command", "Test fix", "Run tests to verify the fix", "codex", [subtasks[2].id]));
    } else if (description.includes("refactor") || description.includes("clean up")) {
      subtasks.push(this.createSubTask(task.id, 1, "analysis", "Analyze code", "Understand current code structure", "claude", []));
      subtasks.push(this.createSubTask(task.id, 2, "code", "Apply refactoring", "Perform the refactoring", "claude", [subtasks[0].id]));
      subtasks.push(this.createSubTask(task.id, 3, "command", "Verify behavior", "Ensure functionality is preserved", "codex", [subtasks[1].id]));
    } else {
      subtasks.push(this.createSubTask(task.id, 1, "analysis", "Analyze task", `Understand: ${task.description}`, "claude", []));
      subtasks.push(this.createSubTask(task.id, 2, "prompt", "Execute task", task.description, "claude", [subtasks[0].id]));
    }

    return subtasks;
  }

  private createSubTask(
    parentId: string,
    sequence: number,
    type: SubTask["type"],
    description: string,
    content: string,
    targetAgent: AgentId,
    dependencies: string[]
  ): SubTask {
    return {
      id: randomUUID(),
      parentId,
      sequence,
      type,
      description,
      content,
      targetAgent,
      status: "pending",
      dependencies,
      retryCount: 0,
      maxRetries: 3,
    };
  }

  /**
   * Execute a task by delegating subtasks to agents
   */
  async executeTask(taskId: string): Promise<TaskExecutionResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = "running";
    task.startedAt = new Date().toISOString();
    this.updateTask(task);

    console.log(`[Orchestrator] Executing task: ${taskId}`);

    const results = new Map<string, unknown>();

    try {
      for (const subtask of this.getExecutionOrder(task.subtasks)) {
        const result = await this.executeSubtask(subtask);
        results.set(subtask.id, result);

        if (result === null && subtask.status === "failed") {
          if (subtask.retryCount < subtask.maxRetries) {
            subtask.retryCount++;
            subtask.status = "retrying";
            console.log(`[Orchestrator] Retrying subtask ${subtask.id} (attempt ${subtask.retryCount})`);
            const retryResult = await this.executeSubtask(subtask);
            results.set(subtask.id, retryResult);
          }
        }
      }

      const failedCount = task.subtasks.filter((st) => st.status === "failed").length;
      task.metadata.completedSubtasks = task.subtasks.filter((st) => st.status === "completed").length;
      task.metadata.failedSubtasks = failedCount;

      if (failedCount === 0) {
        task.status = "completed";
      } else if (failedCount < task.subtasks.length / 2) {
        task.status = "completed";
      } else {
        task.status = "failed";
      }

      task.completedAt = new Date().toISOString();
      this.updateTask(task);

      return {
        taskId,
        success: task.status === "completed",
        subtaskResults: results,
      };
    } catch (error) {
      task.status = "failed";
      task.completedAt = new Date().toISOString();
      this.updateTask(task);

      return {
        taskId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        subtaskResults: results,
      };
    }
  }

  private getExecutionOrder(subtasks: SubTask[]): SubTask[] {
    const executed = new Set<string>();
    const result: SubTask[] = [];

    const canExecute = (subtask: SubTask): boolean => {
      return subtask.dependencies.every((depId) => executed.has(depId));
    };

    const pending = [...subtasks];

    while (pending.length > 0) {
      let progress = false;

      for (let i = 0; i < pending.length; i++) {
        const subtask = pending[i];
        if (canExecute(subtask)) {
          result.push(subtask);
          executed.add(subtask.id);
          pending.splice(i, 1);
          progress = true;
          i--;
        }
      }

      if (!progress && pending.length > 0) {
        throw new Error("Circular dependency detected in subtasks");
      }
    }

    return result;
  }

  private async executeSubtask(subtask: SubTask): Promise<unknown> {
    subtask.status = "running";
    subtask.startedAt = new Date().toISOString();
    this.persistSubtask(subtask);

    console.log(`[Orchestrator] Executing subtask ${subtask.id} on ${subtask.targetAgent}`);

    try {
      const mcpServer = getMCPServer();

      const response = await mcpServer.sendMessage("orchestrator" as AgentId, subtask.targetAgent, {
        type: "task-execution",
        subtaskId: subtask.id,
        taskType: subtask.type,
        content: subtask.content,
      });

      if (response.success) {
        subtask.status = "completed";
        subtask.result = response.content;
        subtask.completedAt = new Date().toISOString();
        this.persistSubtask(subtask);

        console.log(`[Orchestrator] Subtask ${subtask.id} completed`);
        return response.content;
      } else {
        throw new Error(response.error || "Task execution failed");
      }
    } catch (error) {
      subtask.status = "failed";
      subtask.error = error instanceof Error ? error.message : "Unknown error";
      subtask.completedAt = new Date().toISOString();
      this.persistSubtask(subtask);

      console.error(`[Orchestrator] Subtask ${subtask.id} failed:`, subtask.error);
      return null;
    }
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return this.getAllTasks().filter((t) => t.status === status);
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
      return false;
    }

    task.status = "cancelled";
    task.completedAt = new Date().toISOString();
    this.updateTask(task);

    console.log(`[Orchestrator] Task ${taskId} cancelled`);
    return true;
  }

  private persistTask(task: Task): void {
    if (!this.db) return;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO task_executions 
        (id, agent_id, status, task, result, started_at, completed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        task.id,
        "orchestrator",
        task.status,
        JSON.stringify({ description: task.description, subtasks: task.subtasks }),
        null,
        task.startedAt,
        task.completedAt,
        task.createdAt
      );
    } catch (error) {
      console.error("[Orchestrator] Failed to persist task:", error);
    }
  }

  private updateTask(task: Task): void {
    this.persistTask(task);
  }

  private persistSubtask(subtask: SubTask): void {
    // Subtasks are stored as part of the task JSON
  }

  dispose(): void {
    this.tasks.clear();
    this.db = null;
    this.isInitialized = false;
    console.log("[Orchestrator] Disposed");
  }
}

let orchestratorInstance: TaskOrchestrator | null = null;

export function getTaskOrchestrator(): TaskOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new TaskOrchestrator();
  }
  return orchestratorInstance;
}

export function resetTaskOrchestrator(): void {
  if (orchestratorInstance) {
    orchestratorInstance.dispose();
  }
  orchestratorInstance = null;
}
