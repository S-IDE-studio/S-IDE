import { exec as nodeExec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(nodeExec);

export const PROBE_TIMEOUT_MS = 500;

const COMMAND_TIMEOUT_MS = 5000;
const MAX_SCAN_PORTS = 200;
const SUPPORTED_PLATFORMS = new Set<NodeJS.Platform>(["win32", "linux", "darwin"]);

export type SupportedPlatform = "win32" | "linux" | "darwin";

export const DEFAULT_SCAN_PORTS: Array<[number, string]> = [
  [3000, "dev"],
  [3001, "dev"],
  [5173, "vite"],
  [5174, "vite"],
  [8000, "dev"],
  [8080, "dev"],
  [8787, "side-ide"],
  [9000, "dev"],
];

function normalizeHost(host: string): string {
  return host.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
}

function isLocalBindHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return (
    normalized === "*" ||
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("127.")
  );
}

function parseAddressToken(addressToken: string): { host: string; port: number } | null {
  const token = addressToken.trim();
  const match = token.match(/(?:[:.])(\d+)$/);
  if (!match) {
    return null;
  }

  const port = Number.parseInt(match[1], 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    return null;
  }

  const hostPart = token.slice(0, token.length - match[0].length);
  if (!isLocalBindHost(hostPart)) {
    return null;
  }

  return { host: hostPart, port };
}

function resolveAddressTokenForLine(line: string, platform: SupportedPlatform): string | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 4) {
    return null;
  }

  if (platform === "win32") {
    return parts[1] ?? null;
  }

  // ss output (linux): LISTEN ... <local-address> <peer-address>
  if (parts[0]?.toUpperCase() === "LISTEN") {
    return parts[3] ?? null;
  }

  // netstat output (linux/darwin): tcp ... <local-address> <peer-address> LISTEN
  return parts[3] ?? null;
}

/**
 * Parse listening local ports from system command output.
 */
export function parseListeningLocalPorts(output: string, platform: SupportedPlatform): number[] {
  const ports = new Set<number>();
  const lines = output.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || !/listen/i.test(line)) {
      continue;
    }

    const addressToken = resolveAddressTokenForLine(line, platform);
    if (!addressToken) {
      continue;
    }

    const parsed = parseAddressToken(addressToken);
    if (!parsed) {
      continue;
    }

    ports.add(parsed.port);
  }

  return Array.from(ports).sort((a, b) => a - b);
}

function getPortScanCommands(platform: SupportedPlatform): string[] {
  switch (platform) {
    case "win32":
      return ["netstat -ano -p tcp"];
    case "linux":
      return ["ss -ltnH", "netstat -ltn"];
    case "darwin":
      return ["netstat -anv -p tcp"];
  }
}

export async function detectListeningLocalPorts(): Promise<number[]> {
  const platform = process.platform;
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return [];
  }

  const supportedPlatform = platform as SupportedPlatform;
  const commands = getPortScanCommands(supportedPlatform);

  for (const command of commands) {
    try {
      const { stdout } = await execAsync(command, { timeout: COMMAND_TIMEOUT_MS });
      const ports = parseListeningLocalPorts(stdout, supportedPlatform);
      if (ports.length > 0) {
        return ports.slice(0, MAX_SCAN_PORTS);
      }
    } catch {
      // Try next command for this platform.
    }
  }

  return [];
}

export function inferServerType(port: number): string {
  const mappedType = new Map<number, string>([
    [5173, "vite"],
    [5174, "vite"],
    [8787, "side-ide"],
  ]);
  return mappedType.get(port) || "local";
}
