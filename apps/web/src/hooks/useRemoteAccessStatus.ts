import { useEffect, useState } from "react";

// Check if running in Tauri (Tauri v2 uses __TAURI_INTERNALS__)
function isTauriApp(): boolean {
  return typeof window !== "undefined" && (
    "__TAURI_INTERNALS__" in window || 
    "__TAURI__" in window
  );
}import { STATUS_CHECK_INTERVAL } from "../constants";

export interface RemoteAccessStatus {
  isTauri: boolean;
  installed: boolean;
  backendState: string | null;
  authUrl: string | null;
  dnsName: string | null;
  hostname: string | null;
  ips: string[];
  serveEnabled: boolean;
  serveUrl: string | null;
  settings: {
    autoStart: boolean;
  } | null;
  lastError: string | null;
}

export function useRemoteAccessStatus(): RemoteAccessStatus {
  const [state, setState] = useState<RemoteAccessStatus>({
    isTauri: false,
    installed: false,
    backendState: null,
    authUrl: null,
    dnsName: null,
    hostname: null,
    ips: [],
    serveEnabled: false,
    serveUrl: null,
    settings: null,
    lastError: null,
  });

  useEffect(() => {
    const isTauri = typeof window !== "undefined" && isTauriApp();
    setState((s) => ({ ...s, isTauri }));
    if (!isTauri) return;

    const abortController = new AbortController();
    const signal = abortController.signal;

    const checkStatus = async () => {
      if (signal.aborted) return;
      try {
        const tauri = await import("@tauri-apps/api/core");
        const result = (await tauri.invoke("get_remote_access_status")) as {
          installed: boolean;
          backend_state?: string | null;
          auth_url?: string | null;
          self_dns_name?: string | null;
          self_hostname?: string | null;
          tailscale_ips?: string[];
          serve_enabled?: boolean;
          serve_url?: string | null;
          settings?: { auto_start?: boolean } | null;
        };

        if (signal.aborted) return;
        setState({
          isTauri: true,
          installed: Boolean(result.installed),
          backendState: result.backend_state ?? null,
          authUrl: result.auth_url ?? null,
          dnsName: result.self_dns_name ?? null,
          hostname: result.self_hostname ?? null,
          ips: Array.isArray(result.tailscale_ips) ? result.tailscale_ips : [],
          serveEnabled: Boolean(result.serve_enabled),
          serveUrl: result.serve_url ?? null,
          settings: result.settings ? { autoStart: Boolean(result.settings.auto_start) } : null,
          lastError: null,
        });
      } catch (e) {
        if (signal.aborted) return;
        setState((s) => ({
          ...s,
          installed: false,
          backendState: null,
          authUrl: null,
          dnsName: null,
          hostname: null,
          ips: [],
          serveEnabled: false,
          serveUrl: null,
          settings: null,
          lastError: typeof e === "string" ? e : String(e),
        }));
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, STATUS_CHECK_INTERVAL);
    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, []);

  return state;
}
