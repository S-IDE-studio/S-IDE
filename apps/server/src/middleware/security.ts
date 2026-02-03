import crypto from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";

// Security event logging
export function logSecurityEvent(event: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.warn(`[SECURITY] ${timestamp} ${event}:`, JSON.stringify(details));
}

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  c.header("X-Frame-Options", "DENY");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  // Allow Monaco Editor from CDN, Google Fonts, and blob: for workers
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' ws: wss:; worker-src 'self' blob:;"
  );
  await next();
};

// CSRF token store (in production, use Redis or similar)
const csrfTokens = new Map<string, { expiry: number; sessionHash: string }>();

// Clean up expired tokens every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [token, data] of csrfTokens.entries()) {
      if (now > data.expiry) {
        csrfTokens.delete(token);
      }
    }
  },
  5 * 60 * 1000
).unref();

/**
 * Generate a CSRF token for state-changing operations
 */
export function generateCSRFToken(sessionIdentifier: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const sessionHash = crypto.createHash("sha256").update(sessionIdentifier).digest("hex");
  csrfTokens.set(token, {
    expiry: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    sessionHash,
  });
  return token;
}

/**
 * Validate a CSRF token
 */
export function validateCSRFToken(token: string, sessionIdentifier: string): boolean {
  const data = csrfTokens.get(token);
  if (!data) {
    return false;
  }

  // Check expiration
  if (Date.now() > data.expiry) {
    csrfTokens.delete(token);
    return false;
  }

  // Verify session binding
  const sessionHash = crypto.createHash("sha256").update(sessionIdentifier).digest("hex");
  if (data.sessionHash !== sessionHash) {
    csrfTokens.delete(token);
    logSecurityEvent("CSRF_TOKEN_SESSION_MISMATCH", { sessionIdentifier });
    return false;
  }

  // One-time use - remove after validation
  csrfTokens.delete(token);
  return true;
}

/**
 * CSRF protection middleware for state-changing operations
 * Checks for CSRF token in header or request body
 */
export function csrfProtection(
  options: { ignoreMethods?: string[]; getToken?: (c: Context) => string | undefined } = {}
): MiddlewareHandler {
  const { ignoreMethods = ["GET", "HEAD", "OPTIONS"], getToken } = options;

  return async (c, next) => {
    // Skip CSRF check for safe methods
    if (ignoreMethods.includes(c.req.method)) {
      return next();
    }

    // Get session identifier (e.g., from Basic auth or session)
    const sessionIdentifier =
      c.get("sessionIdentifier") || c.req.header("authorization") || "anonymous";

    // Try to get token from header first
    let token = c.req.header("x-csrf-token");

    // Fall back to custom token getter if provided
    if (!token && getToken) {
      token = getToken(c);
    }

    // Validate token
    if (!token || !validateCSRFToken(token, sessionIdentifier)) {
      logSecurityEvent("CSRF_VALIDATION_FAILED", {
        method: c.req.method,
        path: c.req.path,
        hasToken: !!token,
      });
      return c.json({ error: "Invalid CSRF token" }, 403);
    }

    return next();
  };
}
