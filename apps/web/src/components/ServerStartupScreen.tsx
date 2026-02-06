import { useEffect, useState } from "react";
import { API_BASE, DEFAULT_SERVER_PORT, SERVER_STARTUP_DELAY } from "../constants";

interface ServerStartupScreenProps {
  onComplete: () => void;
}

type StartupStatus = "init" | "checking" | "starting" | "ready" | "failed";

const STATUS_MESSAGES: Record<StartupStatus, string> = {
  init: "Initializing...",
  checking: "Checking server status...",
  starting: "Starting server...",
  ready: "Ready!",
  failed: "Failed to start server",
};

/**
 * Checks if the server is healthy by calling the /health endpoint
 */
async function checkServerHealth(maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet, wait and retry
    }
    await sleep(500);
  }
  return false;
}

export function ServerStartupScreen({ onComplete }: ServerStartupScreenProps) {
  const [status, setStatus] = useState<StartupStatus>("init");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let progressInterval: ReturnType<typeof setInterval> | null = null;

    const runStartupSequence = async () => {
      // Step 1: Initialize
      if (alive) {
        setStatus("init");
        setProgress(10);
      }
      await sleep(500);

      // Step 2: Check server status
      if (alive) {
        setStatus("checking");
        setProgress(30);
      }

      try {
        const tauri = await import("@tauri-apps/api/core");
        const result = (await tauri.invoke("get_server_status")) as {
          running: boolean;
          port: number;
        };

        if (!alive) return;

        if (result.running) {
          // Server already running - verify with health check
          const isHealthy = await checkServerHealth(3);
          if (isHealthy) {
            setProgress(100);
            setStatus("ready");
            await sleep(500);
            if (alive) onComplete();
            return;
          }
        }

        // Step 3: Start server
        if (alive) {
          setStatus("starting");
          setProgress(50);

          // Start progress animation
          progressInterval = setInterval(() => {
            setProgress((prev) => {
              if (prev >= 90) {
                clearInterval(progressInterval!);
                return 90;
              }
              return prev + 10;
            });
          }, 300);
        }

        await tauri.invoke("start_server", { port: DEFAULT_SERVER_PORT });

        // Wait for server to be ready
        await sleep(SERVER_STARTUP_DELAY);

        if (!alive) return;

        // Verify server is running and healthy
        const verifyResult = (await tauri.invoke("get_server_status")) as {
          running: boolean;
          port: number;
        };

        if (verifyResult.running) {
          // Also verify health endpoint responds
          const isHealthy = await checkServerHealth(5);
          if (isHealthy) {
            if (progressInterval) clearInterval(progressInterval);
            setProgress(100);
            setStatus("ready");
            await sleep(500);
            if (alive) onComplete();
            return;
          }
        }

        throw new Error("Server failed to start or not responding");
      } catch (tauriError) {
        // Tauri not available - running in web mode
        // Just check if server is already running
        if (alive) {
          const isHealthy = await checkServerHealth();
          if (isHealthy) {
            setProgress(100);
            setStatus("ready");
            await sleep(500);
            if (alive) onComplete();
            return;
          }
        }

        // Server not available in web mode
        if (!alive) return;

        if (progressInterval) clearInterval(progressInterval);
        const message = tauriError instanceof Error ? tauriError.message : "Unknown error";
        setErrorMessage("Server not available. Please start the server with `pnpm run dev:server`");
        setStatus("failed");
        setProgress(0);
      }
    };

    runStartupSequence();

    return () => {
      alive = false;
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [onComplete]);

  const handleRetry = () => {
    setErrorMessage(null);
    // Rerun the startup sequence
    setStatus("init");
    setProgress(0);
  };

  return (
    <div className="server-startup-screen">
      <div className="startup-content">
        <div className="startup-logo">S-IDE</div>
        <div className="startup-version">v2.0.0</div>
        <div className="status-text">{STATUS_MESSAGES[status]}</div>
        {status !== "failed" && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        {status === "failed" && errorMessage && (
          <div className="startup-error">
            <p className="error-message">{errorMessage}</p>
            <button type="button" className="primary-button" onClick={handleRetry}>
              Retry
            </button>
          </div>
        )}
        {status === "ready" && <div className="startup-success">Launching application...</div>}
      </div>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
