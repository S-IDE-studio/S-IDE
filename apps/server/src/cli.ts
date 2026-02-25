#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerAgentCommands } from "./commands/agent.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerMCPCommands } from "./commands/mcp.js";
import { registerStartCommand } from "./commands/start.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerTerminalCommands } from "./commands/terminal.js";
import { registerUsageCommands } from "./commands/usage.js";

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let packageJson: { version: string };
try {
  packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
  if (!packageJson.version) {
    throw new Error("Missing version field in package.json");
  }
} catch (error) {
  console.error(
    "Failed to load package.json:",
    error instanceof Error ? error.message : "Unknown error"
  );
  process.exit(1);
}

export const program = new Command();

program
  .name("side-server")
  .description("S-IDE Backend Server - AI-optimized development environment")
  .version(packageJson.version);

// Register commands
registerStartCommand(program);
registerStatusCommand(program);
registerAgentCommands(program);
registerTerminalCommands(program);
registerMCPCommands(program);
registerConfigCommands(program);
registerUsageCommands(program);

// Only parse args if this file is run directly (not imported)
// Check if we're the main module by comparing resolved paths
const isMainModule = (() => {
  try {
    return process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isMainModule) {
  program.parse(process.argv);
}
