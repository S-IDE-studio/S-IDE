import crypto from "node:crypto";
import fsSync from "node:fs";
import type { Server } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { ClaudeAgent } from "./agents/claude/ClaudeAgent.js";
import { CodexAgent } from "./agents/codex/CodexAgent.js";
import { CopilotAgent } from "./agents/copilot/CopilotAgent.js";
import { CursorAgent } from "./agents/cursor/CursorAgent.js";
import { KimiAgent } from "./agents/kimi/KimiAgent.js";
import {
  BASIC_AUTH_PASSWORD,
  BASIC_AUTH_USER,
  CORS_ORIGIN,
  dbPath,
  distDir,
  HOST,
  hasStatic,
  MAX_FILE_SIZE,
  MAX_REQUEST_BODY_SIZE,
  NODE_ENV,
  PORT,
  TRUST_PROXY,
} from "./config.js";
import { getMCPServer } from "./mcp/server.js";
import { basicAuthMiddleware, generateWsToken, isBasicAuthEnabled } from "./middleware/auth.js";
import { corsMiddleware } from "./middleware/cors.js";
import { mediumRateLimit, strictRateLimit } from "./middleware/rate-limiter.js";
import { csrfProtection, generateCSRFToken, securityHeaders } from "./middleware/security.js";
import { createAgentBridgeRouter } from "./routes/agent-bridge.js";
import { getAllAgents, initializeAgentRouter, registerAgent } from "./routes/agents.js";
import { createContextManagerRouter } from "./routes/context-manager.js";
import { createDeckRouter } from "./routes/decks.js";
import { createFileRouter } from "./routes/files.js";
import { createGitRouter } from "./routes/git.js";
import { createLocalServerRouter } from "./routes/local-server.js";
import { createSettingsRouter } from "./routes/settings.js";
import { createSharedResourcesRouter } from "./routes/shared-resources.js";
import { createTerminalRouter } from "./routes/terminals.js";
import { createTunnelRouter } from "./routes/tunnel.js";
import { createWorkspaceRouter, getConfigHandler } from "./routes/workspaces.js";
import type { Deck, TerminalSession, Workspace } from "./types.js";
import {
  checkDatabaseIntegrity,
  handleDatabaseCorruption,
  initializeDatabase,
  loadPersistedState,
  loadPersistedTerminals,
  saveAllTerminalBuffers,
} from "./utils/database.js";
import {
  clearAllConnections,
  getConnectionLimit,
  getConnectionStats,
  setConnectionLimit,
  setupWebSocketServer,
} from "./websocket.js";

// Request ID and logging middleware
const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  // Use existing request ID or generate new one
  const requestId = c.req.header("x-request-id") || crypto.randomUUID().slice(0, 8);
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);

  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Log in production or if DEBUG is set
  if (NODE_ENV === "production" || process.env.DEBUG) {
    console.log(`[${requestId}] ${method} ${path} ${status} ${duration}ms`);
  }
};

