import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PidManager } from "../../utils/pid-manager.js";

describe("PidManager", () => {
  let testDir: string;
  let pidManager: PidManager;

  beforeEach(() => {
    testDir = join(tmpdir(), `side-ide-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    pidManager = new PidManager(join(testDir, "test.pid"));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should write PID to file", () => {
    const pid = process.pid;
    pidManager.write(pid);

    expect(pidManager.exists()).toBe(true);
    expect(pidManager.read()).toBe(pid);
  });

  it("should return null when PID file does not exist", () => {
    expect(pidManager.read()).toBe(null);
  });

  it("should remove PID file", () => {
    pidManager.write(process.pid);
    expect(pidManager.exists()).toBe(true);

    pidManager.remove();
    expect(pidManager.exists()).toBe(false);
  });

  it("should check if process is running", () => {
    pidManager.write(process.pid);
    expect(pidManager.isProcessRunning()).toBe(true);
  });

  it("should return false for non-existent process", () => {
    pidManager.write(999999); // Non-existent PID
    expect(pidManager.isProcessRunning()).toBe(false);
  });

  it("should handle corrupted PID file gracefully", () => {
    writeFileSync(pidManager.getPath(), "not-a-number", "utf-8");
    expect(pidManager.read()).toBe(null);
  });

  it("should handle PID file with whitespace", () => {
    writeFileSync(pidManager.getPath(), "  12345\n\n  ", "utf-8");
    expect(pidManager.read()).toBe(12345);
  });

  it("should throw on invalid PID values", () => {
    expect(() => pidManager.write(-1)).toThrow(TypeError);
    expect(() => pidManager.write(0)).toThrow(TypeError);
    expect(() => pidManager.write(1.5)).toThrow(TypeError);
  });

  it("should return PID file path", () => {
    expect(pidManager.getPath()).toBe(join(testDir, "test.pid"));
  });

  it("should create nested directories", () => {
    const deepPath = join(testDir, "a", "b", "c", "test.pid");
    const deepManager = new PidManager(deepPath);
    deepManager.write(process.pid);
    expect(deepManager.exists()).toBe(true);
    deepManager.remove(); // cleanup
  });
});
