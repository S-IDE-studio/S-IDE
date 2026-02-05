/**
 * Unit tests for authentication middleware
 * Tests timing-safe comparison and basic auth
 */

import { Hono } from "hono";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Set environment variables BEFORE importing the auth module
process.env.BASIC_AUTH_USER = "admin";
process.env.BASIC_AUTH_PASSWORD = "secure_password_123";

// Dynamic import after setting env vars
let basicAuthMiddleware: any;
let verifyWebSocketAuth: any;
let isBasicAuthEnabled: any;

describe("Authentication Middleware", () => {
  beforeAll(async () => {
    const authModule = await import("../../middleware/auth.js");
    basicAuthMiddleware = authModule.basicAuthMiddleware;
    verifyWebSocketAuth = authModule.verifyWebSocketAuth;
    isBasicAuthEnabled = authModule.isBasicAuthEnabled;
  });

  let app: Hono;

  beforeEach(() => {
    app = new Hono();

    // Use the actual exported middleware
    if (basicAuthMiddleware) {
      app.use("*", basicAuthMiddleware);
    }

    app.get("/protected", (c) => {
      return c.json({ message: "authenticated" });
    });
  });

  describe("basic authentication", () => {
    it("should authenticate with correct credentials", async () => {
      const credentials = btoa("admin:secure_password_123");

      const response = await app.request("/protected", {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ message: "authenticated" });
    });

    it("should reject incorrect username", async () => {
      const credentials = btoa("wrong_user:secure_password_123");

      const response = await app.request("/protected", {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      });

      // Hono's basicAuth middleware returns 401 for invalid credentials
      expect(response.status).not.toBe(200);
    });

    it("should reject incorrect password", async () => {
      const credentials = btoa("admin:wrong_password");

      const response = await app.request("/protected", {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      });

      expect(response.status).not.toBe(200);
    });

    it("should reject missing Authorization header", async () => {
      const response = await app.request("/protected");

      expect(response.status).not.toBe(200);
    });

    it("should reject malformed Authorization header", async () => {
      const testCases = [
        "Basic", // Missing credentials
        "Bearer token", // Wrong auth type
        "Basic invalid_base64=", // Invalid base64
        `Basic ${btoa("no_colon")}`, // Missing colon separator
        "BasicNotEncoded", // Not properly formatted
      ];

      for (const authHeader of testCases) {
        const response = await app.request("/protected", {
          headers: {
            Authorization: authHeader,
          },
        });

        expect(response.status).not.toBe(200);
      }
    });

    it("should reject empty username or password", async () => {
      const testCases = [
        btoa(":secure_password_123"), // Empty username
        btoa("admin:"), // Empty password
        btoa(":"), // Both empty
      ];

      for (const credentials of testCases) {
        const response = await app.request("/protected", {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        });

        expect(response.status).not.toBe(200);
      }
    });
  });

  describe("security edge cases", () => {
    it("should reject SQL injection attempts", async () => {
      const injectionAttempts = [
        "' OR '1'='1",
        "admin' --",
        "admin' /*",
        "admin' OR 1=1#",
        "'; DROP TABLE users; --",
      ];

      for (const attempt of injectionAttempts) {
        const credentials = btoa(`${attempt}:password`);

        const response = await app.request("/protected", {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        });

        expect(response.status).not.toBe(200);
      }
    });

    it("should handle very long credentials", async () => {
      const longUser = "a".repeat(10000);
      const longPass = "b".repeat(10000);

      const credentials = btoa(`${longUser}:${longPass}`);

      const response = await app.request("/protected", {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      });

      // Should either authenticate or reject without crashing
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });

    it("should handle special characters in credentials", async () => {
      const specialCases = [
        { user: "admin@example.com", pass: "p@ssw0rd!" },
        { user: "admin/user", pass: "pass:word" },
        { user: "admin user", pass: "pass word" },
      ];

      for (const { user, pass } of specialCases) {
        const credentials = btoa(`${user}:${pass}`);

        const response = await app.request("/protected", {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        });

        // Should handle without crashing (will likely 401 since not correct)
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(500);
      }
    });

    it("should handle null bytes in credentials", async () => {
      const nullByteCases = [
        "ad\x00min:secure_password_123",
        "admin:sec\x00ure_password",
        "\x00admin:secure_password_123",
      ];

      for (const creds of nullByteCases) {
        const credentials = btoa(creds);

        const response = await app.request("/protected", {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        });

        // Should reject (null bytes make credentials invalid)
        expect(response.status).not.toBe(200);
      }
    });
  });

  describe("case sensitivity", () => {
    it("should be case-sensitive for username", async () => {
      const caseVariations = [
        "Admin:secure_password_123",
        "ADMIN:secure_password_123",
        "aDmIn:secure_password_123",
      ];

      for (const creds of caseVariations) {
        const credentials = btoa(creds);

        const response = await app.request("/protected", {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        });

        expect(response.status).not.toBe(200);
      }
    });

    it("should be case-sensitive for password", async () => {
      const caseVariations = [
        "admin:SECURE_PASSWORD_123",
        "admin:Secure_Password_123",
        "admin:sEcUrE_pAsSwOrD_123",
      ];

      for (const creds of caseVariations) {
        const credentials = btoa(creds);

        const response = await app.request("/protected", {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        });

        expect(response.status).not.toBe(200);
      }
    });
  });

  describe("concurrent authentication attempts", () => {
    it("should handle multiple simultaneous requests", async () => {
      // Mix of correct and incorrect credentials
      const requests = [
        app.request("/protected", {
          headers: { Authorization: `Basic ${btoa("admin:secure_password_123")}` },
        }),
        app.request("/protected", {
          headers: { Authorization: `Basic ${btoa("wrong:password")}` },
        }),
        app.request("/protected", {
          headers: { Authorization: `Basic ${btoa("admin:secure_password_123")}` },
        }),
        app.request("/protected", {
          headers: {}, // No auth header
        }),
      ];

      const responses = await Promise.all(requests);

      // First and third should succeed (correct credentials)
      expect(responses[0].status).toBe(200);
      expect(responses[2].status).toBe(200);

      // Second and fourth should fail
      expect(responses[1].status).not.toBe(200);
      expect(responses[3].status).not.toBe(200);
    });
  });

  describe("utility functions", () => {
    it("should report that basic auth is enabled", () => {
      expect(isBasicAuthEnabled()).toBe(true);
    });

    it("should verify WebSocket auth with correct credentials", () => {
      const mockReq = {
        url: "/ws",
        headers: {
          authorization: `Basic ${btoa("admin:secure_password_123")}`,
        },
      } as any;

      expect(verifyWebSocketAuth(mockReq)).toBe(true);
    });

    it("should reject WebSocket auth with incorrect credentials", () => {
      const mockReq = {
        url: "/ws",
        headers: {
          authorization: `Basic ${btoa("wrong:password")}`,
        },
      } as any;

      expect(verifyWebSocketAuth(mockReq)).toBe(false);
    });

    it("should reject WebSocket auth without credentials", () => {
      const mockReq = {
        url: "/ws",
        headers: {},
      } as any;

      expect(verifyWebSocketAuth(mockReq)).toBe(false);
    });
  });
});
