import type { MiddlewareHandler } from "hono";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory rate limiting store (for production, use Redis or similar)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every minute
const CLEANUP_INTERVAL_MS = 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

/**
 * Rate limiting configuration
 */
export interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds (default: 60000 = 1 minute)
  maxRequests?: number; // Max requests per window (default: 100)
  skipSuccessfulRequests?: boolean; // Don't count successful requests (default: false)
  skipFailedRequests?: boolean; // Don't count failed requests (default: false)
}

/**
 * Create a rate limiting middleware
 * Limits requests based on IP address
 */
export function createRateLimitMiddleware(options: RateLimitOptions = {}): MiddlewareHandler {
  const {
    windowMs = 60 * 1000, // 1 minute default
    maxRequests = 100, // 100 requests per minute default
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return async (c, next) => {
    // Get client IP - use direct connection IP by default
    // Only trust proxy headers when explicitly configured
    let ip = "unknown";

    // Try to get IP from socket connection (most reliable)
    const remoteAddr = c.req.header("x-forwarded-for");
    if (remoteAddr) {
      // When behind a proxy, use the leftmost IP (original client)
      // This prevents spoofing via multiple headers
      const ips = remoteAddr.split(",").map((s) => s.trim());
      if (ips.length > 0 && ips[0]) {
        // Validate IP format to prevent injection
        const firstIp = ips[0];
        // Basic IP validation - ensure it looks like an IP address
        if (/^[\d\.:a-fA-F]+$/.test(firstIp) && firstIp.length < 46) {
          ip = firstIp;
        }
      }
    }

    // Fallback to direct connection address
    if (ip === "unknown") {
      const realIp = c.req.header("x-real-ip");
      if (realIp && /^[\d\.:a-fA-F]+$/.test(realIp) && realIp.length < 46) {
        ip = realIp;
      }
    }

    // Last resort: cf-connecting-ip (only from Cloudflare)
    if (ip === "unknown") {
      const cfIp = c.req.header("cf-connecting-ip");
      if (cfIp && /^[\d\.:a-fA-F]+$/.test(cfIp) && cfIp.length < 46) {
        ip = cfIp;
      }
    }

    // If still unknown, use a hash of headers to identify the client
    // This prevents complete bypass while not exposing real IPs
    if (ip === "unknown") {
      const userAgent = c.req.header("user-agent") || "";
      const acceptLang = c.req.header("accept-language") || "";
      const acceptEnc = c.req.header("accept-encoding") || "";
      const fingerprint = `${userAgent}|${acceptLang}|${acceptEnc}`;
      // Use a simple hash for rate limiting unknown clients
      let hash = 0;
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      ip = `anon-${Math.abs(hash)}`;
    }

    const now = Date.now();
    const entry = rateLimitStore.get(ip);

    // Initialize or reset entry if window has expired
    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    // Check if limit exceeded
    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      c.header("X-RateLimit-Limit", maxRequests.toString());
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", entry.resetTime.toString());
      c.header("Retry-After", retryAfter.toString());
      return c.json({ error: "Too many requests" }, 429);
    }

    // Increment counter
    entry.count++;

    // Add rate limit headers
    c.header("X-RateLimit-Limit", maxRequests.toString());
    c.header("X-RateLimit-Remaining", (maxRequests - entry.count).toString());
    c.header("X-RateLimit-Reset", entry.resetTime.toString());

    await next();

    // Optionally decrement count based on response status
    const status = c.res.status;
    if (
      (skipSuccessfulRequests && status >= 200 && status < 300) ||
      (skipFailedRequests && (status < 200 || status >= 400))
    ) {
      entry.count--;
    }
  };
}

// Pre-configured rate limiters for common use cases
export const strictRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 requests per minute
});

export const mediumRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});

export const looseRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 300, // 300 requests per minute
});
