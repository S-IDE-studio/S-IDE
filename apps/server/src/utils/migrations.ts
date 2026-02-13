/**
 * Database Migration System
 *
 * Manages schema versioning and migrations
 */

import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
  down?: (db: DatabaseSync) => void;
}

/**
 * Get current schema version
 */
export function getCurrentVersion(db: DatabaseSync): number {
  try {
    const result = db.prepare("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1").get() as
      | { version: number }
      | undefined;
    return result?.version || 0;
  } catch {
    // Table doesn't exist yet
    return 0;
  }
}

/**
 * Set schema version
 */
function setVersion(db: DatabaseSync, version: number): void {
  db.prepare("INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)").run(
    version,
    new Date().toISOString()
  );
}

/**
 * Run all pending migrations
 */
export function runMigrations(db: DatabaseSync, migrations: Migration[]): void {
  // Create schema version table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const currentVersion = getCurrentVersion(db);
  const pendingMigrations = migrations.filter((m) => m.version > currentVersion);

  if (pendingMigrations.length === 0) {
    console.log(`[DB] Schema is up to date (version ${currentVersion})`);
    return;
  }

  console.log(`[DB] Running ${pendingMigrations.length} migration(s)...`);

  for (const migration of pendingMigrations.sort((a, b) => a.version - b.version)) {
    console.log(`[DB] Applying migration ${migration.version}: ${migration.name}`);
    try {
      migration.up(db);
      setVersion(db, migration.version);
      console.log(`[DB] ✓ Migration ${migration.version} applied`);
    } catch (error) {
      console.error(`[DB] ✗ Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  console.log(`[DB] All migrations complete (version ${getCurrentVersion(db)})`);
}

/**
 * Rollback to a specific version
 */
export function rollbackTo(db: DatabaseSync, migrations: Migration[], targetVersion: number): void {
  const currentVersion = getCurrentVersion(db);
  
  if (targetVersion >= currentVersion) {
    console.log("[DB] Already at or below target version");
    return;
  }

  const migrationsToRollback = migrations
    .filter((m) => m.version > targetVersion && m.version <= currentVersion)
    .sort((a, b) => b.version - a.version); // Rollback in reverse order

  console.log(`[DB] Rolling back ${migrationsToRollback.length} migration(s)...`);

  for (const migration of migrationsToRollback) {
    if (!migration.down) {
      throw new Error(`Migration ${migration.version} does not have a down migration`);
    }

    console.log(`[DB] Rolling back migration ${migration.version}: ${migration.name}`);
    
    try {
      migration.down(db);
      db.prepare("DELETE FROM schema_version WHERE version = ?").run(migration.version);
      console.log(`[DB] ✓ Migration ${migration.version} rolled back`);
    } catch (error) {
      console.error(`[DB] ✗ Rollback ${migration.version} failed:`, error);
      throw error;
    }
  }

  console.log(`[DB] Rollback complete (version ${getCurrentVersion(db)})`);
}

/**
 * List of all migrations
 */
export const migrations: Migration[] = [
  {
    version: 1,
    name: "Add MCP server tables",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_servers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          command TEXT,
          args TEXT,
          url TEXT,
          env TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          agent_id TEXT,
          created_at TEXT NOT NULL
        );
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_tool_states (
          server_id TEXT NOT NULL,
          tool_name TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (server_id, tool_name),
          FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_agent_id ON mcp_servers(agent_id);
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);
      `);
    },
    down: (db) => {
      db.exec("DROP TABLE IF EXISTS mcp_tool_states;");
      db.exec("DROP TABLE IF EXISTS mcp_servers;");
    },
  },
  {
    version: 2,
    name: "Add agent metrics tables",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS agent_metrics (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          uptime_seconds INTEGER DEFAULT 0,
          token_usage INTEGER DEFAULT 0,
          context_usage REAL DEFAULT 0,
          last_active_at TEXT,
          recorded_at TEXT NOT NULL
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_id ON agent_metrics(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_metrics_recorded_at ON agent_metrics(recorded_at);
      `);
    },
    down: (db) => {
      db.exec("DROP TABLE IF EXISTS agent_metrics;");
    },
  },
  {
    version: 3,
    name: "Add context manager tables",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS context_sessions (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          health_score REAL DEFAULT 100,
          message_count INTEGER DEFAULT 0,
          topic_keywords TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS context_snapshots (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          summary TEXT,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (session_id) REFERENCES context_sessions(id) ON DELETE CASCADE
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_context_sessions_agent_id ON context_sessions(agent_id);
        CREATE INDEX IF NOT EXISTS idx_context_snapshots_session_id ON context_snapshots(session_id);
      `);
    },
    down: (db) => {
      db.exec("DROP TABLE IF EXISTS context_snapshots;");
      db.exec("DROP TABLE IF EXISTS context_sessions;");
    },
  },
  {
    version: 4,
    name: "Add tunnel config and task execution tables",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tunnel_configs (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          port INTEGER NOT NULL,
          auto_start INTEGER DEFAULT 0,
          settings TEXT,
          created_at TEXT NOT NULL
        );
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS task_executions (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          status TEXT NOT NULL,
          task TEXT NOT NULL,
          result TEXT,
          started_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_task_executions_agent_id ON task_executions(agent_id);
        CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);
      `);
    },
    down: (db) => {
      db.exec("DROP TABLE IF EXISTS task_executions;");
      db.exec("DROP TABLE IF EXISTS tunnel_configs;");
    },
  },
];
