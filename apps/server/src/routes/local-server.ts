/**
 * Local Server Management API Routes
 *
 * REST API endpoints for monitoring and managing local servers.
 * Provides port scanning, process detection, and server control capabilities.
 */

import { Hono } from "hono";
import { createHttpError, handleError } from "../utils/error.js";

/**
 * Detected server information
 */
interface DetectedServer {
  name: string;
  url: string;
  port: number;
  status: string;
  type: string;
  pid?: number;
  uptime?: number;
}

/**
 * Scan result for advanced scanning
 */
interface ScanResult {
  port: number;
  status: "open" | "closed" | "filtered";
  service?: string;
  version?: string;
  process?: string;
}

/**
 * Probe a single port to detect a server
 */
async function probeServer(port: number, defaultType: string): Promise<DetectedServer | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);

    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const name = await detectServerName(port);
      return {
        name: name || defaultType,
        url: `http://127.0.0.1:${port}`,
        port,
        status: "running",
        type: defaultType,
      };
    }
  } catch {
    // Try root endpoint as fallback
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 500);

      const response = await fetch(`http://127.0.0.1:${port}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const name = await detectServerName(port);
        return {
          name: name || defaultType,
          url: `http://127.0.0.1:${port}`,
          port,
          status: "running",
          type: defaultType,
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Detect server name from HTML or response
 */
async function detectServerName(port: number): Promise<string | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}`);
    const html = await response.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Scan localhost for running servers
 */
async function scanLocalServers(): Promise<DetectedServer[]> {
  const servers: DetectedServer[] = [];

  // Common development ports to scan
  const portsToScan: Array<[number, string]> = [
    [3000, "dev"],
    [3001, "dev"],
    [5173, "vite"],
    [5174, "vite"],
    [8000, "dev"],
    [8080, "dev"],
    [8787, "side-ide"],
    [9000, "dev"],
  ];

  // Scan ports in parallel
  const scanPromises = portsToScan.map(([port, type]) =>
    probeServer(port, type).then((result) => ({ result, port }))
  );

  const results = await Promise.all(scanPromises);
  for (const { result } of results) {
    if (result) {
      servers.push(result);
    }
  }

  return servers;
}

/**
 * Create local server router
 */
export function createLocalServerRouter() {
  const router = new Hono();

  /**
   * GET /api/local-server/scan - Scan for running local servers
   */
  router.get("/scan", async (c) => {
    try {
      const servers = await scanLocalServers();
      return c.json(servers);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/local-server/scan/:port - Check specific port
   */
  router.get("/scan/:port", async (c) => {
    try {
      const port = Number.parseInt(c.req.param("port"), 10);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        throw createHttpError("Invalid port number", 400);
      }

      const result = await probeServer(port, "unknown");
      return c.json(result || { port, status: "closed" });
    } catch (error) {
      return handleError(c, error);
    }
  });
  
  /**
   * GET /api/local-server/scan/advanced - Advanced scan with nmap
   */
  router.get("/scan/advanced", async (c) => {
    try {
      const exec = (await import("node:child_process")).exec;
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);
      
      // Check if nmap is available
      let nmapAvailable = false;
      try {
        await execAsync("which nmap", { timeout: 2000 });
        nmapAvailable = true;
      } catch {
        nmapAvailable = false;
      }
      
      if (!nmapAvailable) {
        // Fallback to Node.js-based scan
        const servers = await scanLocalServers();
        return c.json({
          method: "fallback",
          message: "nmap not available, using fallback scanning",
          servers,
        });
      }
      
      // Run nmap scan
      const { stdout } = await execAsync(
        "nmap -sV -T4 --top-ports 100 localhost",
        { timeout: 30000 }
      );
      
      // Parse nmap output
      const lines = stdout.split("\n");
      const ports: Array<{ port: number; state: string; service: string; version?: string }> = [];
      
      for (const line of lines) {
        const match = line.match(/^(\d+)\/tcp\s+(\w+)\s+(.+)$/);
        if (match) {
          const [, portStr, state, serviceInfo] = match;
          const port = Number.parseInt(portStr, 10);
          const [service, ...versionParts] = serviceInfo.split(/\s+/);
          
          ports.push({
            port,
            state,
            service,
            version: versionParts.length > 0 ? versionParts.join(" ") : undefined,
          });
        }
      }
      
      return c.json({
        method: "nmap",
        ports,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });
  
  /**
   * GET /api/local-server/nmap/available - Check if nmap is available
   */
  router.get("/nmap/available", async (c) => {
    try {
      const exec = (await import("node:child_process")).exec;
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);
      
      try {
        const { stdout } = await execAsync("nmap --version", { timeout: 2000 });
        const versionMatch = stdout.match(/Nmap version ([\d.]+)/);
        
        return c.json({
          available: true,
          version: versionMatch ? versionMatch[1] : "unknown",
        });
      } catch {
        return c.json({
          available: false,
        });
      }
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/local-server/status - Get status of all known servers
   */
  router.get("/status", async (c) => {
    try {
      const servers = await scanLocalServers();
      return c.json({
        count: servers.length,
        servers,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}
