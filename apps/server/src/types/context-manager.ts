/**
 * Context Manager Types
 *
 * Type definitions for the Context Manager integration
 */

export interface ContextManagerInstance {
  start(): void;
  stop(): void;
  isMonitoring(): boolean;
  getStatus(): ContextManagerStatus | null;
  getCurrentSession(): ContextManagerSession | null;
  createSession(sessionId: string, initialPrompt: string): void;
  endSession(sessionId: string): void;
  compact(options: CompactOptions): Promise<CompactResult>;
  createSnapshot(description?: string): Promise<SnapshotResult>;
  getSnapshots(): SnapshotResult[];
  getLatestSnapshot(): SnapshotResult | null;
  getHealthiestSnapshot(): SnapshotResult | null;
  restoreSnapshot(commitHash: string): Promise<void>;
  getStats(): ContextManagerStats;
  listSessions(): ContextManagerSession[];
  getSession(sessionId: string): ContextManagerSession | null;
  deleteSession(sessionId: string): void;
  trackMessage(role: "user" | "assistant", content: string): void;
  trackTool(name: string, args: unknown, result: unknown): void;
  trackError(error: string | Error): void;
  analyzeDrift(): Promise<DriftResult | null>;
  trimOutput(options: TrimOptions): TrimResult | null;
}

export interface ContextManagerStatus {
  healthScore: number;
  driftScore: number;
  phase: string;
  recommendations: string[];
}

export interface ContextManagerSession {
  id: string;
  metrics: {
    messageCount: number;
    totalTokens: number;
  };
}

export interface CompactOptions {
  keepRecentEvents?: number;
  compactThreshold?: number;
}

export interface CompactResult {
  originalEvents: number;
  remainingEvents: number;
  compactedEvents: number;
  summary: string;
  spaceSaved: number;
}

export interface SnapshotResult {
  commitHash: string;
  timestamp: string;
  healthScore: number;
  description: string;
}

export interface TrimOptions {
  maxOutputLength?: number;
  trimMethod?: "truncate" | "ellipsis" | "smart";
}

export interface TrimResult {
  trimmed: boolean;
  originalLength: number;
  trimmedLength: number;
  output: string;
}

export interface DriftResult {
  driftScore: number;
  needsDeepAnalysis: boolean;
  message?: string;
}

export interface ContextManagerStats {
  totalSessions: number;
  totalMessages: number;
  totalSnapshots: number;
}
