# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**S-IDE** (Side Studio IDE) is an AI-optimized development environment with multi-terminal support, Monaco Editor integration, and built-in Git operations. It's a monorepo built with pnpm workspaces.

### Architecture

```
apps/
├── web/         # React 18 + Vite frontend (PWA)
├── server/      # Hono + Node.js backend API
├── desktop/     # Tauri 2.0 desktop app (Rust backend)
└── mobile/      # React Native mobile app

packages/
├── shared/      # Shared types and utilities (no src/, compiles in place)
└── ui/          # Shared React components (Button, Input, Modal, Select)
```

**Key architectural patterns:**
- **Server-first architecture**: Desktop app auto-starts the Node.js server as a sidecar process
- **Agent system**: Extensible AI agent framework with Claude, Codex, Copilot, Cursor, Kimi
- **WebSocket terminals**: Real-time terminal streaming via xterm.js + node-pty
- **MCP (Model Context Protocol)**: Built-in agent-to-agent communication bridge
- **Context Manager**: Advanced conversation health monitoring and compaction

## Common Commands

```bash
# Development
pnpm run dev                # Run web dev server
pnpm run dev:server         # Run server in dev mode (tsx watch)
pnpm run dev:desktop        # Run desktop app (auto-starts server)

# Building
pnpm run build              # Build web + server + desktop
pnpm run build:web          # Build web frontend
pnpm run build:server       # Build server (tsc)
pnpm run build:desktop      # Build desktop app (includes web+server)
pnpm run bundle:server      # Bundle server for desktop (pkg)

# Linting & Type Checking
pnpm run lint               # Biome check
pnpm run lint:fix           # Biome check --write --unsafe
pnpm run format             # Biome format --write
pnpm run type-check         # Type-check all workspaces

# Testing (currently minimal)
pnpm run test               # Run all tests
```

## Tech Stack

**Frontend:** React 18, TypeScript, Vite, Monaco Editor, xterm.js, Lucide React
**Backend:** Hono, Node.js, better-sqlite3, node-pty, simple-git, ws (WebSocket)
**Desktop:** Tauri 2.0, Rust (server auto-start via sidecar)
**Tools:** Biome (linting), TypeScript, pnpm (workspaces)

## Server Architecture

The server (`apps/server/src/`) uses a modular router pattern:

- **`server.ts`**: Main entry point, creates Hono app, initializes agents, sets up middleware
- **`routes/`**: Individual route modules (workspaces, decks, terminals, git, files, agents, context-manager)
- **`middleware/`**: Security, auth, CORS, rate limiting, CSRF protection
- **`agents/`**: Base `AgentInterface` + implementations (Claude, Codex, Copilot, Cursor, Kimi)
- **`websocket.ts`**: Terminal WebSocket server with connection pooling
- **`utils/database.ts`**: SQLite persistence for decks, workspaces, terminals
- **`mcp/server.ts`**: Model Context Protocol server for agent bridge

**Key middleware order:** securityHeaders → cors → requestId → bodyLimit → rateLimit → basicAuth → csrfProtection

## Frontend Architecture

The web app (`apps/web/src/`) is organized by feature:

- **`App.tsx`**: Main app orchestrator with deck/workspaces state
- **`components/`**: React components organized by feature (EditorPane, TerminalPane, SourceControl, etc.)
- **`contexts/`**: React Context for global state
- **`hooks/`**: Custom hooks (useTerminal, useAgent, etc.)
- **`api.ts`**: Centralized API client with WebSocket management
- **`features/`**: Feature-specific modules (AI workflow, context manager)

## Development Notes

1. **Shared package compiles in-place** - No `src/` directory, `.ts` files are at package root. Run `pnpm -F @side-ide/shared run build` after changes.

2. **Server hot-reload** - Use `tsx src/index.ts` for dev mode. Built JS files (`.js`) coexist with source (`.ts`).

3. **Desktop app** - The Tauri Rust backend (`src-tauri/`) auto-starts the bundled Node.js server. No manual server management needed.

4. **WebSocket terminals** - Terminals are spawned via `node-pty` (Windows) or native `pty` (Unix/macOS). Buffers persist to SQLite.

5. **Agent system** - Each agent implements `AgentInterface` interface. Register agents in `server.ts` via `registerAgent()`.

6. **Path traversal security** - All file operations validate paths against workspace root. See `utils/path.ts`.

7. **Git operations** - Uses `simple-git` library. Multi-repo support via `git/multi-status` endpoint.

8. **Biome** - Replaces ESLint/Prettier. Run `pnpm run lint:fix` to auto-fix issues.

## Environment Variables

Server defaults (see `apps/server/src/config.ts`):
- `PORT=8787`, `HOST=0.0.0.0`
- `DEFAULT_ROOT`: User's home directory
- `MAX_FILE_SIZE=10485760` (10MB)
- `TERMINAL_BUFFER_LIMIT=50000`
- `BASIC_AUTH_USER/PASSWORD`: Optional basic auth
- `CORS_ORIGIN`: CORS origin for production

## Database

SQLite database at `apps/server/data/deck-ide.db` stores:
- Workspaces (id, name, path)
- Decks (id, name, root, workspaceId)
- Terminals (id, deckId, command, cwd, buffer)

Database integrity is checked on startup; corrupted files are backed up and recreated.

## Mobile & Desktop

- **Desktop**: Tauri 2.0 with Rust backend. Bundles web+server. Uses sidecar process for Node.js server.
- **Mobile**: React Native (currently minimal implementation).

## Agent Bridge

The `/api/bridge` endpoints enable cross-agent communication via MCP (Model Context Protocol). Agents can share tools, skills, and context.

## Context Manager

Advanced conversation health tracking at `/api/context-manager`:
- Health score (0-100) based on message density, drift, errors
- Topic drift detection via semantic analysis
- Session compaction (summarizes old messages)
- Snapshot/restore for conversation states
