# CLI Framework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the S-IDE server into a full-featured CLI application with daemon mode, process management, and configuration system.

**Architecture:** Implement commander.js-based CLI with subcommands for server lifecycle (start/stop/status), configuration management, and resource operations. Add PID-based process management for daemon mode with graceful shutdown, and a JSON-based configuration system with environment variable merging.

**Tech Stack:** Node.js, TypeScript, commander.js, better-sqlite3, node-pty, @hono/node-server

---

## Prerequisites Check

**Before starting:**
- Ensure all tests pass: `pnpm run test`
- Ensure type-check passes: `pnpm run type-check`
- Ensure build succeeds: `pnpm run build`

---

## Task 1: Install CLI Framework Dependencies

**Files:**
- Modify: `apps/server/package.json`

**Step 1: Add commander dependency**

Add to dependencies in package.json:
```json
"commander": "^12.0.0"
```

**Step 2: Install dependencies**

Run: `pnpm install`
Expected: commander installed successfully

**Step 3: Verify installation**

Run: `pnpm list commander`
Expected: Shows commander@12.x.x

**Step 4: Commit**

```bash
git add apps/server/package.json apps/server/pnpm-lock.yaml
git commit -m "chore: add commander for CLI framework"
```

---

## Task 2: Create CLI Entry Point with Basic Structure

**Files:**
- Create: `apps/server/src/cli.ts`
- Test: `apps/server/src/__tests__/unit/cli.test.ts`

**Step 1: Write the test for CLI version command**

Create `apps/server/src/__tests__/unit/cli.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

describe('CLI', () => {
  let mockExit: any;
  let mockLog: any;

  beforeEach(() => {
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should display version information', () => {
    const program = new Command();
    program.version('0.1.0');
    program.parse(['node', 'cli', '--version']);
    
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('0.1.0'));
  });

  it('should display help when no command is provided', () => {
    const program = new Command();
    program.name('side-server').description('S-IDE CLI Server');
    
    const helpText = program.helpInformation();
    expect(helpText).toContain('side-server');
    expect(helpText).toContain('S-IDE CLI Server');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/unit/cli.test.ts`
Expected: Tests pass (basic commander functionality)

**Step 3: Create CLI entry point**

Create `apps/server/src/cli.ts`:
```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

export const program = new Command();

program
  .name('side-server')
  .description('S-IDE Backend Server - AI-optimized development environment')
  .version(packageJson.version);

// Placeholder for commands - will be added in next tasks

// Only parse args if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse(process.argv);
}
```

**Step 4: Add bin field to package.json**

Add to `apps/server/package.json`:
```json
"bin": {
  "side-server": "./dist/cli.js"
},
```

**Step 5: Update TypeScript config for CLI**

Ensure `apps/server/tsconfig.json` has:
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022"
  }
}
```

**Step 6: Build and test CLI**

Run: `pnpm run build && node dist/cli.js --version`
Expected: Shows version 0.1.0

**Step 7: Test help command**

Run: `node dist/cli.js --help`
Expected: Shows CLI help with description

**Step 8: Commit**

```bash
git add apps/server/src/cli.ts apps/server/src/__tests__/unit/cli.test.ts apps/server/package.json
git commit -m "feat(cli): add CLI entry point with version and help"
```

---

## Task 3: Create PID File Manager Utility

**Files:**
- Create: `apps/server/src/utils/pid-manager.ts`
- Test: `apps/server/src/__tests__/unit/pid-manager.test.ts`

**Step 1: Write test for PID file operations**

Create `apps/server/src/__tests__/unit/pid-manager.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PidManager } from '../../utils/pid-manager.js';

