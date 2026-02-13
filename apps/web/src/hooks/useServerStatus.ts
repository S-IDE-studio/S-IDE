import { useEffect, useRef, useState } from "react";
import { API_BASE, DEFAULT_SERVER_PORT, STATUS_CHECK_INTERVAL } from "../constants";

export type ServerStatusState = "starting" | "running" | "stopped" | "error";

export interface ServerStatus {
  status: ServerStatusState;
  port: number;
  error?: string;
}

// Import Tauri API at module level to avoid dynamic imports in component
const tauriPromise = import("@tauri-apps/api/core").catch(() => null);

/**
 * Checks if the server is responding by calling the health endpoint
 */
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Gets the port from window.location, falling back to the provided port
 */
function getPortFromLocation(fallbackPort: number): number {
  const portString = window.location.port;
  const portValue = portString || DEFAULT_SERVER_PORT;
  const originPort = Number(portValue);
  const isValidPort = Number.isFinite(originPort);
  return isValidPort ? originPort : fallbackPort;
}

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatusState>("starting");
  const [port, setPort] = useState<number>(DEFAULT_SERVER_PORT);
  const [error, setError] = useState<string | undefined>();
  const consecutiveFailuresRef = useRef(0);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const MAX_FAILURES_BEFORE_STOPPED = 3;

    const checkStatus = async () => {
      if (signal.aborted) return;

      try {
        const tauri = await tauriPromise;

        // If Tauri is not available, handle as web mode
        if (!tauri) {
          const isHealthy = await checkServerHealth();

          if (signal.aborted) return;

          if (isHealthy) {
            setStatus("running");
            setError(undefined);
            consecutiveFailuresRef.current = 0;
          } else {
            const newFailureCount = consecutiveFailuresRef.current + 1;
            consecutiveFailuresRef.current = newFailureCount;
            const shouldStop = newFailureCount >= MAX_FAILURES_BEFORE_STOPPED;
            if (shouldStop) {
              setStatus("stopped");
              setError("Server not responding");
            } else {
              // Still in starting state, waiting for server
              setStatus("starting");
            }
          }
          return;
        }

        const result = (await tauri.invoke("get_server_status")) as {
          running: boolean;
          port: number;
        };

        if (signal.aborted) return;

        if (result.running) {
          setStatus("running");
          setPort(result.port);
          setError(undefined);
          consecutiveFailuresRef.current = 0;
        } else {
          // Avoid false negatives (e.g. server running on a non-default port, or transient state):
          // verify via /health before claiming it's stopped.
          const isHealthy = await checkServerHealth();
          if (signal.aborted) return;

          if (isHealthy) {
            setStatus("running");
            // Prefer the current origin port when API_BASE is same-origin.
            const finalPort = getPortFromLocation(result.port);
            setPort(finalPort);
            setError(undefined);
            consecutiveFailuresRef.current = 0;
          } else {
            setStatus("stopped");
            setPort(result.port);
            setError(undefined);
          }
        }
      } catch {
        // Not in Tauri environment - check health endpoint (web mode)
        const isHealthy = await checkServerHealth();

        if (signal.aborted) return;

        if (isHealthy) {
          setStatus("running");
          setError(undefined);
          consecutiveFailuresRef.current = 0;
        } else {
          const newFailureCount = consecutiveFailuresRef.current + 1;
          consecutiveFailuresRef.current = newFailureCount;
          const shouldStop = newFailureCount >= MAX_FAILURES_BEFORE_STOPPED;
          if (shouldStop) {
            setStatus("stopped");
            setError("Server not responding");
          } else {
            // Still in starting state, waiting for server
            setStatus("starting");
          }
        }
      }
    };

    // Initial check
    checkStatus();

    // Poll periodically
    const interval = setInterval(checkStatus, STATUS_CHECK_INTERVAL);

    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, []);

  return { status, port, error };
}
