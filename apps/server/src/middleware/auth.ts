import crypto from "node:crypto";
import { basicAuth } from "hono/basic-auth";
import { BASIC_AUTH_PASSWORD, BASIC_AUTH_USER } from "../config.js";

export const basicAuthMiddleware =
  BASIC_AUTH_USER && BASIC_AUTH_PASSWORD
    ? basicAuth({ username: BASIC_AUTH_USER, password: BASIC_AUTH_PASSWORD })
    : undefined;

// WebSocket token management
const WS_TOKEN_TTL_MS = 30 * 1000; // 30 seconds
interface WsTokenEntry {
  expiry: number;
  ipAddress: string;
}
const wsTokens = new Map<string, WsTokenEntry>(); // token -> { expiry, ipAddress }

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of wsTokens.entries()) {
    if (now > entry.expiry) {
      wsTokens.delete(token);
    }
  }
}, 10000).unref();

/**
 * Generate a one-time WebSocket token bound to an IP address
 */
export function generateWsToken(ipAddress: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  wsTokens.set(token, {
    expiry: Date.now() + WS_TOKEN_TTL_MS,
    ipAddress,
  });
  return token;
}

/**
 * Validate and consume a WebSocket token
 * Verifies the token exists, has not expired, and matches the IP address
 */
export function validateWsToken(token: string, ipAddress: string): boolean {
  const entry = wsTokens.get(token);
  if (!entry) {
    return false;
  }
  // Check IP binding to prevent token theft
  if (entry.ipAddress !== ipAddress) {
    console.warn(`WebSocket token IP mismatch: expected ${entry.ipAddress}, got ${ipAddress}`);
    wsTokens.delete(token); // Delete invalid token
    return false;
  }
  wsTokens.delete(token); // One-time use
  return Date.now() <= entry.expiry;
}

/**
 * Check if Basic Auth is enabled
 */
export function isBasicAuthEnabled(): boolean {
  return Boolean(BASIC_AUTH_USER && BASIC_AUTH_PASSWORD);
}

export function verifyWebSocketAuth(req: import("http").IncomingMessage): boolean {
  // Extract IP address from various headers with validation
  const forwardedFor = req.headers["x-forwarded-for"];
  const realIp = req.headers["x-real-ip"];
  const cfConnectingIp = req.headers["cf-connecting-ip"];

  // Validate and extract IP
  let clientIp = "unknown";
  if (forwardedFor && typeof forwardedFor === "string") {
    const ips = forwardedFor.split(",").map((s) => s.trim());
    if (ips.length > 0 && ips[0] && /^[\d\.:a-fA-F]+$/.test(ips[0]) && ips[0].length < 46) {
      clientIp = ips[0];
    }
  }
  if (clientIp === "unknown" && realIp && typeof realIp === "string") {
    if (/^[\d\.:a-fA-F]+$/.test(realIp) && realIp.length < 46) {
      clientIp = realIp;
    }
  }
  if (clientIp === "unknown" && cfConnectingIp && typeof cfConnectingIp === "string") {
    if (/^[\d\.:a-fA-F]+$/.test(cfConnectingIp) && cfConnectingIp.length < 46) {
      clientIp = cfConnectingIp;
    }
  }

  // Check for token in query string first (with IP binding)
  const url = new URL(req.url || "", "http://localhost");
  const token = url.searchParams.get("token");
  if (token && validateWsToken(token, clientIp)) {
    return true;
  }

  // If no valid token and Basic Auth is configured, check Basic Auth
  if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) {
    // No auth configured, allow connection for local development
    return true;
  }

  // Basic Auth is configured, require valid credentials
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }
  const base64Credentials = authHeader.slice("Basic ".length);
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  const colonIndex = credentials.indexOf(":");
  if (colonIndex === -1) {
    return false;
  }
  const username = credentials.substring(0, colonIndex);
  const password = credentials.substring(colonIndex + 1);

  // Use timing-safe comparison for passwords to prevent timing attacks
  // Pad both strings to the same length for constant-time comparison regardless of actual length
  const maxUsernameLen = Math.max(username.length, BASIC_AUTH_USER.length);
  const maxPasswordLen = Math.max(password.length, BASIC_AUTH_PASSWORD.length);

  const paddedUsername = username.padEnd(maxUsernameLen, "\0");
  const expectedUsername = BASIC_AUTH_USER.padEnd(maxUsernameLen, "\0");
  const paddedPassword = password.padEnd(maxPasswordLen, "\0");
  const expectedPassword = BASIC_AUTH_PASSWORD.padEnd(maxPasswordLen, "\0");

  const usernameBuffer = Buffer.from(paddedUsername, "utf8");
  const expectedUsernameBuffer = Buffer.from(expectedUsername, "utf8");
  const passwordBuffer = Buffer.from(paddedPassword, "utf8");
  const expectedPasswordBuffer = Buffer.from(expectedPassword, "utf8");

  if (!crypto.timingSafeEqual(usernameBuffer, expectedUsernameBuffer)) {
    return false;
  }

  return crypto.timingSafeEqual(passwordBuffer, expectedPasswordBuffer);
}
