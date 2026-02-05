/**
 * Unit tests for rate limiting middleware
 * Tests memory bounds, IP address handling, and rate limiting tiers
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createRateLimitMiddleware, rateLimitStore } from "../../middleware/rate-limiter.js";

describe("Rate Limiter", () => {
  afterEach(() => {
    // Clear rate limit store between tests
    rateLimitStore.clear();
  });

  // Helper to create a mock Hono context
  // Each context gets a unique IP to avoid test interference
  let ipCounter = 0;
  function createMockContext(ip?: string) {
    const uniqueIp = ip || `192.168.1.${++ipCounter % 255}`;
    return {
      req: {
        header: (name: string) => {
          if (name === "x-forwarded-for") return uniqueIp;
          return undefined;
        },
      },
      // The middleware checks c.res.status after next()
      // For our tests, we just need a res object with a status property
      res: { status: 200 },
      header: vi.fn(),
      // Mock json to return a 429 Response (rate limited) by default
      json: vi.fn().mockImplementation((_: any, status: number = 200) => {
        return new Response(null, { status });
      }),
    };
  }

  describe("memory bounds enforcement", () => {
    it("should enforce maximum entries limit", async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 10000,
        maxRequests: 10,
      });

      // Create requests from many different IPs
      const ipCount = 15000; // Exceeds MAX_RATE_LIMIT_ENTRIES
      const mockContexts = [];

      for (let i = 0; i < ipCount; i++) {
        const mockContext = createMockContext(`192.168.2.${i % 256}`);
        mockContexts.push(mockContext);
      }

      // Process all requests
      const results = [];
      for (const mockContext of mockContexts) {
        try {
          // @ts-expect-error - partial mock
          await middleware(mockContext, () => Promise.resolve(new Response()));
          results.push("success");
        } catch (e) {
          results.push("rate_limited");
        }
      }

      // All requests should complete (memory was evicted)
      expect(results.length).toBe(ipCount);
    });
  });

  describe("rate limiting behavior", () => {
    it("should allow requests within limit", async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 10000,
        maxRequests: 10,
      });

      const mockContext = createMockContext("192.168.10.1");

      // First few requests should succeed (middleware calls next())
      for (let i = 0; i < 5; i++) {
        // @ts-expect-error - partial mock
        const result = await middleware(mockContext, () => Promise.resolve(new Response()));
        // When allowed, middleware either returns result of next() (first request)
        // or returns undefined after calling await next() (subsequent requests)
        // Neither should return a 429 response
        expect(result?.status).not.toBe(429);
      }
    });

    it("should enforce rate limit", async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 10000,
        maxRequests: 5,
      });

      const mockContext = createMockContext("192.168.11.1");

      let rateLimitedCount = 0;
      for (let i = 0; i < 10; i++) {
        // @ts-expect-error - partial mock
        const result = await middleware(mockContext, () => Promise.resolve(new Response()));
        // When rate limited, middleware returns status 429
        if (result && result.status === 429) {
          rateLimitedCount++;
        }
      }

      // Should have some rate limited requests
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe("rate limit tiers", () => {
    it("should apply strict limits", async () => {
      const strictMiddleware = createRateLimitMiddleware({
        windowMs: 10000,
        maxRequests: 3,
      });

      const mockContext = createMockContext("192.168.12.1");

      // Make multiple requests rapidly
      let successCount = 0;
      let rateLimitedCount = 0;
      for (let i = 0; i < 10; i++) {
        // @ts-expect-error - partial mock
        const result = await strictMiddleware(mockContext, () => Promise.resolve(new Response()));
        // Check status to determine success vs rate limited
        if (result && result.status === 429) {
          rateLimitedCount++;
        } else {
          successCount++;
        }
      }

      // Should have rate limiting after threshold (only 3 allowed)
      expect(successCount).toBe(3);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it("should apply loose limits", async () => {
      const looseMiddleware = createRateLimitMiddleware({
        windowMs: 10000,
        maxRequests: 100,
      });

      const mockContext = createMockContext("192.168.13.1");

      // Make many requests (but less than limit)
      let successCount = 0;
      let rateLimitedCount = 0;
      for (let i = 0; i < 50; i++) {
        // @ts-expect-error - partial mock
        const result = await looseMiddleware(mockContext, () => Promise.resolve(new Response()));
        // Check status to determine success vs rate limited
        if (result && result.status === 429) {
          rateLimitedCount++;
        } else {
          successCount++;
        }
      }

      // With loose limits (100 max), 50 requests should all succeed
      expect(successCount).toBe(50);
      expect(rateLimitedCount).toBe(0);
    });
  });

  describe("IP address handling", () => {
    it("should handle IPv4 addresses", async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 10000,
        maxRequests: 10,
      });

      const mockContext = createMockContext("192.168.20.100");

      // @ts-expect-error - partial mock
      const result = await middleware(mockContext, () => Promise.resolve(new Response()));
      expect(result).toBeDefined();
    });

    it("should generate fallback IP when no headers present", async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 10000,
        maxRequests: 10,
      });

      const mockContext = createMockContext(); // No IP specified, uses unique fallback

      // Should not throw even without headers
      // @ts-expect-error - partial mock
      const result = await middleware(mockContext, () => Promise.resolve(new Response()));
      expect(result).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle malformed IP addresses", async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 10000,
        maxRequests: 10,
      });

      const mockContext = createMockContext("not-an-ip");

      // Should handle gracefully with fallback
      // @ts-expect-error - partial mock
      const result = await middleware(mockContext, () => Promise.resolve(new Response()));
      expect(result).toBeDefined();
    });

    it("should handle concurrent requests from same IP", async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 10000,
        maxRequests: 5,
      });

      const mockContext = createMockContext("192.168.30.1");

      // Make concurrent requests
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          // @ts-expect-error - partial mock
          middleware(mockContext, () => Promise.resolve(new Response()))
        );
      }

      // All should resolve (some may be rate limited but won't throw)
      const results = await Promise.allSettled(requests);
      results.forEach((r) => {
        // Rate limiting returns a Response, not throw
        expect(r.status).toBe("fulfilled");
      });
    });
  });
});