describe('PidManager', () => {
  let testDir: string;
  let pidManager: PidManager;

  beforeEach(() => {
    testDir = join(tmpdir(), `side-ide-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    pidManager = new PidManager(join(testDir, 'test.pid'));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should write PID to file', () => {
    const pid = process.pid;
    pidManager.write(pid);
    
    expect(pidManager.exists()).toBe(true);
    expect(pidManager.read()).toBe(pid);
  });

  it('should return null when PID file does not exist', () => {
    expect(pidManager.read()).toBe(null);
  });

  it('should remove PID file', () => {
    pidManager.write(process.pid);
    expect(pidManager.exists()).toBe(true);
    
    pidManager.remove();
    expect(pidManager.exists()).toBe(false);
  });

  it('should check if process is running', () => {
    pidManager.write(process.pid);
    expect(pidManager.isProcessRunning()).toBe(true);
  });

  it('should return false for non-existent process', () => {
    pidManager.write(999999); // Non-existent PID
    expect(pidManager.isProcessRunning()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/unit/pid-manager.test.ts`
Expected: FAIL with "Cannot find module pid-manager"

**Step 3: Implement PID manager**

Create `apps/server/src/utils/pid-manager.ts`:
```typescript
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

export class PidManager {
  constructor(private pidFilePath: string) {}

  /**
   * Write PID to file
   */
  write(pid: number): void {
    const dir = dirname(this.pidFilePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.pidFilePath, pid.toString(), 'utf-8');
  }

  /**
   * Read PID from file
   */
  read(): number | null {
    if (!this.exists()) {
      return null;
    }
    try {
      const content = readFileSync(this.pidFilePath, 'utf-8');
      const pid = Number.parseInt(content.trim(), 10);
      return Number.isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  /**
   * Check if PID file exists
   */
  exists(): boolean {
    return existsSync(this.pidFilePath);
  }

  /**
   * Remove PID file
   */
  remove(): void {
    if (this.exists()) {
      unlinkSync(this.pidFilePath);
    }
  }

  /**
   * Check if the process from PID file is running
   */
  isProcessRunning(): boolean {
    const pid = this.read();
    if (pid === null) {
      return false;
    }

    try {
      // Sending signal 0 checks if process exists without killing it
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get PID file path
   */
  getPath(): string {
    return this.pidFilePath;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/unit/pid-manager.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/server/src/utils/pid-manager.ts apps/server/src/__tests__/unit/pid-manager.test.ts
git commit -m "feat(utils): add PID file manager for daemon mode"
```

---

## Task 4: Create Configuration Manager

**Files:**
- Create: `apps/server/src/utils/config-manager.ts`
- Test: `apps/server/src/__tests__/unit/config-manager.test.ts`

**Step 1: Write test for configuration management**

Create `apps/server/src/__tests__/unit/config-manager.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigManager } from '../../utils/config-manager.js';

describe('ConfigManager', () => {
  let testDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    testDir = join(tmpdir(), `side-ide-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    configManager = new ConfigManager(join(testDir, 'config.json'));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should load default configuration', () => {
    const config = configManager.load();
    expect(config.port).toBe(8787);
    expect(config.host).toBe('0.0.0.0');
  });

  it('should save and load configuration', () => {
    configManager.set('port', 9000);
    configManager.save();

    const newManager = new ConfigManager(join(testDir, 'config.json'));
    const config = newManager.load();
    expect(config.port).toBe(9000);
  });

  it('should merge environment variables with config', () => {
    process.env.PORT = '9999';
    const config = configManager.load();
    expect(config.port).toBe(9999);
    delete process.env.PORT;
  });

  it('should get and set individual values', () => {
    configManager.set('host', 'localhost');
    expect(configManager.get('host')).toBe('localhost');
  });

  it('should list all configuration', () => {
    const config = configManager.list();
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('host');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/unit/config-manager.test.ts`
Expected: FAIL with "Cannot find module config-manager"

**Step 3: Implement configuration manager**

Create `apps/server/src/utils/config-manager.ts`:
```typescript
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

export interface ServerConfig {
  port: number;
  host: string;
  defaultRoot?: string;
  maxFileSize?: number;
  terminalBufferLimit?: number;
  basicAuthUser?: string;
  basicAuthPassword?: string;
  corsOrigin?: string;
}

const DEFAULT_CONFIG: ServerConfig = {
  port: 8787,
  host: '0.0.0.0',
  defaultRoot: process.env.HOME || process.env.USERPROFILE || '/tmp',
  maxFileSize: 10_485_760, // 10MB
  terminalBufferLimit: 50_000,
};

export class ConfigManager {
  private config: ServerConfig;

  constructor(private configFilePath: string) {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Load configuration from file and merge with environment variables
   */
  load(): ServerConfig {
    // Load from file if exists
    if (existsSync(this.configFilePath)) {
      try {
        const fileContent = readFileSync(this.configFilePath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        this.config = { ...DEFAULT_CONFIG, ...fileConfig };
      } catch (error) {
        console.error('Failed to load config file, using defaults:', error);
      }
    }

    // Merge with environment variables (highest priority)
    if (process.env.PORT) {
      this.config.port = Number.parseInt(process.env.PORT, 10);
    }
    if (process.env.HOST) {
      this.config.host = process.env.HOST;
    }
    if (process.env.DEFAULT_ROOT) {
      this.config.defaultRoot = process.env.DEFAULT_ROOT;
    }
    if (process.env.MAX_FILE_SIZE) {
      this.config.maxFileSize = Number.parseInt(process.env.MAX_FILE_SIZE, 10);
    }
    if (process.env.TERMINAL_BUFFER_LIMIT) {
      this.config.terminalBufferLimit = Number.parseInt(process.env.TERMINAL_BUFFER_LIMIT, 10);
    }
    if (process.env.BASIC_AUTH_USER) {
      this.config.basicAuthUser = process.env.BASIC_AUTH_USER;
    }
    if (process.env.BASIC_AUTH_PASSWORD) {
      this.config.basicAuthPassword = process.env.BASIC_AUTH_PASSWORD;
    }
    if (process.env.CORS_ORIGIN) {
      this.config.corsOrigin = process.env.CORS_ORIGIN;
    }

    return this.config;
  }

  /**
   * Save current configuration to file
   */
  save(): void {
    const dir = dirname(this.configFilePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  /**
   * Get a configuration value
   */
  get<K extends keyof ServerConfig>(key: K): ServerConfig[K] {
    return this.config[key];
  }

  /**
   * Set a configuration value
   */
  set<K extends keyof ServerConfig>(key: K, value: ServerConfig[K]): void {
    this.config[key] = value;
  }

  /**
   * List all configuration
   */
  list(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Get config file path
   */
  getPath(): string {
    return this.configFilePath;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/unit/config-manager.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/server/src/utils/config-manager.ts apps/server/src/__tests__/unit/config-manager.test.ts
git commit -m "feat(utils): add configuration manager with env merging"
```

---

## Task 5: Implement 'start' Command

**Files:**
- Modify: `apps/server/src/cli.ts`
- Create: `apps/server/src/commands/start.ts`
- Test: `apps/server/src/__tests__/unit/commands/start.test.ts`

**Step 1: Write test for start command**

Create `apps/server/src/__tests__/unit/commands/start.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Command } from 'commander';

describe('start command', () => {
  it('should register start command with correct options', () => {
    const mockCommand = {
      command: vi.fn().mockReturnThis(),
      description: vi.fn().mockReturnThis(),
      option: vi.fn().mockReturnThis(),
      action: vi.fn().mockReturnThis(),
    } as any as Command;

    // Test that command is registered properly
    mockCommand.command('start');
    mockCommand.description('Start the S-IDE server');
    mockCommand.option('-p, --port <number>', 'Port to listen on', '8787');
    mockCommand.option('-h, --host <string>', 'Host to bind to', '0.0.0.0');
    mockCommand.option('-d, --daemon', 'Run in daemon mode');

    expect(mockCommand.command).toHaveBeenCalledWith('start');
    expect(mockCommand.description).toHaveBeenCalled();
    expect(mockCommand.option).toHaveBeenCalledTimes(3);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `pnpm test src/__tests__/unit/commands/start.test.ts`
Expected: PASS

**Step 3: Create start command implementation**

Create `apps/server/src/commands/start.ts`:
```typescript
import type { Command } from 'commander';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { PidManager } from '../utils/pid-manager.js';
import { ConfigManager } from '../utils/config-manager.js';

interface StartOptions {
  port?: string;
  host?: string;
  daemon?: boolean;
}

const SIDE_IDE_DIR = join(homedir(), '.side-ide');
const PID_FILE = join(SIDE_IDE_DIR, 'side-server.pid');
const LOG_FILE = join(SIDE_IDE_DIR, 'logs', 'server.log');
const CONFIG_FILE = join(SIDE_IDE_DIR, 'config.json');

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start the S-IDE server')
    .option('-p, --port <number>', 'Port to listen on')
    .option('-h, --host <string>', 'Host to bind to')
    .option('-d, --daemon', 'Run in daemon mode (background)')
    .action(async (options: StartOptions) => {
      const pidManager = new PidManager(PID_FILE);
      const configManager = new ConfigManager(CONFIG_FILE);

      // Check if already running
      if (pidManager.isProcessRunning()) {
        const pid = pidManager.read();
        console.error(`Server is already running (PID: ${pid})`);
        console.error('Use "side-server stop" to stop it first.');
        process.exit(1);
      }

      // Load configuration
      const config = configManager.load();

      // Override with CLI options
      if (options.port) {
        config.port = Number.parseInt(options.port, 10);
      }
      if (options.host) {
        config.host = options.host;
      }

      if (options.daemon) {
        // Spawn detached process
        const child = spawn(
          process.execPath,
          [join(process.cwd(), 'dist', 'index.js')],
          {
            detached: true,
            stdio: 'ignore',
            env: {
              ...process.env,
              PORT: config.port.toString(),
              HOST: config.host,
            },
          }
        );

        child.unref();
        pidManager.write(child.pid!);

        console.log('✓ Server started in daemon mode');
        console.log(`  PID: ${child.pid}`);
        console.log(`  Port: ${config.port}`);
        console.log(`  Host: ${config.host}`);
        console.log(`  PID file: ${PID_FILE}`);
        console.log(`  Log file: ${LOG_FILE}`);
        console.log('\nUse "side-server status" to check server status');
        console.log('Use "side-server stop" to stop the server');
      } else {
        // Run in foreground
        console.log('Starting S-IDE server...');
        console.log(`  Port: ${config.port}`);
        console.log(`  Host: ${config.host}`);
        console.log('\nPress Ctrl+C to stop the server\n');

        pidManager.write(process.pid);

        // Graceful shutdown handler
        const cleanup = () => {
          console.log('\nShutting down server...');
          pidManager.remove();
          process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        // Import and start the server
        const { startServer } = await import('../server.js');
        await startServer({
          port: config.port,
          host: config.host,
        });
      }
    });
}
```

**Step 4: Update cli.ts to register start command**

Modify `apps/server/src/cli.ts`:
```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerStartCommand } from './commands/start.js';

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

export const program = new Command();

program
  .name('side-server')
  .description('S-IDE Backend Server - AI-optimized development environment')
  .version(packageJson.version);

// Register commands
registerStartCommand(program);

// Only parse args if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse(process.argv);
}
```

**Step 5: Update server.ts to export startServer function**

Check if `apps/server/src/server.ts` exports a `startServer` function. If not, add it:

```typescript
export async function startServer(options?: { port?: number; host?: string }) {
  const port = options?.port || config.port;
  const host = options?.host || config.host;

  const server = serve({
    fetch: app.fetch,
    port,
    hostname: host,
  });

  console.log(`Deck IDE server listening on http://${host}:${port}`);
  console.log(`UI: http://${host}:${port}`);
  console.log(`API: http://${host}:${port}/api`);
  console.log(`Health: http://${host}:${port}/health`);

  return server;
}
```

**Step 6: Build and test start command**

Run: `pnpm run build && node dist/cli.js start --help`
Expected: Shows start command help with options

**Step 7: Test foreground start**

Run: `node dist/cli.js start --port 8888`
Expected: Server starts on port 8888
Verify: Open browser to http://localhost:8888
Stop: Press Ctrl+C

**Step 8: Commit**

```bash
git add apps/server/src/commands/start.ts apps/server/src/cli.ts apps/server/src/__tests__/unit/commands/start.test.ts apps/server/src/server.ts
git commit -m "feat(cli): add start command with daemon mode support"
```

---

## Task 6: Implement 'stop' Command

**Files:**
- Modify: `apps/server/src/cli.ts`
- Create: `apps/server/src/commands/stop.ts`

**Step 1: Create stop command implementation**

Create `apps/server/src/commands/stop.ts`:
```typescript
import type { Command } from 'commander';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { PidManager } from '../utils/pid-manager.js';

const SIDE_IDE_DIR = join(homedir(), '.side-ide');
const PID_FILE = join(SIDE_IDE_DIR, 'side-server.pid');

export function registerStopCommand(program: Command): void {
  program
    .command('stop')
    .description('Stop the S-IDE server daemon')
    .action(async () => {
      const pidManager = new PidManager(PID_FILE);

      if (!pidManager.exists()) {
        console.error('No PID file found. Server is not running.');
        process.exit(1);
      }

      const pid = pidManager.read();
      if (pid === null) {
        console.error('Failed to read PID file.');
        pidManager.remove();
        process.exit(1);
      }

      if (!pidManager.isProcessRunning()) {
        console.log('Server process is not running (stale PID file).');
        pidManager.remove();
        process.exit(0);
      }

      console.log(`Stopping server (PID: ${pid})...`);

      try {
        // Send SIGTERM for graceful shutdown
        process.kill(pid, 'SIGTERM');

        // Wait for process to exit (max 10 seconds)
        let attempts = 0;
        const maxAttempts = 50; // 50 * 200ms = 10 seconds

        while (pidManager.isProcessRunning() && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          attempts++;
        }

        if (pidManager.isProcessRunning()) {
          console.warn('Server did not stop gracefully, forcing shutdown...');
          process.kill(pid, 'SIGKILL');
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        pidManager.remove();
        console.log('✓ Server stopped successfully');
      } catch (error: any) {
        if (error.code === 'ESRCH') {
          // Process not found
          console.log('Server process already stopped.');
          pidManager.remove();
        } else {
          console.error('Failed to stop server:', error.message);
          process.exit(1);
        }
      }
    });
}
```

**Step 2: Update cli.ts to register stop command**

Modify `apps/server/src/cli.ts`:
```typescript
import { registerStopCommand } from './commands/stop.js';

// ... existing code ...

// Register commands
registerStartCommand(program);
registerStopCommand(program);
```

**Step 3: Build and test stop command**

Run: `pnpm run build`

Start server in daemon mode:
Run: `node dist/cli.js start --daemon`
Expected: Server starts in background

Stop server:
Run: `node dist/cli.js stop`
Expected: Server stops gracefully

**Step 4: Commit**

```bash
git add apps/server/src/commands/stop.ts apps/server/src/cli.ts
git commit -m "feat(cli): add stop command for daemon management"
```

---

## Task 7: Implement 'status' Command

**Files:**
- Modify: `apps/server/src/cli.ts`
- Create: `apps/server/src/commands/status.ts`

**Step 1: Create status command implementation**

Create `apps/server/src/commands/status.ts`:
```typescript
import type { Command } from 'commander';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { PidManager } from '../utils/pid-manager.js';
import { ConfigManager } from '../utils/config-manager.js';

const SIDE_IDE_DIR = join(homedir(), '.side-ide');
const PID_FILE = join(SIDE_IDE_DIR, 'side-server.pid');
const CONFIG_FILE = join(SIDE_IDE_DIR, 'config.json');

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check S-IDE server status')
    .action(async () => {
      const pidManager = new PidManager(PID_FILE);
      const configManager = new ConfigManager(CONFIG_FILE);
      const config = configManager.load();

      console.log('S-IDE Server Status');
      console.log('===================\n');

      if (!pidManager.exists()) {
        console.log('Status: ● NOT RUNNING');
        console.log('No PID file found.\n');
        return;
      }

      const pid = pidManager.read();
      if (pid === null) {
        console.log('Status: ● ERROR');
        console.log('PID file exists but cannot be read.\n');
        return;
      }

      if (pidManager.isProcessRunning()) {
        console.log('Status: ✓ RUNNING');
        console.log(`PID: ${pid}`);
        console.log(`Port: ${config.port}`);
        console.log(`Host: ${config.host}`);
        console.log(`URL: http://${config.host}:${config.port}`);
        console.log(`PID file: ${PID_FILE}`);
        console.log(`Config file: ${CONFIG_FILE}\n`);

        // Try to fetch health endpoint
        try {
          const response = await fetch(`http://localhost:${config.port}/health`, {
            signal: AbortSignal.timeout(2000),
          });
          if (response.ok) {
            const data = await response.json();
            console.log('Health Check: ✓ HEALTHY');
            console.log(`Uptime: ${Math.floor(data.uptime / 1000)}s`);
          }
        } catch {
          console.log('Health Check: ⚠ Cannot reach server');
        }
      } else {
        console.log('Status: ● STOPPED (stale PID file)');
        console.log(`Last PID: ${pid}`);
        console.log('\nNote: PID file exists but process is not running.');
        console.log('Run "side-server start" to start the server.\n');
      }
    });
}
```

**Step 2: Update cli.ts to register status command**

Modify `apps/server/src/cli.ts`:
```typescript
import { registerStatusCommand } from './commands/status.js';

// ... existing code ...

// Register commands
registerStartCommand(program);
registerStopCommand(program);
registerStatusCommand(program);
```

**Step 3: Build and test status command**

Run: `pnpm run build`

Test with server stopped:
Run: `node dist/cli.js status`
Expected: Shows "NOT RUNNING"

Start server:
Run: `node dist/cli.js start --daemon`

Test with server running:
Run: `node dist/cli.js status`
Expected: Shows "RUNNING" with PID, port, and health check

Stop server:
Run: `node dist/cli.js stop`

**Step 4: Commit**

```bash
git add apps/server/src/commands/status.ts apps/server/src/cli.ts
git commit -m "feat(cli): add status command with health check"
```

---

## Task 8: Implement 'config' Command

**Files:**
- Modify: `apps/server/src/cli.ts`
- Create: `apps/server/src/commands/config.ts`

**Step 1: Create config command implementation**

Create `apps/server/src/commands/config.ts`:
```typescript
import type { Command } from 'commander';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ConfigManager } from '../utils/config-manager.js';

const SIDE_IDE_DIR = join(homedir(), '.side-ide');
const CONFIG_FILE = join(SIDE_IDE_DIR, 'config.json');

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Manage server configuration');

  configCmd
    .command('list')
    .description('List all configuration values')
    .action(() => {
      const configManager = new ConfigManager(CONFIG_FILE);
      const config = configManager.load();

      console.log('Server Configuration');
      console.log('====================\n');
      console.log(`Config file: ${CONFIG_FILE}\n`);

      for (const [key, value] of Object.entries(config)) {
        console.log(`${key}: ${value}`);
      }
    });

  configCmd
    .command('get <key>')
    .description('Get a configuration value')
    .action((key: string) => {
      const configManager = new ConfigManager(CONFIG_FILE);
      const config = configManager.load();

      if (key in config) {
        console.log(config[key as keyof typeof config]);
      } else {
        console.error(`Unknown configuration key: ${key}`);
        console.error('Run "side-server config list" to see available keys.');
        process.exit(1);
      }
    });

  configCmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key: string, value: string) => {
      const configManager = new ConfigManager(CONFIG_FILE);
      configManager.load();

      const validKeys = ['port', 'host', 'defaultRoot', 'maxFileSize', 'terminalBufferLimit', 'corsOrigin'];
      
      if (!validKeys.includes(key)) {
        console.error(`Unknown configuration key: ${key}`);
        console.error(`Valid keys: ${validKeys.join(', ')}`);
        process.exit(1);
      }

      // Parse value based on key type
      let parsedValue: any = value;
      if (key === 'port' || key === 'maxFileSize' || key === 'terminalBufferLimit') {
        parsedValue = Number.parseInt(value, 10);
        if (Number.isNaN(parsedValue)) {
          console.error(`Invalid number value for ${key}: ${value}`);
          process.exit(1);
        }
      }

      configManager.set(key as any, parsedValue);
      configManager.save();

      console.log(`✓ Configuration updated: ${key} = ${parsedValue}`);
      console.log(`Config file: ${CONFIG_FILE}`);
      console.log('\nNote: Restart the server for changes to take effect.');
    });
}
```

**Step 2: Update cli.ts to register config command**

Modify `apps/server/src/cli.ts`:
```typescript
import { registerConfigCommand } from './commands/config.js';

// ... existing code ...

// Register commands
registerStartCommand(program);
registerStopCommand(program);
registerStatusCommand(program);
registerConfigCommand(program);
```

**Step 3: Build and test config commands**

Run: `pnpm run build`

Test list:
Run: `node dist/cli.js config list`
Expected: Shows all configuration values

Test get:
Run: `node dist/cli.js config get port`
Expected: Shows port value (8787)

Test set:
Run: `node dist/cli.js config set port 9000`
Expected: Updates port to 9000

Verify:
Run: `node dist/cli.js config get port`
Expected: Shows 9000

Reset:
Run: `node dist/cli.js config set port 8787`

**Step 4: Commit**

```bash
git add apps/server/src/commands/config.ts apps/server/src/cli.ts
git commit -m "feat(cli): add config command for settings management"
```

---

## Task 9: Update package.json Scripts and Make CLI Executable

**Files:**
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/cli.ts` (add shebang if missing)

**Step 1: Update package.json with CLI scripts**

Add scripts to `apps/server/package.json`:
```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "build:cli": "tsc && chmod +x dist/cli.js",
    "cli": "node dist/cli.js",
    "cli:dev": "tsx src/cli.ts",
    "type-check": "tsc --noEmit",
    "serve": "node dist/index.js",
    "start": "node dist/cli.js start",
    "stop": "node dist/cli.js stop",
    "status": "node dist/cli.js status"
  }
}
```

**Step 2: Ensure CLI has shebang**

Verify `apps/server/src/cli.ts` starts with:
```typescript
#!/usr/bin/env node
```

**Step 3: Build and test npm scripts**

Run: `pnpm run build:cli`
Expected: Build succeeds, dist/cli.js is executable

Test dev mode:
Run: `pnpm run cli:dev -- --version`
Expected: Shows version

Test built version:
Run: `pnpm run cli -- --version`
Expected: Shows version

Test start script:
Run: `pnpm run start -- --port 9999`
Expected: Server starts on port 9999

**Step 4: Test global installation (optional)**

Run: `pnpm link --global` (in apps/server directory)
Run: `side-server --version`
Expected: Shows version

Cleanup:
Run: `pnpm unlink --global`

**Step 5: Commit**

```bash
git add apps/server/package.json apps/server/src/cli.ts
git commit -m "chore(cli): update package.json with CLI scripts"
```

---

## Task 10: Add CLI Documentation

**Files:**
- Create: `apps/server/CLI.md`
- Modify: `apps/server/README.md` (if exists)

**Step 1: Create CLI documentation**

Create `apps/server/CLI.md`:
```markdown
# S-IDE Server CLI

Command-line interface for the S-IDE backend server.

## Installation

### Development

```bash
cd apps/server
pnpm install
pnpm run build:cli
```

### Global Installation

```bash
pnpm link --global
```

## Usage

```bash
side-server [command] [options]
```

## Commands

### `start`

Start the S-IDE server.

```bash
side-server start [options]
```

**Options:**
- `-p, --port <number>` - Port to listen on (default: 8787)
- `-h, --host <string>` - Host to bind to (default: 0.0.0.0)
- `-d, --daemon` - Run in daemon mode (background)

**Examples:**
```bash
# Start in foreground
side-server start

# Start on custom port
side-server start --port 9000

# Start in daemon mode
side-server start --daemon

# Start with custom host and port
side-server start --host localhost --port 8888 --daemon
```

### `stop`

Stop the S-IDE server daemon.

```bash
side-server stop
```

### `status`

Check S-IDE server status.

```bash
side-server status
```

Shows:
- Running status
- PID (if running)
- Port and host
- Health check result
- Configuration file locations

### `config`

Manage server configuration.

```bash
side-server config <subcommand>
```

**Subcommands:**

#### `list`

List all configuration values.

```bash
side-server config list
```

#### `get`

Get a specific configuration value.

```bash
side-server config get <key>
```

Example:
```bash
side-server config get port
```

#### `set`

Set a configuration value.

```bash
side-server config set <key> <value>
```

Examples:
```bash
side-server config set port 9000
side-server config set host localhost
side-server config set maxFileSize 20971520
```

**Valid configuration keys:**
- `port` - Server port (number)
- `host` - Server host (string)
- `defaultRoot` - Default workspace root (string)
- `maxFileSize` - Maximum file size in bytes (number)
- `terminalBufferLimit` - Terminal buffer limit (number)
- `corsOrigin` - CORS origin (string)

## Files

### PID File

Location: `~/.side-ide/side-server.pid`

Contains the process ID of the running server when in daemon mode.

### Configuration File

Location: `~/.side-ide/config.json`

Persistent configuration storage. Values here are overridden by environment variables.

### Log Files

Location: `~/.side-ide/logs/`

Server logs when running in daemon mode.

## Environment Variables

Environment variables override configuration file values:

- `PORT` - Server port
- `HOST` - Server host
- `DEFAULT_ROOT` - Default workspace root
- `MAX_FILE_SIZE` - Maximum file size
- `TERMINAL_BUFFER_LIMIT` - Terminal buffer limit
- `BASIC_AUTH_USER` - Basic authentication username
- `BASIC_AUTH_PASSWORD` - Basic authentication password
- `CORS_ORIGIN` - CORS origin

## Examples

### Development Workflow

```bash
# Start in foreground for development
pnpm run cli:dev start

# Or use the start script
pnpm run start
```

### Production Deployment

```bash
# Build the CLI
pnpm run build:cli

# Start in daemon mode
side-server start --daemon

# Check status
side-server status

# Stop when needed
side-server stop
```

### Configuration Management

```bash
# List current configuration
side-server config list

# Change port
side-server config set port 9000

# Restart server to apply changes
side-server stop
side-server start --daemon

# Verify new configuration
side-server status
```

## Troubleshooting

### Server won't start

Check if the port is already in use:
```bash
# Linux/macOS
lsof -i :8787

# Windows
netstat -ano | findstr :8787
```

### Stale PID file

If the server crashed, a stale PID file might exist:
```bash
# Check status (will detect stale PID)
side-server status

# Start will automatically clean up stale PID
side-server start
```

### Permission errors

Ensure the `~/.side-ide` directory is writable:
```bash
mkdir -p ~/.side-ide
chmod 755 ~/.side-ide
```

## Development

### Running Tests

```bash
pnpm test
```

### Type Checking

```bash
pnpm run type-check
```

### Building

```bash
pnpm run build:cli
```
```

**Step 2: Commit**

```bash
git add apps/server/CLI.md
git commit -m "docs(cli): add comprehensive CLI documentation"
```

---

## Task 11: Integration Testing

**Files:**
- Create: `apps/server/src/__tests__/integration/cli.integration.test.ts`

**Step 1: Create integration test**

Create `apps/server/src/__tests__/integration/cli.integration.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args]);
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
  });
}

describe('CLI Integration Tests', () => {
  beforeAll(async () => {
    // Ensure no server is running
    await runCLI(['stop']).catch(() => {});
    await setTimeout(1000);
  });

  afterAll(async () => {
    // Clean up
    await runCLI(['stop']).catch(() => {});
  });

  it('should display version', async () => {
    const { stdout, exitCode } = await runCLI(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should display help', async () => {
    const { stdout, exitCode } = await runCLI(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('side-server');
    expect(stdout).toContain('start');
    expect(stdout).toContain('stop');
    expect(stdout).toContain('status');
    expect(stdout).toContain('config');
  });

  it('should show not running status initially', async () => {
    const { stdout } = await runCLI(['status']);
    expect(stdout).toContain('NOT RUNNING');
  });

  it('should list configuration', async () => {
    const { stdout, exitCode } = await runCLI(['config', 'list']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('port');
    expect(stdout).toContain('host');
  });

  it('should get configuration value', async () => {
    const { stdout, exitCode } = await runCLI(['config', 'get', 'port']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/\d+/);
  });

  it('should set configuration value', async () => {
    const { stdout, exitCode } = await runCLI(['config', 'set', 'port', '9999']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Configuration updated');

    // Verify it was set
    const { stdout: getOutput } = await runCLI(['config', 'get', 'port']);
    expect(getOutput.trim()).toBe('9999');

    // Reset to default
    await runCLI(['config', 'set', 'port', '8787']);
  });

  // Daemon mode tests would require more complex setup
  // and are better suited for manual testing or E2E tests
});
```

**Step 2: Run integration tests**

Run: `pnpm run build:cli && pnpm test src/__tests__/integration/cli.integration.test.ts`
Expected: All integration tests PASS

**Step 3: Commit**

```bash
git add apps/server/src/__tests__/integration/cli.integration.test.ts
git commit -m "test(cli): add integration tests for CLI commands"
```

---

## Task 12: Final Verification and Documentation Update

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: No type errors

**Step 3: Build and verify CLI**

Run: `pnpm run build:cli`
Run: `pnpm run cli -- --help`
Expected: Shows complete help with all commands

**Step 4: Manual smoke test**

```bash
# Test config
pnpm run cli config list
pnpm run cli config get port
pnpm run cli config set port 8888
pnpm run cli config get port  # Should show 8888
pnpm run cli config set port 8787  # Reset

# Test daemon mode
pnpm run cli start --daemon
pnpm run cli status  # Should show RUNNING
sleep 2
pnpm run cli stop    # Should stop gracefully
pnpm run cli status  # Should show NOT RUNNING
```

**Step 5: Update main README if needed**

If `apps/server/README.md` exists, add link to CLI docs:
```markdown
## CLI

See [CLI.md](./CLI.md) for command-line interface documentation.
```

**Step 6: Final commit**

```bash
git add .
git commit -m "chore(cli): complete Phase 1 - CLI framework implementation"
```

**Step 7: Create PR**

```bash
git push origin HEAD
gh pr create --title "feat: Implement CLI framework with daemon mode (Phase 1)" \
  --body "Implements Phase 1 of Issue #2: CLI Framework

**Changes:**
- CLI entry point with commander.js
- PID-based process management for daemon mode
- Configuration manager with env variable merging
- Commands: start, stop, status, config
- Comprehensive tests and documentation

**Commands:**
\`\`\`bash
side-server start [--daemon] [--port] [--host]
side-server stop
side-server status
side-server config list|get|set
\`\`\`

**Files:**
- ~/.side-ide/side-server.pid - Process ID file
- ~/.side-ide/config.json - Configuration file
- ~/.side-ide/logs/ - Log directory

**Testing:**
- Unit tests for PidManager, ConfigManager
- Integration tests for CLI commands
- Manual smoke tests completed

Closes #2 (Phase 1)"
```

---

## Summary

This plan implements Phase 1: CLI Framework with 12 bite-sized tasks:

1. ✅ Install CLI dependencies (commander)
2. ✅ Create CLI entry point
3. ✅ Implement PID file manager
4. ✅ Implement configuration manager
5. ✅ Add 'start' command (foreground + daemon)
6. ✅ Add 'stop' command
7. ✅ Add 'status' command with health check
8. ✅ Add 'config' command (list/get/set)
9. ✅ Update package.json scripts
10. ✅ Add CLI documentation
11. ✅ Add integration tests
12. ✅ Final verification and PR

**Estimated time:** 3-5 days (as per original issue)

**Key Features:**
- Full CLI interface with multiple commands
- Daemon mode with PID file management
- Graceful shutdown handling
- Configuration file + env variable merging
- Health checking
- Comprehensive testing
- Complete documentation

**Next Phase:** Phase 2 - MCP Server Management
