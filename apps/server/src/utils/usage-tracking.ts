/**
 * Usage Tracking and Cost Monitoring
 *
 * Tracks token usage, costs, and enforces thresholds.
 */

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export interface UsageRecord {
  id: string;
  agentId: string;
  sessionId?: string;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
  model?: string;
  taskId?: string;
}

export interface ProviderPricing {
  id: string;
  providerId: string;
  model: string;
  inputTokenCostPer1M: number;
  outputTokenCostPer1M: number;
  updatedAt: string;
}

export interface AgentSubscription {
  id: string;
  agentId: string;
  providerId: string;
  apiKeyEncrypted?: string;
  tier?: string;
  expiresAt?: string;
  remainingCredits?: number;
  lastCheckedAt?: string;
  status: "active" | "expired" | "suspended";
}

export interface UsageThreshold {
  id: string;
  agentId?: string;
  thresholdType: "tokens" | "cost" | "requests" | "duration";
  limitValue: number;
  currentValue: number;
  period: "session" | "daily" | "monthly";
  action: "warn" | "throttle" | "stop";
}

/**
 * Calculate cost based on token usage and provider pricing
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ProviderPricing
): number {
  const inputCost = (inputTokens * pricing.inputTokenCostPer1M) / 1_000_000;
  const outputCost = (outputTokens * pricing.outputTokenCostPer1M) / 1_000_000;
  return Number.parseFloat((inputCost + outputCost).toFixed(6));
}

/**
 * Record usage for an agent execution
 */
export function recordUsage(
  db: DatabaseSync,
  record: Omit<UsageRecord, "id" | "timestamp">
): UsageRecord {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO usage_records 
    (id, agent_id, session_id, timestamp, input_tokens, output_tokens, cost, duration_ms, model, task_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    record.agentId,
    record.sessionId || null,
    timestamp,
    record.inputTokens,
    record.outputTokens,
    record.cost,
    record.durationMs,
    record.model || null,
    record.taskId || null
  );

  return {
    id,
    timestamp,
    ...record,
  };
}

/**
 * Get usage summary for an agent
 */
export function getAgentUsageSummary(
  db: DatabaseSync,
  agentId: string,
  period: "day" | "week" | "month" = "day"
): {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  totalRequests: number;
  averageDuration: number;
} {
  const dateFilter = {
    day: "datetime('now', '-1 day')",
    week: "datetime('now', '-7 days')",
    month: "datetime('now', '-30 days')",
  }[period];

  const stmt = db.prepare(`
    SELECT 
      COALESCE(SUM(input_tokens), 0) as total_input,
      COALESCE(SUM(output_tokens), 0) as total_output,
      COALESCE(SUM(cost), 0) as total_cost,
      COUNT(*) as total_requests,
      COALESCE(AVG(duration_ms), 0) as avg_duration
    FROM usage_records
    WHERE agent_id = ? AND timestamp >= ${dateFilter}
  `);

  const result = stmt.get(agentId) as {
    total_input: number;
    total_output: number;
    total_cost: number;
    total_requests: number;
    avg_duration: number;
  };

  return {
    totalInputTokens: result.total_input,
    totalOutputTokens: result.total_output,
    totalCost: result.total_cost,
    totalRequests: result.total_requests,
    averageDuration: Math.round(result.avg_duration),
  };
}

/**
 * Get or create provider pricing
 */
export function getProviderPricing(
  db: DatabaseSync,
  providerId: string,
  model: string
): ProviderPricing | undefined {
  const stmt = db.prepare("SELECT * FROM provider_pricing WHERE provider_id = ? AND model = ?");
  const row = stmt.get(providerId, model) as
    | {
        id: string;
        provider_id: string;
        model: string;
        input_token_cost_per_1m: number;
        output_token_cost_per_1m: number;
        updated_at: string;
      }
    | undefined;

  if (!row) return undefined;

  return {
    id: row.id,
    providerId: row.provider_id,
    model: row.model,
    inputTokenCostPer1M: row.input_token_cost_per_1m,
    outputTokenCostPer1M: row.output_token_cost_per_1m,
    updatedAt: row.updated_at,
  };
}

/**
 * Set provider pricing
 */
export function setProviderPricing(
  db: DatabaseSync,
  pricing: Omit<ProviderPricing, "id" | "updatedAt">
): ProviderPricing {
  const id = randomUUID();
  const updatedAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO provider_pricing 
    (id, provider_id, model, input_token_cost_per_1m, output_token_cost_per_1m, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    pricing.providerId,
    pricing.model,
    pricing.inputTokenCostPer1M,
    pricing.outputTokenCostPer1M,
    updatedAt
  );

  return {
    id,
    updatedAt,
    ...pricing,
  };
}

/**
 * Check if usage exceeds thresholds and return action to take
 */
export function checkThresholds(
  db: DatabaseSync,
  agentId: string,
  currentUsage: { tokens: number; cost: number; requests: number }
): { exceeded: boolean; action: "warn" | "throttle" | "stop"; message?: string } {
  const stmt = db.prepare(`
    SELECT * FROM usage_thresholds 
    WHERE (agent_id = ? OR agent_id IS NULL) 
    AND current_value + ? >= limit_value
  `);

  // Check token threshold
  const tokenThreshold = stmt.get(agentId, currentUsage.tokens) as UsageThreshold | undefined;
  if (tokenThreshold) {
    return {
      exceeded: true,
      action: tokenThreshold.action,
      message: `Token threshold exceeded: ${currentUsage.tokens} tokens`,
    };
  }

  return { exceeded: false, action: "warn" };
}

/**
 * Create a usage threshold
 */
export function createThreshold(
  db: DatabaseSync,
  threshold: Omit<UsageThreshold, "id" | "currentValue">
): UsageThreshold {
  const id = randomUUID();

  const stmt = db.prepare(`
    INSERT INTO usage_thresholds 
    (id, agent_id, threshold_type, limit_value, current_value, period, action, created_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `);

  stmt.run(
    id,
    threshold.agentId || null,
    threshold.thresholdType,
    threshold.limitValue,
    threshold.period,
    threshold.action,
    new Date().toISOString()
  );

  return {
    id,
    currentValue: 0,
    ...threshold,
  };
}

/**
 * Default pricing for known providers
 */
export const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  "claude:claude-3-opus": { input: 15.0, output: 75.0 },
  "claude:claude-3-sonnet": { input: 3.0, output: 15.0 },
  "claude:claude-3-haiku": { input: 0.25, output: 1.25 },
  "openai:gpt-4o": { input: 5.0, output: 15.0 },
  "openai:gpt-4-turbo": { input: 10.0, output: 30.0 },
  "openai:gpt-3.5-turbo": { input: 0.5, output: 1.5 },
};

/**
 * Initialize default pricing for known providers
 */
export function initializeDefaultPricing(db: DatabaseSync): void {
  for (const [key, pricing] of Object.entries(DEFAULT_PRICING)) {
    const [providerId, model] = key.split(":");
    const existing = getProviderPricing(db, providerId, model);
    if (!existing) {
      setProviderPricing(db, {
        providerId,
        model,
        inputTokenCostPer1M: pricing.input,
        outputTokenCostPer1M: pricing.output,
      });
    }
  }
}
