import { Settings } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { getStatusBarDensity } from "../utils/layoutCompaction";

interface GlobalStatusBarProps {
  serverStatus?: ReactNode;
  remoteAccessControl?: ReactNode;
  activeTerminalsCount?: number;
  contextHealthScore?: number;
  onToggleContextStatus?: () => void;
  onOpenEnvironmentModal?: () => void;
}

// Type definition for performance.memory API (Chrome-specific)
interface PerformanceMemory {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export function GlobalStatusBar({
  serverStatus,
  remoteAccessControl,
  activeTerminalsCount = 0,
  contextHealthScore = 100,
  onToggleContextStatus,
  onOpenEnvironmentModal,
}: GlobalStatusBarProps) {
  const [statusBarDensity, setStatusBarDensity] = useState(() =>
    typeof window === "undefined" ? "full" : getStatusBarDensity(window.innerWidth)
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onResize = () => setStatusBarDensity(getStatusBarDensity(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isCompact = statusBarDensity === "compact";
  const isMinimal = statusBarDensity === "minimal";
  const isFull = statusBarDensity === "full";

  // Get memory usage if available
  const memoryUsage = useMemo(() => {
    const perf = performance as PerformanceWithMemory;
    if (typeof performance !== "undefined" && perf.memory) {
      const mem = perf.memory;
      const used = Math.round(mem.usedJSHeapSize / 1024 / 1024);
      const total = Math.round(mem.jsHeapSizeLimit / 1024 / 1024);
      return `${used}MB/${total}MB`;
    }
    return null;
  }, []);

  // Get health color
  const getHealthColor = (score: number) => {
    if (score >= 80) return "#22c55e";
    if (score >= 50) return "#eab308";
    if (score >= 30) return "#f97316";
    return "#ef4444";
  };

  const healthColor = getHealthColor(contextHealthScore);

  return (
    <div className="global-status-bar">
      <div className="global-statusbar-left">
        <span className="statusbar-item statusbar-item--server">
          {serverStatus || (
            <>
              <span className="status-indicator status-online"></span>
              Server: Connected
            </>
          )}
        </span>
        {isFull && remoteAccessControl}
        {onToggleContextStatus && !isMinimal && (
          <button
            className="statusbar-item statusbar-clickable"
            onClick={onToggleContextStatus}
            title="View context manager status"
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="status-indicator" style={{ backgroundColor: healthColor }}></span>
            {isCompact ? `Ctx ${contextHealthScore}%` : `Context: ${contextHealthScore}%`}
          </button>
        )}
      </div>
      <div className="global-statusbar-right">
        {onOpenEnvironmentModal && isFull && (
          <button
            className="statusbar-item statusbar-clickable"
            onClick={onOpenEnvironmentModal}
            title="Environment Status"
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Settings size={14} />
            <span>Environment</span>
          </button>
        )}
        <span className="statusbar-item statusbar-item--ws">
          {isMinimal ? "WS: On" : "WebSocket: Active"}
        </span>
        <span className="statusbar-item statusbar-item--terminals">
          {isMinimal ? `T:${activeTerminalsCount}` : `Terminals: ${activeTerminalsCount}`}
        </span>
        {isFull && memoryUsage && <span className="statusbar-item">Memory: {memoryUsage}</span>}
      </div>
    </div>
  );
}
