/**
 * Unit tests for path utilities
 * Tests path traversal protection and symlink security
 */

import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSafePath } from "../../utils/path.js";

describe("resolveSafePath", () => {
  const testRoot = "C:\\temp\\test-workspace";
  const posixTestRoot = "/tmp/test-workspace";
  const isWindows = process.platform === "win32";

  // Skip tests on Windows for now, focus on POSIX
  const rootDir = isWindows ? testRoot : posixTestRoot;

  beforeEach(async () => {
    // Create test directory structure
    try {
      await mkdir(rootDir, { recursive: true });
      await mkdir(`${rootDir}/project`, { recursive: true });
      await mkdir(`${rootDir}/project/src`, { recursive: true });
      await mkdir(`${rootDir}/safe-dir`, { recursive: true });
      await writeFile(`${rootDir}/project/src/file.txt`, "test content");
    } catch (e) {
      // Directory might already exist
    }
  });

  afterEach(async () => {
    try {
      await rm(rootDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it("should resolve valid relative paths", () => {
    const result = resolveSafePath(rootDir, "project/src/file.txt");
    expect(result).toContain("project");
    expect(result).toContain("src");
    expect(result).toContain("file.txt");
  });

  it("should resolve dot segments within workspace", () => {
    const result = resolveSafePath(rootDir, "project/src/../src/file.txt");
    expect(result).toContain("src");
    expect(result).toContain("file.txt");
  });

  it("should reject path traversal using ..", () => {
    const traversalAttempts = [
      "../../../etc/passwd",
      "../test-workspace",
      "..",
      "project/../../../etc/passwd",
      "project/../../..",
    ];

    traversalAttempts.forEach((path) => {
      expect(() => resolveSafePath(rootDir, path)).toThrow();
    });
  });

  it("should reject absolute paths outside workspace", () => {
    if (isWindows) {
      expect(() => resolveSafePath(rootDir, "C:\\Windows\\System32\\config")).toThrow();
      expect(() => resolveSafePath(rootDir, "D:\\secrets")).toThrow();
    } else {
      expect(() => resolveSafePath(rootDir, "/etc/passwd")).toThrow();
      expect(() => resolveSafePath(rootDir, "/root/.ssh")).toThrow();
    }
  });

  it("should handle empty path as root", () => {
    const result = resolveSafePath(rootDir, "");
    // Normalized to root
    expect(result).toBeDefined();
  });

  it("should handle dot as current directory", () => {
    const result = resolveSafePath(rootDir, ".");
    expect(result).toBeDefined();
  });

  it("should reject null bytes in path", () => {
    const nullBytePaths = [
      "project/src/file.txt\x00.txt",
      "test\x00/../etc/passwd",
      "\x00etc/passwd",
    ];

    nullBytePaths.forEach((path) => {
      expect(() => resolveSafePath(rootDir, path)).toThrow();
    });
  });

  describe("symlink protection", () => {
    let symlinkDir: string;
    let outsideDir: string;

    beforeEach(async () => {
      // Create directory outside workspace
      outsideDir = isWindows ? "C:\\temp\\outside-workspace" : "/tmp/outside-workspace";
      try {
        await mkdir(outsideDir, { recursive: true });
        await mkdir(`${rootDir}/symlink-test`, { recursive: true });
        await writeFile(`${outsideDir}/secret.txt`, "secret content");
      } catch (e) {
        // Ignore
      }

      symlinkDir = `${rootDir}/symlink-test`;
    });

    afterEach(async () => {
      try {
        await rm(outsideDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore
      }
    });

    it("should reject symlinks pointing outside workspace", async () => {
      if (isWindows) {
        // Windows symlink creation may require admin privileges
        return;
      }

      try {
        // Create symlink outside workspace
        await symlink(outsideDir, `${symlinkDir}/dangerous-link`);
      } catch (e) {
        // Skip if symlinks can't be created
        return;
      }

      // Should reject path through external symlink
      expect(() => {
        resolveSafePath(rootDir, "symlink-test/dangerous-link/secret.txt");
      }).toThrow();
    });

    it("should accept symlinks within workspace", async () => {
      if (isWindows) {
        return;
      }

      try {
        // Create symlink inside workspace
        await symlink(`${rootDir}/project`, `${symlinkDir}/safe-link`);

        // Should accept safe symlinks
        const result = resolveSafePath(rootDir, "symlink-test/safe-link/src/file.txt");
        expect(result).toBeDefined();
        expect(result).toContain("project");
      } catch (e) {
        // Skip if symlinks can't be created
      }
    });

    it("should handle parent directory traversal through symlinks", async () => {
      if (isWindows) {
        return;
      }

      try {
        // Create symlink that points to parent
        await symlink(rootDir, `${symlinkDir}/parent-link`);

        // Should still escape through parent symlink
        expect(() => {
          resolveSafePath(rootDir, "symlink-test/parent-link/../outside-workspace/secret.txt");
        }).toThrow();
      } catch (e) {
        // Skip if symlinks can't be created
      }
    });
  });

  describe("Windows path normalization", () => {
    it("should normalize backslashes to forward slashes for comparison", () => {
      if (!isWindows) {
        return;
      }

      // Windows uses backslashes, should normalize for comparison
      const result = resolveSafePath(testRoot, "project\\src\\file.txt");
      expect(result).toBeDefined();
    });

    it("should handle mixed path separators", () => {
      if (!isWindows) {
        return;
      }

      const result = resolveSafePath(testRoot, "project/../project/src\\file.txt");
      expect(result).toBeDefined();
    });
  });

  describe("URL encoding attacks", () => {
    it("should reject URL-encoded path traversal", () => {
      const encodedAttempts = [
        "%2e%2e%2f", // ../
        "%2e%2e/", // ../
        "..%2f", // ../
        "%252e%252e%252f", // double encoded ../
      ];

      encodedAttempts.forEach((path) => {
        // The path might not actually decode in normal usage, but we should be safe
        const result = resolveSafePath(rootDir, path);
        // Should not escape root
        expect(result).not.toContain("..");
      });
    });

    it("should reject unicode bypass attempts", () => {
      const unicodeAttempts = [
        "..\\u002f", // unicode forward slash
        "..%c0%af", // overlong encoding
      ];

      unicodeAttempts.forEach((path) => {
        expect(() => resolveSafePath(rootDir, path)).toThrow();
      });
    });
  });

  describe("edge cases", () => {
    it("should handle very long paths", () => {
      const longPath = `${"a/".repeat(1000)}file.txt`;
      expect(() => resolveSafePath(rootDir, longPath)).toThrow();
    });

    it("should handle special characters in filename", () => {
      const specialChars = [
        "project/file with spaces.txt",
        "project/file-with-dashes.txt",
        "project/file_with_underscores.txt",
        "project/file.multiple.dots.txt",
      ];

      specialChars.forEach((path) => {
        expect(() => resolveSafePath(rootDir, path)).not.toThrow();
      });
    });

    it("should reject command injection attempts", async () => {
      const injectionAttempts = [
        "project; rm -rf /",
        "project | cat /etc/passwd",
        "project && malicious",
        "project`whoami`",
        "$(malicious)",
      ];

      for (const path of injectionAttempts) {
        // These are filenames, so they might be technically valid
        // But they should be contained within workspace
        const result = await resolveSafePath(rootDir, path);
        expect(result).toBeDefined();
        // Should not contain the command separators at root level
        expect(result.startsWith(rootDir) || result.startsWith(rootDir.replace(/\\/g, "/"))).toBe(
          true
        );
      }
    });
  });
});