export function createServer(portOverride?: number) {
  // Use override port or default from config
  const serverPort = portOverride || PORT;

  // Check database integrity before opening
  if (fsSync.existsSync(dbPath) && !checkDatabaseIntegrity(dbPath)) {
    handleDatabaseCorruption(dbPath);
  }

  // Initialize database
  const db = new DatabaseSync(dbPath);
  initializeDatabase(db);

  // Initialize state
  const workspaces = new Map<string, Workspace>();
  const workspacePathIndex = new Map<string, string>();
  const decks = new Map<string, Deck>();
  const terminals = new Map<string, TerminalSession>();

  // Load persisted state
  loadPersistedState(db, workspaces, workspacePathIndex, decks);

  // Create Hono app
  const app = new Hono();

  // Global middleware
  app.use("*", securityHeaders);
  app.use("*", corsMiddleware);
  app.use("*", requestIdMiddleware);

  // Body size limit for API routes
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: MAX_REQUEST_BODY_SIZE,
      onError: (c) => {
        return c.json({ error: "Request body too large" }, 413);
      },
    })
  );

  // Apply rate limiting to sensitive endpoints
  // Auth endpoints (login attempts)
  app.use("/api/ws-token", strictRateLimit);
  // Agent execution (prevents abuse)
  app.use("/api/agents/*/execute", strictRateLimit);
  app.use("/api/agents/*/send", mediumRateLimit);
  // Configuration changes
  app.use("/api/agents/*/config", mediumRateLimit);
  // File operations
  app.use("/api/file", mediumRateLimit);
  // Terminal operations
  app.use("/api/terminals", mediumRateLimit);

  // Basic auth middleware
  if (basicAuthMiddleware) {
    app.use("/api/*", basicAuthMiddleware);
  }

  // Health check endpoint (no auth required for load balancers)
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Initialize agents
  const claudeAgent = new ClaudeAgent();
  const codexAgent = new CodexAgent();
  const copilotAgent = new CopilotAgent();
  const cursorAgent = new CursorAgent();
  const kimiAgent = new KimiAgent();
  registerAgent(claudeAgent);
  registerAgent(codexAgent);
  registerAgent(copilotAgent);
  registerAgent(cursorAgent);
  registerAgent(kimiAgent);

  // Initialize MCP Server for agent-to-agent communication
  const mcpServer = getMCPServer();

  // Initialize agent router
  const agentRouter = initializeAgentRouter();

  // Mount routers
  app.route("/api/settings", createSettingsRouter());
  app.route("/api/workspaces", createWorkspaceRouter(db, workspaces, workspacePathIndex));
  app.route("/api/decks", createDeckRouter(db, workspaces, decks));
  const { router: terminalRouter, restoreTerminals } = createTerminalRouter(db, decks, terminals);
  app.route("/api/terminals", terminalRouter);
  app.route("/api/git", createGitRouter(workspaces));
  app.route("/api/context-manager", createContextManagerRouter());
  app.route("/api/agents", agentRouter);
  app.route("/api/shared", createSharedResourcesRouter());
  app.route("/api/bridge", createAgentBridgeRouter());
  app.route("/api/mcp", agentRouter);
  app.route("/api/local-server", createLocalServerRouter());
  app.route("/api/tunnel", createTunnelRouter());

  // Restore persisted terminals
  const persistedTerminals = loadPersistedTerminals(db, decks);
  if (persistedTerminals.length > 0) {
    console.log(`[TERMINAL] Restoring ${persistedTerminals.length} terminal(s) from database...`);
    restoreTerminals(persistedTerminals);
  }

  // Config endpoint
  app.get("/api/config", getConfigHandler());

  // MCP servers endpoint (for UI)
  app.get("/api/mcp-status", (c) => {
    const agents = agentRouter ? getAllAgents() : [];
    const servers = agents.map((agent) => ({
      name: agent.id,
      status: "active",
      capabilities: ["messaging", "broadcast", "task-handoff"],
    }));
    return c.json(servers);
  });

  // WebSocket token endpoint (for authenticated WebSocket connections)
  app.get("/api/ws-token", (c) => {
    // Get client IP for token binding
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      c.req.header("cf-connecting-ip") ||
      "unknown";
    return c.json({
      token: generateWsToken(ip),
      authEnabled: isBasicAuthEnabled(),
    });
  });

  // CSRF token endpoint (for state-changing operations)
  app.get("/api/csrf-token", (c) => {
    // Get session identifier (use auth header if available)
    const sessionIdentifier =
      c.req.header("authorization") || c.req.header("x-session-id") || "anonymous";
    return c.json({
      token: generateCSRFToken(sessionIdentifier),
    });
  });

  // Apply CSRF protection to state-changing routes
  // This middleware should be applied after basic auth
  app.use("/api/agents/*/config*", csrfProtection());
  app.use("/api/agents/*/execute", csrfProtection());
  app.use("/api/agents/*/send", csrfProtection());
  app.use("/api/agents/*/mcps", csrfProtection());
  app.use("/api/agents/*/skills", csrfProtection());
  app.use("/api/file", csrfProtection({ ignoreMethods: ["GET"] }));
  app.use("/api/dir", csrfProtection({ ignoreMethods: ["GET"] }));
  app.use("/api/terminals", csrfProtection({ ignoreMethods: ["GET"] }));
  app.use("/api/decks", csrfProtection({ ignoreMethods: ["GET"] }));
  app.use("/api/workspaces", csrfProtection({ ignoreMethods: ["GET"] }));
  app.use("/api/git", csrfProtection({ ignoreMethods: ["GET"] }));

  // WebSocket management endpoints
  app.get("/api/ws/stats", (c) => {
    return c.json({
      limit: getConnectionLimit(),
      connections: getConnectionStats(),
    });
  });

  app.put("/api/ws/limit", async (c) => {
    const body = await c.req.json<{ limit: number }>();
    if (typeof body.limit !== "number" || body.limit < 1) {
      return c.json({ error: "Invalid limit value" }, 400);
    }
    setConnectionLimit(body.limit);
    return c.json({ limit: getConnectionLimit() });
  });

  app.post("/api/ws/clear", (c) => {
    const closedCount = clearAllConnections();
    return c.json({ cleared: closedCount });
  });

  // File routes - mount at /api to handle /api/files, /api/preview, /api/file
  const fileRouter = createFileRouter(workspaces);
  app.route("/api", fileRouter);

  // Serve static files
  if (hasStatic) {
    const serveAssets = serveStatic({ root: distDir });
    const serveIndex = serveStatic({ root: distDir, path: "index.html" });
    app.use("/assets/*", serveAssets);
    app.get("*", async (c, next) => {
      if (c.req.path.startsWith("/api")) {
        return c.text("Not found", 404);
      }
      return serveIndex(c, next);
    });
  }

  // Start server
  const server = serve({ fetch: app.fetch, port: serverPort, hostname: HOST }) as Server;

  // Setup WebSocket
  setupWebSocketServer(server, terminals);

  // Server startup
  server.on("listening", () => {
    const baseUrl = `http://localhost:${serverPort}`;
    console.log(`Deck IDE server listening on ${baseUrl}`);
    console.log(`UI: ${baseUrl}`);
    console.log(`API: ${baseUrl}/api`);
    console.log(`Health: ${baseUrl}/health`);
    console.log("");
    console.log("Security Status:");
    console.log(
      `  - Basic Auth: ${BASIC_AUTH_USER && BASIC_AUTH_PASSWORD ? `enabled (user: ${BASIC_AUTH_USER})` : "DISABLED (WARNING: API is publicly accessible!)"}`
    );
    console.log(`  - Max File Size: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
    console.log(`  - Max Request Body: ${Math.round(MAX_REQUEST_BODY_SIZE / 1024)}KB`);
    console.log(`  - Trust Proxy: ${TRUST_PROXY ? "enabled" : "disabled"}`);
    console.log(
      `  - CORS Origin: ${CORS_ORIGIN || (NODE_ENV === "development" ? "*" : "NOT SET")}`
    );
    console.log(`  - Environment: ${NODE_ENV}`);
  });

  // Graceful shutdown handler - save terminal buffers and close database
  const saveTerminalBuffersOnShutdown = () => {
    if (terminals.size > 0) {
      console.log(`[SHUTDOWN] Saving ${terminals.size} terminal buffer(s)...`);
      saveAllTerminalBuffers(db, terminals);
      console.log("[SHUTDOWN] Terminal buffers saved.");
    }
    // Close database connection to prevent corruption
    try {
      db.close();
      console.log("[SHUTDOWN] Database closed.");
    } catch (e) {
      console.error("[SHUTDOWN] Error closing database:", e);
    }
  };

  // Handle various shutdown signals
  process.on("SIGINT", () => {
    console.log("\n[SHUTDOWN] Received SIGINT, saving state...");
    saveTerminalBuffersOnShutdown();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("[SHUTDOWN] Received SIGTERM, saving state...");
    saveTerminalBuffersOnShutdown();
    process.exit(0);
  });

  // Handle Windows shutdown (Ctrl+C in cmd/powershell)
  if (process.platform === "win32") {
    process.on("SIGHUP", () => {
      console.log("[SHUTDOWN] Received SIGHUP, saving state...");
      saveTerminalBuffersOnShutdown();
      process.exit(0);
    });
  }

  // Handle uncaught exceptions - try to save state before crashing
  const originalExceptionHandler = process.listeners("uncaughtException")[0] as
    | ((err: Error) => void)
    | undefined;
  process.removeAllListeners("uncaughtException");
  process.on("uncaughtException", (error: Error) => {
    // Suppress known node-pty ConPTY errors that don't affect functionality
    if (error.message?.includes("AttachConsole failed")) {
      console.log("[node-pty] AttachConsole error suppressed (terminal already exited)");
      return;
    }
    console.error("[SHUTDOWN] Uncaught exception, saving state before exit...");
    saveTerminalBuffersOnShutdown();
    if (originalExceptionHandler) {
      originalExceptionHandler(error);
    } else {
      console.error("Uncaught exception:", error);
      process.exit(1);
    }
  });

  return server;
}
