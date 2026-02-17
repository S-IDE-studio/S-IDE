import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigManager } from "../../utils/config-manager.js";

describe("ConfigManager", () => {
  let testDir: string;
  let configManager: ConfigManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    testDir = join(tmpdir(), `side-ide-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    configManager = new ConfigManager(join(testDir, "config.json"));

    // Save original environment and clear all config-related env vars
    originalEnv = { ...process.env };
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.MAX_FILE_SIZE;
    delete process.env.TERMINAL_BUFFER_LIMIT;
    delete process.env.DEFAULT_ROOT;
    delete process.env.BASIC_AUTH_USER;
    delete process.env.BASIC_AUTH_PASS;
    // Also clear any other potential env vars that might interfere
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should load default configuration", () => {
    configManager.load();

    const config = configManager.list();
    expect(config.port).toBe(8787);
    expect(config.host).toBe("0.0.0.0");
    expect(config.maxFileSize).toBe(10485760); // 10MB
    expect(config.terminalBufferLimit).toBe(50000);
  });

  it("should save and load configuration", () => {
    configManager.load();
    configManager.set("port", 9000);
    configManager.set("host", "localhost");
    configManager.save();

    // Clear any cached environment variables
    delete process.env.PORT;
    delete process.env.HOST;

    // Create new instance and load
    const newConfigManager = new ConfigManager(join(testDir, "config.json"));
    newConfigManager.load();

    expect(newConfigManager.get("port")).toBe(9000);
    expect(newConfigManager.get("host")).toBe("localhost");
  });

  it("should merge environment variables with config", () => {
    // Set environment variables
    process.env.PORT = "3000";
    process.env.HOST = "127.0.0.1";
    process.env.MAX_FILE_SIZE = "5242880";

    configManager.load();

    // Environment variables should override config
    expect(configManager.get("port")).toBe(3000);
    expect(configManager.get("host")).toBe("127.0.0.1");
    expect(configManager.get("maxFileSize")).toBe(5242880);
  });

  it("should get and set individual values", () => {
    configManager.load();

    // Test get
    expect(configManager.get("port")).toBe(8787);

    // Test set
    configManager.set("port", 9090);
    expect(configManager.get("port")).toBe(9090);

    // Test optional values
    configManager.set("defaultRoot", "/home/user");
    expect(configManager.get("defaultRoot")).toBe("/home/user");

    configManager.set("basicAuthUser", "admin");
    expect(configManager.get("basicAuthUser")).toBe("admin");
  });

  it("should list all configuration", () => {
    configManager.load();
    configManager.set("port", 8080);
    configManager.set("basicAuthUser", "testuser");

    const config = configManager.list();

    expect(config.port).toBe(8080);
    expect(config.host).toBe("0.0.0.0");
    expect(config.basicAuthUser).toBe("testuser");

    // Should return a copy, not the original
    config.port = 9999;
    expect(configManager.get("port")).toBe(8080);
  });

  it("should handle invalid JSON gracefully", () => {
    // Write invalid JSON to file
    writeFileSync(join(testDir, "config.json"), "{ invalid json }", "utf-8");

    configManager.load();

    // Should fall back to defaults
    const config = configManager.list();
    expect(config.port).toBe(8787);
    expect(config.host).toBe("0.0.0.0");
  });

  it("should ignore invalid environment variable types", () => {
    process.env.PORT = "not-a-number";
    process.env.MAX_FILE_SIZE = "abc123";

    configManager.load();

    // Should keep defaults when env vars are invalid
    expect(configManager.get("port")).toBe(8787);
    expect(configManager.get("maxFileSize")).toBe(10485760);

    delete process.env.PORT;
    delete process.env.MAX_FILE_SIZE;
  });

  it("should ignore empty environment variable values", () => {
    process.env.PORT = "";
    process.env.HOST = "   "; // whitespace only
    process.env.MAX_FILE_SIZE = "";

    configManager.load();

    // Should keep defaults
    expect(configManager.get("port")).toBe(8787);
    expect(configManager.get("host")).toBe("0.0.0.0");
    expect(configManager.get("maxFileSize")).toBe(10485760);

    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.MAX_FILE_SIZE;
  });
});
