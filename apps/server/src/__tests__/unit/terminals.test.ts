/**
 * Unit tests for terminal environment variable sanitization
 * Tests control character removal and prefix validation
 */

import { describe, expect, it } from "vitest";

// Import the sanitizeEnvVars function
// Note: We need to access it from the terminals module
// For now, we'll test the logic independently

describe("Environment Variable Sanitization", () => {
  // Allowed prefixes from terminals.ts
  const ALLOWED_ENV_PREFIXES = ["CUSTOM_", "PROJECT_", "USER_", "npm_config_", "NODE_"];

  // Builtin environment variables
  const BUILTIN_ENV_VARS = [
    "PATH",
    "Path",
    "TERM",
    "HOME",
    "USER",
    "USERPROFILE",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "COLORTERM",
    "TERM_PROGRAM",
    "TERM_PROGRAM_VERSION",
    "MSYS2_PATH",
    "NODE_ENV",
    "DEBUG",
  ];

  function sanitizeEnvVars(env: Record<string, string> = {}): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      // Remove null bytes and control characters from key and value
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Testing control character sanitization
      const cleanKey = key.replace(/[\x00-\x1F]/g, "");
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Testing control character sanitization
      const cleanValue = String(value).replace(/[\x00-\x1F]/g, "");

      // Only allow variables with safe prefixes or built-in environment variables
      const isAllowedPrefix = ALLOWED_ENV_PREFIXES.some((prefix) => cleanKey.startsWith(prefix));
      const isBuiltinEnv = BUILTIN_ENV_VARS.includes(cleanKey);

      if (isAllowedPrefix || isBuiltinEnv) {
        result[cleanKey] = cleanValue;
      }
    }

    return result;
  }

  describe("prefix validation", () => {
    it("should allow variables with allowed prefixes", () => {
      const input = {
        CUSTOM_VAR: "value",
        PROJECT_ID: "123",
        USER_NAME: "test",
        npm_config_prefix: "/usr/local",
        NODE_ENV: "production",
      };

      const result = sanitizeEnvVars(input);

      expect(result).toHaveProperty("CUSTOM_VAR", "value");
      expect(result).toHaveProperty("PROJECT_ID", "123");
      expect(result).toHaveProperty("USER_NAME", "test");
      expect(result).toHaveProperty("npm_config_prefix", "/usr/local");
      expect(result).toHaveProperty("NODE_ENV", "production");
    });

    it("should reject variables without allowed prefixes", () => {
      const input = {
        MALICIOUS_VAR: "value",
        HACK_ME: "please",
        EVIL_ENV: "bad",
      };

      const result = sanitizeEnvVars(input);

      expect(result).not.toHaveProperty("MALICIOUS_VAR");
      expect(result).not.toHaveProperty("HACK_ME");
      expect(result).not.toHaveProperty("EVIL_ENV");
    });

    it("should allow built-in environment variables", () => {
      const input = {
        PATH: "/usr/bin:/bin",
        HOME: "/home/user",
        TERM: "xterm-256color",
        USER: "testuser",
        LANG: "en_US.UTF-8",
      };

      const result = sanitizeEnvVars(input);

      expect(result).toHaveProperty("PATH", "/usr/bin:/bin");
      expect(result).toHaveProperty("HOME", "/home/user");
      expect(result).toHaveProperty("TERM", "xterm-256color");
      expect(result).toHaveProperty("USER", "testuser");
      expect(result).toHaveProperty("LANG", "en_US.UTF-8");
    });

    it("should be case-sensitive for prefixes", () => {
      const input = {
        CUSTOM_VAR: "allowed",
        custom_var: "rejected", // lowercase
        Custom_VAR: "rejected", // mixed case
        CUSTOM__VAR: "allowed",
      };

      const result = sanitizeEnvVars(input);

      expect(result).toHaveProperty("CUSTOM_VAR");
      expect(result).toHaveProperty("CUSTOM__VAR");
      expect(result).not.toHaveProperty("custom_var");
      expect(result).not.toHaveProperty("Custom_VAR");
    });
  });

  describe("control character removal", () => {
    it("should remove null bytes from keys and keep if cleaned key is valid", () => {
      const input = {
        "CUSTOM\x00_VAR": "value",
        "PROJECT\x00ID": "123",
      };

      const result = sanitizeEnvVars(input);

      // Null bytes are removed from keys, making them valid
      expect(result).toHaveProperty("CUSTOM_VAR", "value");
      expect(result).not.toHaveProperty("PROJECT_ID"); // PROJECT_ is not an allowed prefix
    });

    it("should remove null bytes from values", () => {
      const input = {
        CUSTOM_VAR: "value\x00with\x00nulls",
      };

      const result = sanitizeEnvVars(input);

      expect(result).toHaveProperty("CUSTOM_VAR", "valuewithnulls");
    });

    it("should remove control characters in range 0x00-0x1F", () => {
      const input = {
        CUSTOM_VAR: "value\x01\x02\x03\x04\x05\x06\x07\x08\x0B\x0C\x0E\x0F\x10",
      };

      const result = sanitizeEnvVars(input);

      expect(result).toHaveProperty("CUSTOM_VAR", "value");
    });

    it("should not remove DEL character (0x7F) as it's outside 0x00-0x1F range", () => {
      const input = {
        CUSTOM_VAR: "value\x7F",
      };

      const result = sanitizeEnvVars(input);

      // 0x7F (DEL) is NOT in the range 0x00-0x1F, so it's preserved
      expect(result).toHaveProperty("CUSTOM_VAR", "value\x7F");
    });

    it("should remove tabs and newlines (0x09, 0x0A) from values", () => {
      const input = {
        CUSTOM_VAR: "value\twith\ttabs\nand\nnewlines",
      };

      const result = sanitizeEnvVars(input);

      // Tabs (0x09) and newlines (0x0A) are removed
      expect(result).toHaveProperty("CUSTOM_VAR", "valuewithtabsandnewlines");
    });

    it("should handle values with only control characters", () => {
      const input = {
        CUSTOM_VAR: "\x00\x01\x02\x03",
      };

      const result = sanitizeEnvVars(input);

      expect(result).toHaveProperty("CUSTOM_VAR", "");
    });
  });

  describe("security edge cases", () => {
    it("should prevent PATH injection attempts", () => {
      const input = {
        PATH: "/usr/bin:/bin",
        // Attempt to override PATH with malicious value
        EVIL_PATH: "/malicious:/bin",
        // Try to inject via custom prefix
        CUSTOM_PATH: "/etc:/usr/bin",
      };

      const result = sanitizeEnvVars(input);

      // Original PATH should be preserved
      expect(result).toHaveProperty("PATH", "/usr/bin:/bin");
      // EVIL_PATH should be rejected
      expect(result).not.toHaveProperty("EVIL_PATH");
      // CUSTOM_PATH should be allowed (has allowed prefix)
      expect(result).toHaveProperty("CUSTOM_PATH", "/etc:/usr/bin");
    });

    it("should prevent LD_PRELOAD and similar injection vectors", () => {
      const input = {
        LD_PRELOAD: "/malicious.so",
        LD_LIBRARY_PATH: "/evil/lib",
        DYLD_INSERT_LIBRARIES: "/bad.dylib",
        IFS: "/",
        CUSTOM_PRELOAD: "/custom.so",
      };

      const result = sanitizeEnvVars(input);

      // Dangerous variables should be rejected
      expect(result).not.toHaveProperty("LD_PRELOAD");
      expect(result).not.toHaveProperty("LD_LIBRARY_PATH");
      expect(result).not.toHaveProperty("DYLD_INSERT_LIBRARIES");
      expect(result).not.toHaveProperty("IFS");
      // But custom prefix is allowed
      expect(result).toHaveProperty("CUSTOM_PRELOAD", "/custom.so");
    });

    it("should handle shell metacharacters in values", () => {
      const input = {
        CUSTOM_VAR: "value; whoami",
        CUSTOM_CMD: "$(malicious)",
        CUSTOM_BACKTICK: "`evil`",
      };

      const result = sanitizeEnvVars(input);

      // Values are preserved (sanitization is for control chars, not shell chars)
      // Shell escaping should happen at spawn time
      expect(result).toHaveProperty("CUSTOM_VAR", "value; whoami");
      expect(result).toHaveProperty("CUSTOM_CMD", "$(malicious)");
      expect(result).toHaveProperty("CUSTOM_BACKTICK", "`evil`");
    });

    it("should prevent unicode spoofing attempts", () => {
      // Homograph attacks - using similar looking characters
      // Build keys dynamically to avoid esbuild errors with Unicode in object keys
      const input: Record<string, string> = {};
      input["CUST\u0130M_VAR"] = "value"; // İ instead of I
      input["CUSTOM\u200B_VAR"] = "value"; // Zero-width space
      input["CUSTOM\uFEFFVAR"] = "value"; // Zero-width no-break space

      const result = sanitizeEnvVars(input);

      // These should be rejected as they don't match the exact prefix
      expect(Object.keys(result)).toHaveLength(0);
    });

    it("should handle very long variable names", () => {
      const longName = `CUSTOM_${"A".repeat(10000)}`;

      const input = {
        [longName]: "value",
      };

      // Should not crash or hang
      const result = sanitizeEnvVars(input);

      // Long names are allowed if they have valid prefix
      expect(result).toHaveProperty(longName, "value");
    });

    it("should handle very long values", () => {
      const longValue = "A".repeat(100000);

      const input = {
        CUSTOM_VAR: longValue,
      };

      // Should not crash or hang
      const result = sanitizeEnvVars(input);

      expect(result).toHaveProperty("CUSTOM_VAR", longValue);
    });
  });

  describe("empty and undefined handling", () => {
    it("should handle empty object", () => {
      const result = sanitizeEnvVars({});

      expect(result).toEqual({});
    });

    it("should handle empty values", () => {
      const input = {
        CUSTOM_VAR: "",
        CUSTOM_VAR2: null as unknown as string,
        CUSTOM_VAR3: undefined as unknown as string,
      };

      const result = sanitizeEnvVars(input);

      // Empty string stays empty
      expect(result).toHaveProperty("CUSTOM_VAR", "");
      // null becomes "null" (String(null) = "null")
      expect(result).toHaveProperty("CUSTOM_VAR2", "null");
      // undefined becomes "undefined" (String(undefined) = "undefined")
      // Object.entries() includes keys with undefined values
      expect(result).toHaveProperty("CUSTOM_VAR3", "undefined");
    });

    it("should handle non-string values", () => {
      const input = {
        CUSTOM_NUM: 123 as unknown as string,
        CUSTOM_OBJ: {} as unknown as string,
        CUSTOM_BOOL: true as unknown as string,
      };

      const result = sanitizeEnvVars(input);

      // All values are converted to strings
      expect(result).toHaveProperty("CUSTOM_NUM", "123");
      expect(result).toHaveProperty("CUSTOM_OBJ", "[object Object]");
      expect(result).toHaveProperty("CUSTOM_BOOL", "true");
    });
  });

  describe("special character handling", () => {
    it("should preserve allowed special characters in values", () => {
      const input = {
        CUSTOM_PATH: "/usr/local/bin:/home/user/bin",
        CUSTOM_URL: "https://example.com:8080/path?query=value",
        CUSTOM_JSON: '{"key": "value"}',
        CUSTOM_SPECIAL: "!@#$%^&*()_+-=[]{}|;:,.<>?",
      };

      const result = sanitizeEnvVars(input);

      expect(result).toHaveProperty("CUSTOM_PATH", "/usr/local/bin:/home/user/bin");
      expect(result).toHaveProperty("CUSTOM_URL", "https://example.com:8080/path?query=value");
      expect(result).toHaveProperty("CUSTOM_JSON", '{"key": "value"}');
      expect(result).toHaveProperty("CUSTOM_SPECIAL", "!@#$%^&*()_+-=[]{}|;:,.<>?");
    });

    it("should handle unicode in values", () => {
      const input = {
        CUSTOM_UNICODE: "日本語テスト",
        CUSTOM_EMOJI: "🔥💻",
        CUSTOM_MIXED: "Test_测试_тест",
      };

      const result = sanitizeEnvVars(input);

      expect(result).toHaveProperty("CUSTOM_UNICODE", "日本語テスト");
      expect(result).toHaveProperty("CUSTOM_EMOJI", "🔥💻");
      expect(result).toHaveProperty("CUSTOM_MIXED", "Test_测试_тест");
    });

    it("should normalize line endings", () => {
      const input = {
        CUSTOM_CRLF: "line1\r\nline2",
        CUSTOM_LF: "line1\nline2",
        CUSTOM_CR: "line1\rline2",
      };

      const result = sanitizeEnvVars(input);

      // Control characters are removed including \r and \n
      expect(result).toHaveProperty("CUSTOM_CRLF", "line1line2");
      expect(result).toHaveProperty("CUSTOM_LF", "line1line2");
      expect(result).toHaveProperty("CUSTOM_CR", "line1line2");
    });
  });
});
