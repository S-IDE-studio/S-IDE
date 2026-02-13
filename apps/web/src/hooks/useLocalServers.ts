import { useEffect, useState } from "react";

export interface LocalServer {
  name: string;
  url: string;
  port: number;
  status: string;
  type: string;
  mcpServers?: MCPServer[];
}

export interface MCPServer {
  name: string;
  status: string;
  capabilities: string[];
}

export interface LocalServersResult {
  servers: LocalServer[];
  isScanning: boolean;
  refresh: () => void;
}

// Advanced scanning types

export interface PortInfo {
  port: number;
  status: "Open" | "Closed" | "Filtered";
  protocol: string;
  service?: string;
  version?: string;
}

export interface ServiceInfo {
  name: string;
  version?: string;
  info?: string;
}

export interface ScanResult {
  host: string;
  ports: PortInfo[];
  os_guess?: string;
  services: ServiceInfo[];
}

export interface ScanOptions {
  ports?: number[];
  osDetection?: boolean;
  versionDetection?: boolean;
  useNmap?: boolean;
}

// Import Tauri API at module level to avoid dynamic imports in component
let tauriCore: typeof import("@tauri-apps/api/core") | null = null;

async function getTauriCore() {
  if (!tauriCore) {
    try {
      tauriCore = await import("@tauri-apps/api/core");
    } catch {
      // Not in Tauri environment
      return null;
    }
  }
  return tauriCore;
}

/**
 * Hook to scan and track local development servers
 * @param refreshInterval - Polling interval in milliseconds (default: 5000)
 */
export function useLocalServers(refreshInterval: number = 5000): LocalServersResult {
  const [servers, setServers] = useState<LocalServer[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const refresh = async () => {
    setIsScanning(true);

    // Try Tauri command first
    const tauri = await getTauriCore();

    if (tauri) {
      try {
        const result = await tauri.invoke<LocalServer[]>("scan_local_servers");

        // Fetch MCP servers for each detected server
        const serversWithMCP = await Promise.all(
          result.map(async (server) => {
            try {
              const mcpServers = await tauri.invoke<MCPServer[]>("get_mcp_servers", {
                serverUrl: server.url,
              });
              return { ...server, mcpServers };
            } catch {
              // MCP not available for this server
              return { ...server, mcpServers: undefined };
            }
          })
        );

        setServers(serversWithMCP);
        setIsScanning(false);
      } catch (tauriError) {
        // Tauri command failed, fallback to manual server check
        console.log("[useLocalServers] Tauri command failed, using fallback");
        const fallbackServers = await scanFallbackServers();
        setServers(fallbackServers);
        setIsScanning(false);
      }
    } else {
      // Not in Tauri environment, fallback to manual server check
      console.log("[useLocalServers] Not in Tauri environment, using fallback");
      try {
        const fallbackServers = await scanFallbackServers();
        setServers(fallbackServers);
        setIsScanning(false);
      } catch (error) {
        console.error("[useLocalServers] Failed to scan servers:", error);
        setServers([]);
        setIsScanning(false);
      }
    }
  };

  useEffect(() => {
    // Initial scan
    refresh();

    // Set up polling
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { servers, isScanning, refresh };
}

/**
 * Fallback server scanner for non-Tauri environments (web browser)
 * Checks common localhost ports and fetches MCP servers
 */
async function scanFallbackServers(): Promise<LocalServer[]> {
  const commonPorts = [3000, 5173, 8000, 8080, 8787];
  const servers: LocalServer[] = [];

  for (const port of commonPorts) {
    try {
      const response = await fetch(`http://localhost:${port}/health`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) {
        const serverUrl = `http://localhost:${port}`;

        // Try to fetch MCP servers for this server
        let mcpServers: MCPServer[] | undefined;
        try {
          const mcpResponse = await fetch(`${serverUrl}/api/mcp-status`, {
            signal: AbortSignal.timeout(1000),
          });
          if (mcpResponse.ok) {
            mcpServers = await mcpResponse.json();
          }
        } catch {
          // MCP not available for this server
        }

        servers.push({
          name: `Server on port ${port}`,
          url: serverUrl,
          port,
          status: "running",
          type: "dev",
          mcpServers,
        });
      }
    } catch {
      // Port not available, skip
    }
  }

  return servers;
}

// Advanced scanning hook with nmap-style capabilities

export interface AdvancedScanResult {
  results: ScanResult[];
  isScanning: boolean;
  error?: string;
  scan: (options: ScanOptions) => Promise<void>;
}

/**
 * Hook for advanced network scanning with OS detection and version detection
 * @param options - Scan options including ports, OS detection, version detection, and nmap usage
 */
export function useAdvancedScan(): AdvancedScanResult {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const scan = async (options: ScanOptions) => {
    setIsScanning(true);
    setError(undefined);

    try {
      const tauri = await import("@tauri-apps/api/core");
      const data = await tauri.invoke<ScanResult[]>("scan_local_servers_advanced", {
        ports: options.ports ?? null,
        os_detection: options.osDetection ?? false,
        version_detection: options.versionDetection ?? false,
        use_nmap: options.useNmap ?? false,
      });
      setResults(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error("[useAdvancedScan] Scan failed:", errorMsg);
      setResults([]);
    } finally {
      setIsScanning(false);
    }
  };

  return { results, isScanning, error, scan };
}

/**
 * Check if nmap is available on the system
 */
export async function checkNmapAvailable(): Promise<boolean> {
  try {
    const tauri = await import("@tauri-apps/api/core");
    return await tauri.invoke<boolean>("check_nmap_available");
  } catch {
    return false;
  }
}
