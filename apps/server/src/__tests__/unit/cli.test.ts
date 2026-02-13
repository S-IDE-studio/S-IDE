import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { program } from "../../cli.js";

describe("CLI", () => {
  let mockExit: any;
  let mockStdout: any;

  beforeEach(() => {
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    mockStdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockStdout.mockRestore();
  });

  it("should have correct CLI name and description", () => {
    expect(program.name()).toBe("side-server");
    expect(program.description()).toContain("S-IDE Server");
  });

  it("should display version information", () => {
    const testProgram = program.exitOverride();

    try {
      testProgram.parse(["node", "cli", "--version"], { from: "user" });
    } catch (err: any) {
      // Commander throws on --version with exitOverride
      expect(err.code).toBe("commander.version");
    }

    expect(mockStdout).toHaveBeenCalled();
    const output = mockStdout.mock.calls.map((call: any) => call[0]).join("");
    expect(output).toMatch(/\d+\.\d+\.\d+/); // Matches version pattern
  });

  it("should display help text", () => {
    const helpText = program.helpInformation();
    expect(helpText).toContain("side-server");
    expect(helpText).toContain("S-IDE Server");
    expect(helpText).toContain("--version");
    expect(helpText).toContain("--help");
  });
});
