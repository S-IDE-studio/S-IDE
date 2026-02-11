import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class PidManager {
  constructor(private pidFilePath: string) {}

  /**
   * Write PID to file
   */
  write(pid: number): void {
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new TypeError(`Invalid PID: ${pid}. Must be a positive integer.`);
    }
    const dir = dirname(this.pidFilePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.pidFilePath, pid.toString(), "utf-8");
  }

  /**
   * Read PID from file
   */
  read(): number | null {
    if (!this.exists()) {
      return null;
    }
    try {
      const content = readFileSync(this.pidFilePath, "utf-8");
      const pid = Number.parseInt(content.trim(), 10);
      return Number.isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  /**
   * Check if PID file exists
   */
  exists(): boolean {
    return existsSync(this.pidFilePath);
  }

  /**
   * Remove PID file
   */
  remove(): void {
    try {
      unlinkSync(this.pidFilePath);
    } catch (error) {
      // Ignore ENOENT (file already gone), rethrow others
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * Check if the process from PID file is running
   *
   * Note: On Unix, returns true if process exists even if owned by another user.
   * On Windows, returns true if process exists regardless of owner.
   *
   * @returns true if process exists and is accessible or exists with permission denied
   */
  isProcessRunning(): boolean {
    const pid = this.read();
    if (pid === null) {
      return false;
    }

    try {
      // Sending signal 0 checks if process exists without killing it
      process.kill(pid, 0);
      return true;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      // EPERM = process exists but no permission (Unix only)
      if (err.code === "EPERM") {
        return true; // Process exists but we can't signal it
      }
      // ESRCH = process doesn't exist
      return false;
    }
  }

  /**
   * Get PID file path
   */
  getPath(): string {
    return this.pidFilePath;
  }
}
