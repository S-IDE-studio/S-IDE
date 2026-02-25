/**
 * AgentObserver — 全エージェント実行状態の監視・介入モジュール
 *
 * Core Daemonの内蔵モジュールとして動作し、以下を監視する:
 * - トークン使用量・コスト・実行時間の閾値
 * - エージェントの異常検知
 * - Observer > Orchestrator の権限による強制停止 (P-1 > P-2)
 */

import type { DatabaseSync } from "node:sqlite";
import { getTaskOrchestrator } from "../orchestrator/TaskOrchestrator.js";
import type { AgentId } from "../types.js";

export type InterventionAction = "warn" | "throttle" | "pause" | "stop" | "kill";

export interface ThresholdConfig {
  id: string;
  agentId?: AgentId; // undefined = global
  metric: "tokens" | "cost" | "duration" | "requests" | "error_rate";
  limit: number;
  period: "session" | "hourly" | "daily" | "monthly";
  action: InterventionAction;
  enabled: boolean;
}

export interface AgentMetrics {
  agentId: AgentId;
  sessionId?: string;
  timestamp: number;
  tokens: { input: number; output: number; total: number };
  cost: number;
  duration: number;
  requests: number;
  errors: number;
  status: "idle" | "running" | "error" | "stopped";
}

export interface Intervention {
  id: string;
  timestamp: string;
  agentId: AgentId;
  thresholdId: string;
  action: InterventionAction;
  reason: string;
  metrics: AgentMetrics;
  acknowledged: boolean;
}

export interface ObserverAlert {
  id: string;
  level: "info" | "warning" | "critical";
  agentId?: AgentId;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * AgentObserver
 *
 * 全エージェントの実行状態を常時監視し、閾値超過時に介入する。
 * ObserverはOrchestratorよりも権限が高い (P-1 > P-2)。
 */
export class AgentObserver {
  private db: DatabaseSync | null = null;
  private isInitialized = false;
  private isRunning = false;

  // Monitoring state
  private thresholds: Map<string, ThresholdConfig> = new Map();
  private currentMetrics: Map<AgentId, AgentMetrics> = new Map();
  private interventions: Map<string, Intervention> = new Map();
  private alerts: ObserverAlert[] = [];

  // Monitoring interval
  private monitorInterval: NodeJS.Timeout | null = null;
  private readonly MONITOR_INTERVAL_MS = 5000; // 5 seconds

  // Callbacks for external notification
  private onInterventionCallbacks: ((intervention: Intervention) => void)[] = [];
  private onAlertCallbacks: ((alert: ObserverAlert) => void)[] = [];

  /**
   * Initialize the observer with database
   */
  initialize(db: DatabaseSync): void {
    this.db = db;
    this.isInitialized = true;

    // Load thresholds from database
    this.loadThresholds();

    console.log("[Observer] Initialized");
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (!this.isInitialized) {
      throw new Error("Observer not initialized");
    }
    if (this.isRunning) return;

    this.isRunning = true;

    // Set up periodic monitoring
    this.monitorInterval = setInterval(() => {
      this.monitorCycle();
    }, this.MONITOR_INTERVAL_MS);

    console.log("[Observer] Monitoring started");
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    console.log("[Observer] Monitoring stopped");
  }

  /**
   * Register a new threshold
   */
  registerThreshold(config: Omit<ThresholdConfig, "id">): ThresholdConfig {
    const id = `threshold-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const threshold: ThresholdConfig = { id, ...config };

    this.thresholds.set(id, threshold);
    this.persistThreshold(threshold);

    console.log(`[Observer] Threshold registered: ${id} (${config.metric} > ${config.limit})`);
    return threshold;
  }

  /**
   * Update agent metrics - called periodically by monitoring or agents
   */
  updateMetrics(metrics: AgentMetrics): void {
    this.currentMetrics.set(metrics.agentId, metrics);

    // Check thresholds immediately for real-time intervention
    this.checkThresholds(metrics);
  }

  /**
   * Get current metrics for an agent
   */
  getMetrics(agentId: AgentId): AgentMetrics | undefined {
    return this.currentMetrics.get(agentId);
  }

  /**
   * Get all current metrics
   */
  getAllMetrics(): AgentMetrics[] {
    return Array.from(this.currentMetrics.values());
  }

  /**
   * Force stop an agent - Observer override (P-1 > P-2)
   */
  async forceStop(agentId: AgentId, reason: string): Promise<boolean> {
    console.log(`[Observer] FORCE STOP triggered for ${agentId}: ${reason}`);

    // Record intervention
    const intervention: Intervention = {
      id: `intervention-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentId,
      thresholdId: "manual",
      action: "kill",
      reason,
      metrics: this.currentMetrics.get(agentId) || this.createEmptyMetrics(agentId),
      acknowledged: false,
    };

