/**
 * Environment Check API Routes
 *
 * Provides endpoints for checking system environment and tool availability
 */

import { Hono } from "hono";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { handleError } from "../utils/error.js";

const execAsync = promisify(exec);

/**
 * Tool version information
 */
interface ToolVersion {
  name: string;
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

/**
 * Environment check result
 */
interface EnvironmentCheck {
  node: ToolVersion;
  npm: ToolVersion;
  pnpm: ToolVersion;
  git: ToolVersion;
  python: ToolVersion;
  agents: {
    claude: ToolVersion;
    codex: ToolVersion;
    copilot: ToolVersion;
    cursor: ToolVersion;
    kimi: ToolVersion;
  };
  os: {
    platform: string;
    release: string;
    arch: string;
    cpus: number;
    totalMemory: number;
    freeMemory: number;
  };
}

/**
 * Check a tool's version
 */
async function checkToolVersion(
  command: string,
  versionFlag: string = "--version"
): Promise<ToolVersion> {
  try {
    const { stdout, stderr } = await execAsync(`${command} ${versionFlag}`, {
      timeout: 5000,
    });
    
    const output = stdout || stderr;
    const lines = output.trim().split("\n");
    const versionLine = lines[0];
    
    // Try to find the path
    let path: string | undefined;
    try {
      const { stdout: pathOutput } = await execAsync(`which ${command}`, {
        timeout: 2000,
      });
      path = pathOutput.trim();
    } catch {
      // Path detection failed, not critical
    }

    return {
      name: command,
      available: true,
      version: versionLine,
      path,
    };
  } catch (error) {
    return {
      name: command,
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create environment check router
 */
export function createEnvCheckRouter() {
  const router = new Hono();

  /**
   * GET /api/env/check - Check system environment
   */
  router.get("/check", async (c) => {
    try {
      const os = await import("node:os");

      // Check core tools in parallel
      const [node, npm, pnpm, git, python] = await Promise.all([
        checkToolVersion("node"),
        checkToolVersion("npm"),
        checkToolVersion("pnpm"),
        checkToolVersion("git"),
        checkToolVersion("python3", "--version"),
      ]);

      // Check agent CLIs
      const [claude, codex, copilot, cursor, kimi] = await Promise.all([
        checkToolVersion("claude"),
        checkToolVersion("codex"),
        checkToolVersion("gh", "copilot --version"), // GitHub Copilot requires gh cli
        checkToolVersion("cursor"),
        checkToolVersion("kimi"),
      ]);

      const result: EnvironmentCheck = {
        node,
        npm,
        pnpm,
        git,
        python,
        agents: {
          claude,
          codex,
          copilot,
          cursor,
          kimi,
        },
        os: {
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
          cpus: os.cpus().length,
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
        },
      };

      return c.json(result);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/env/check/:tool - Check a specific tool
   */
  router.get("/check/:tool", async (c) => {
    try {
      const tool = c.req.param("tool");
      const result = await checkToolVersion(tool);
      return c.json(result);
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}
