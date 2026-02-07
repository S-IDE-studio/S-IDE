import { useEffect, useState } from "react";
import { API_BASE, DEFAULT_SERVER_PORT, STATUS_CHECK_INTERVAL } from "../constants";

export type ServerStatusState = "starting" | "running" | "stopped" | "error";

export interface ServerStatus {
  status: ServerStatusState;
  port: number;
  error?: string;
}

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

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatusState>("starting");
  const [port, setPort] = useState<number>(DEFAULT_SERVER_PORT);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    let consecutiveFailures = 0;
    const MAX_FAILURES_BEFORE_STOPPED = 3;

    const checkStatus = async () => {
      if (signal.aborted) return;

      try {
        const tauri = await import("@tauri-apps/api/core");
        const result = (await tauri.invoke("get_server_status")) as {
          running: boolean;
          port: number;
        };

        if (signal.aborted) return;

        if (result.running) {
          setStatus("running");
          setPort(result.port);
          setError(undefined);
          consecutiveFailures = 0;
        } else {
          // Avoid false negatives (e.g. server running on a non-default port, or transient state):
          // verify via /health before claiming it's stopped.
          const isHealthy = await checkServerHealth();
          if (signal.aborted) return;

          if (isHealthy) {
            setStatus("running");
            // Prefer the current origin port when API_BASE is same-origin.
            const originPort = Number(window.location.port || DEFAULT_SERVER_PORT);
            setPort(Number.isFinite(originPort) ? originPort : result.port);
            setError(undefined);
            consecutiveFailures = 0;
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
          consecutiveFailures = 0;
        } else {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_FAILURES_BEFORE_STOPPED) {
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