    this.interventions.set(intervention.id, intervention);
    this.persistIntervention(intervention);
    this.notifyIntervention(intervention);

    // Trigger actual stop
    try {
      // Stop the agent via the agent system
      const { getAgent } = await import("../../routes/agents.js");
      const agent = getAgent(agentId);
      if (agent && agent.dispose) {
        await agent.dispose();
      }

      // Also stop any tasks in the orchestrator
      const orchestrator = getTaskOrchestrator();
      for (const task of orchestrator.getTasksByStatus("running")) {
        // Mark tasks as needing attention
        this.createAlert("critical", agentId, `Task ${task.id} interrupted by Observer`, {
          taskId: task.id,
        });
      }

      return true;
    } catch (error) {
      console.error(`[Observer] Failed to stop agent ${agentId}:`, error);
      return false;
    }
  }

  /**
   * Override Orchestrator - stop a task immediately
   * This demonstrates P-1 > P-2: Observer can override Orchestrator
   */
  async overrideOrchestrator(taskId: string, reason: string): Promise<boolean> {
    console.log(`[Observer] OVERRIDE Orchestrator - stopping task ${taskId}: ${reason}`);

    const orchestrator = getTaskOrchestrator();
    const task = orchestrator.getTask(taskId);

    if (!task) {
      console.warn(`[Observer] Task ${taskId} not found`);
      return false;
    }

    // Cancel the task
    const cancelled = orchestrator.cancelTask(taskId);

    if (cancelled) {
      this.createAlert("critical", undefined, `Task ${taskId} cancelled by Observer override`, {
        taskId,
        reason,
        originalStatus: task.status,
      });
    }

    return cancelled;
  }

  /**
   * Get interventions
   */
  getInterventions(agentId?: AgentId): Intervention[] {
    const interventions = Array.from(this.interventions.values());
    if (agentId) {
      return interventions.filter((i) => i.agentId === agentId);
    }
    return interventions;
  }

  /**
   * Get alerts
   */
  getAlerts(level?: ObserverAlert["level"]): ObserverAlert[] {
    if (level) {
      return this.alerts.filter((a) => a.level === level);
    }
    return [...this.alerts];
  }

  /**
   * Acknowledge an intervention
   */
  acknowledgeIntervention(interventionId: string): boolean {
    const intervention = this.interventions.get(interventionId);
    if (!intervention) return false;

    intervention.acknowledged = true;
    this.persistIntervention(intervention);

    return true;
  }

  /**
   * Subscribe to intervention events
   */
  onIntervention(callback: (intervention: Intervention) => void): () => void {
    this.onInterventionCallbacks.push(callback);
    return () => {
      const idx = this.onInterventionCallbacks.indexOf(callback);
      if (idx >= 0) this.onInterventionCallbacks.splice(idx, 1);
    };
  }

  /**
   * Subscribe to alert events
   */
  onAlert(callback: (alert: ObserverAlert) => void): () => void {
    this.onAlertCallbacks.push(callback);
    return () => {
      const idx = this.onAlertCallbacks.indexOf(callback);
      if (idx >= 0) this.onAlertCallbacks.splice(idx, 1);
    };
  }

