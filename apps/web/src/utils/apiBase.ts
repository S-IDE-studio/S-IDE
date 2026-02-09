export function resolveApiBase(configuredBase: string, currentHostname: string): string {
  const base = configuredBase?.trim() ?? "";
  if (!base) return "";

  let url: URL | null = null;
  try {
    url = new URL(base);
  } catch {
    // If it's not an absolute URL, keep it as-is (e.g. "/api").
    return base;
  }

  const isLocalhost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1" ||
    url.hostname === "[::1]";

  const currentIsLocalhost =
    currentHostname === "localhost" || currentHostname === "127.0.0.1" || currentHostname === "::1";

  // If the build is configured to talk to localhost, but the UI is being served from a remote
  // host (e.g. Tailscale IP/MagicDNS), use same-origin instead so Remote Access works.
  if (isLocalhost && !currentIsLocalhost) return "";

  return base;
}
