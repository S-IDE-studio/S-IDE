import { useEffect, useState } from "react";
import { STATUS_CHECK_INTERVAL } from "../constants";

export interface TunnelStatus {
  running: boolean;
  url: string | null;
}

export function useTunnelStatus(): TunnelStatus {
  const [running, setRunning] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const checkStatus = async () => {
      if (signal.aborted) return;

      try {
        const tauri = await import("@tauri-apps/api/core");
        const result = (await tauri.invoke("get_tunnel_status")) as {
          running: boolean;
          url: string | null;
        };

        if (signal.aborted) return;

        setRunning(result.running);
        setUrl(result.url);
      } catch {
        // Not in Tauri environment
        if (!signal.aborted) {
          setRunning(false);
          setUrl(null);
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

  return { running, url };
}
