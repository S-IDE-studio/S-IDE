import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { registerStartCommand } from "../../../commands/start.js";

describe("start command", () => {
  it("should register start command with correct options", () => {
    const program = new Command();
    registerStartCommand(program);

    const startCommand = program.commands.find((cmd) => cmd.name() === "start");
    expect(startCommand).toBeDefined();
    expect(startCommand?.description()).toBe("Start the S-IDE server");

    const options = startCommand?.options;
    expect(options).toBeDefined();
    expect(options?.length).toBe(3);

    // Check port option
    const portOption = options?.find((opt) => opt.short === "-p");
    expect(portOption).toBeDefined();
    expect(portOption?.long).toBe("--port");
    expect(portOption?.description).toContain("Port");

    // Check host option
    const hostOption = options?.find((opt) => opt.short === "-h");
    expect(hostOption).toBeDefined();
    expect(hostOption?.long).toBe("--host");
    expect(hostOption?.description).toContain("Host");

    // Check daemon option
    const daemonOption = options?.find((opt) => opt.short === "-d");
    expect(daemonOption).toBeDefined();
    expect(daemonOption?.long).toBe("--daemon");
    expect(daemonOption?.description).toContain("daemon");
  });
});
