/**
 * Agent Metrics Tracking
 *
 * Tracks agent usage metrics including uptime, token usage, and context usage.
 */

import type { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import type { AgentId } from "../types.js";

/**
 * Agent metrics data
 */
export interface AgentMetrics {
  id: string;
  agentId: AgentId;
  uptimeSeconds: number;
  tokenUsage: number;
  contextUsage: number;
  lastActiveAt: string;
  recordedAt: string;
}

/**
 * Agent process tracking
 */
interface AgentProcess {
  agentId: AgentId;
  startTime: number;
  tokenCount: number;
  contextUsed: number;
  lastActive: number;
}

/**
 * In-memory agent process state
 */
const agentProcesses = new Map<AgentId, AgentProcess>();

/**
 * Start tracking an agent
 */
export function startAgentTracking(agentId: AgentId): void {
  if (agentProcesses.has(agentId)) {
    return; // Already tracking
  }

  const now = Date.now();
  agentProcesses.set(agentId, {
    agentId,
    startTime: now,
    tokenCount: 0,
    contextUsed: 0,
    lastActive: now,
  });

  console.log(`[METRICS] Started tracking agent: ${agentId}`);
}

/**
 * Stop tracking an agent
 */
export function stopAgentTracking(agentId: AgentId): void {
  agentProcesses.delete(agentId);
  console.log(`[METRICS] Stopped tracking agent: ${agentId}`);
}

/**
 * Update agent token usage
 */
export function recordTokenUsage(agentId: AgentId, tokens: number): void {
  const process = agentProcesses.get(agentId);
  if (!process) {
    return;
  }

  process.tokenCount += tokens;
  process.lastActive = Date.now();
}

/**
 * Update agent context usage
 */
export function recordContextUsage(agentId: AgentId, contextSize: number): void {
  const process = agentProcesses.get(agentId);
  if (!process) {
    return;
  }

  process.contextUsed = contextSize;
  process.lastActive = Date.now();
}

/**
 * Get current metrics for an agent
 */
export function getAgentMetrics(agentId: AgentId): {
  uptime: number;
  tokenUsage: number;
  contextUsage: number;
} {
  const process = agentProcesses.get(agentId);
  
  if (!process) {
    return {
      uptime: 0,
      tokenUsage: 0,
      contextUsage: 0,
    };
  }

  const now = Date.now();
  const uptimeMs = now - process.startTime;

  return {
    uptime: Math.floor(uptimeMs / 1000),
    tokenUsage: process.tokenCount,
    contextUsage: process.contextUsed,
  };
}

/**
 * Persist agent metrics to database
 */
export function persistAgentMetrics(db: DatabaseSync, agentId: AgentId): void {
  const process = agentProcesses.get(agentId);
  
  if (!process) {
    return;
  }

  const metrics = getAgentMetrics(agentId);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO agent_metrics (id, agent_id, uptime_seconds, token_usage, context_usage, last_active_at, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    agentId,
    metrics.uptime,
    metrics.tokenUsage,
    metrics.contextUsage,
    new Date(process.lastActive).toISOString(),
    now
  );
}

/**
 * Get historical metrics for an agent
 */
export function getAgentMetricsHistory(
  db: DatabaseSync,
  agentId: AgentId,
  limit: number = 100
): AgentMetrics[] {
  const stmt = db.prepare(`
    SELECT * FROM agent_metrics
    WHERE agent_id = ?
    ORDER BY recorded_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(agentId, limit) as unknown[];

  return rows.map((row: any) => ({
    id: row.id,
    agentId: row.agent_id,
    uptimeSeconds: row.uptime_seconds,
    tokenUsage: row.token_usage,
    contextUsage: row.context_usage,
    lastActiveAt: row.last_active_at,
    recordedAt: row.recorded_at,
  }));
}

/**
 * Start periodic metrics collection
 */
export function startPeriodicMetricsCollection(db: DatabaseSync, intervalSeconds: number = 30): NodeJS.Timeout {
  console.log(`[METRICS] Starting periodic collection every ${intervalSeconds}s`);

  return setInterval(() => {
    for (const agentId of agentProcesses.keys()) {
      try {
        persistAgentMetrics(db, agentId);
      } catch (error) {
        console.error(`[METRICS] Failed to persist metrics for ${agentId}:`, error);
      }
    }
  }, intervalSeconds * 1000);
}

/**
 * Get all tracked agents
 */
export function getTrackedAgents(): AgentId[] {
  return Array.from(agentProcesses.keys());
}
