import { useEffect, useState } from "react";
import { DEFAULT_SERVER_PORT, STATUS_CHECK_INTERVAL } from "../constants";

export type ServerStatusState = "starting" | "running" | "stopped" | "error";

export interface ServerStatus {
  status: ServerStatusState;
  port: number;
  error?: string;
}

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatusState>("starting");
  const [port, setPort] = useState<number>(DEFAULT_SERVER_PORT);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

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
        } else {
          setStatus("stopped");
          setPort(result.port);
          setError(undefined);
        }
      } catch {
        // Not in Tauri environment, assume API is available (web mode)
        if (!signal.aborted) {
          setStatus("running");
          setError(undefined);
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