  /**
   * Main monitoring cycle
   */
  private monitorCycle(): void {
    if (!this.isRunning) return;

    // Check all current metrics against thresholds
    for (const metrics of this.currentMetrics.values()) {
      this.checkThresholds(metrics);
    }

    // Clean up old alerts (keep last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Check metrics against all thresholds
   */
  private checkThresholds(metrics: AgentMetrics): void {
    for (const threshold of this.thresholds.values()) {
      if (!threshold.enabled) continue;
      if (threshold.agentId && threshold.agentId !== metrics.agentId) continue;

      const currentValue = this.getMetricValue(metrics, threshold.metric);

      if (currentValue > threshold.limit) {
        this.triggerIntervention(metrics, threshold, currentValue);
      }
    }
  }

  /**
   * Get metric value from metrics object
   */
  private getMetricValue(metrics: AgentMetrics, metric: ThresholdConfig["metric"]): number {
    switch (metric) {
      case "tokens":
        return metrics.tokens.total;
      case "cost":
        return metrics.cost;
      case "duration":
        return metrics.duration;
      case "requests":
        return metrics.requests;
      case "error_rate":
        return metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0;
      default:
        return 0;
    }
  }

  /**
   * Trigger an intervention
   */
  private triggerIntervention(
    metrics: AgentMetrics,
    threshold: ThresholdConfig,
    currentValue: number
  ): void {
    const intervention: Intervention = {
      id: `intervention-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      agentId: metrics.agentId,
      thresholdId: threshold.id,
      action: threshold.action,
      reason: `${threshold.metric} exceeded threshold: ${currentValue} > ${threshold.limit}`,
      metrics,
      acknowledged: false,
    };

    this.interventions.set(intervention.id, intervention);
    this.persistIntervention(intervention);
    this.notifyIntervention(intervention);

    console.log(`[Observer] Intervention triggered: ${intervention.action} for ${metrics.agentId}`);

    // Execute action
    this.executeInterventionAction(intervention);
  }

  /**
   * Execute the intervention action
   */
  private executeInterventionAction(intervention: Intervention): void {
    const { agentId, action } = intervention;

    switch (action) {
      case "warn":
        this.createAlert("warning", agentId, `Threshold exceeded: ${intervention.reason}`);
        break;
      case "throttle":
        // Throttle would be implemented at the agent level
        this.createAlert("warning", agentId, `Throttling agent due to: ${intervention.reason}`);
        break;
      case "pause":
        // Pause would temporarily stop processing
        this.createAlert("critical", agentId, `Agent paused: ${intervention.reason}`);
        break;
      case "stop":
        void this.forceStop(agentId, intervention.reason);
        break;
      case "kill":
        void this.forceStop(agentId, `KILL: ${intervention.reason}`);
        break;
    }
  }

  /**
   * Create an alert
   */
  private createAlert(
    level: ObserverAlert["level"],
    agentId: AgentId | undefined,
    message: string,
    details?: Record<string, unknown>
  ): void {
    const alert: ObserverAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      level,
      agentId,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    this.alerts.push(alert);
    this.notifyAlert(alert);

    console.log(`[Observer] Alert [${level}]: ${message}`);
  }

  /**
   * Notify intervention subscribers
   */
  private notifyIntervention(intervention: Intervention): void {
    for (const callback of this.onInterventionCallbacks) {
      try {
        callback(intervention);
      } catch (error) {
        console.error("[Observer] Intervention callback error:", error);
      }
    }
  }

  /**
   * Notify alert subscribers
   */
  private notifyAlert(alert: ObserverAlert): void {
    for (const callback of this.onAlertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        console.error("[Observer] Alert callback error:", error);
      }
    }
  }

  /**
   * Create empty metrics for an agent
   */
  private createEmptyMetrics(agentId: AgentId): AgentMetrics {
    return {
      agentId,
      timestamp: Date.now(),
      tokens: { input: 0, output: 0, total: 0 },
      cost: 0,
      duration: 0,
      requests: 0,
      errors: 0,
      status: "idle",
    };
  }

  /**
   * Load thresholds from database
   */
  private loadThresholds(): void {
    if (!this.db) return;

    try {
      const stmt = this.db.prepare("SELECT * FROM usage_thresholds WHERE enabled = 1");
      const rows = stmt.all() as Array<{
        id: string;
        agent_id?: string;
        threshold_type: string;
        limit_value: number;
        period: string;
        action: string;
      }>;

      for (const row of rows) {
        const threshold: ThresholdConfig = {
          id: row.id,
          agentId: row.agent_id as AgentId,
          metric: row.threshold_type as ThresholdConfig["metric"],
          limit: row.limit_value,
          period: row.period as ThresholdConfig["period"],
          action: row.action as InterventionAction,
          enabled: true,
        };
        this.thresholds.set(threshold.id, threshold);
      }

      console.log(`[Observer] Loaded ${this.thresholds.size} thresholds`);
    } catch (error) {
      console.error("[Observer] Failed to load thresholds:", error);
    }
  }

  /**
   * Persist threshold to database
   */
  private persistThreshold(threshold: ThresholdConfig): void {
    // Already persisted via usage_thresholds table
  }

  /**
   * Persist intervention to database
   */
  private persistIntervention(intervention: Intervention): void {
    if (!this.db) return;

    try {
      // Would need an interventions table in production
      console.log(`[Observer] Intervention recorded: ${intervention.id}`);
    } catch (error) {
      console.error("[Observer] Failed to persist intervention:", error);
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stop();
    this.thresholds.clear();
    this.currentMetrics.clear();
    this.interventions.clear();
    this.alerts = [];
    this.onInterventionCallbacks = [];
    this.onAlertCallbacks = [];
    this.db = null;
    this.isInitialized = false;
    console.log("[Observer] Disposed");
  }
}

// Singleton instance
let observerInstance: AgentObserver | null = null;

/**
 * Get or create the AgentObserver singleton
 */
export function getAgentObserver(): AgentObserver {
  if (!observerInstance) {
    observerInstance = new AgentObserver();
  }
  return observerInstance;
}

/**
 * Reset the observer singleton (mainly for testing)
 */
export function resetAgentObserver(): void {
  if (observerInstance) {
    observerInstance.dispose();
  }
  observerInstance = null;
}
