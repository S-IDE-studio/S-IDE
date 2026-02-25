/**
 * MCP Server Management Commands
 *
 * List, status, start, stop MCP servers
 */

import type { Command } from "commander";

interface MCPServer {
  name: string;
  status: "active" | "stopped" | "error";
  capabilities?: string[];
  error?: string;
}

export function registerMCPCommands(program: Command): void {
  const mcp = program.command("mcp").description("Manage MCP servers");

  // mcp list
  mcp
    .command("list")
    .description("List MCP servers")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (options: { port: string; host: string }) => {
      try {
        const response = await fetch(`http://${options.host}:${options.port}/api/mcp-status`);
        if (!response.ok) {
          console.error(`Failed to fetch MCP servers: ${response.statusText}`);
          process.exit(1);
        }

        const servers = (await response.json()) as MCPServer[];
        if (servers.length === 0) {
          console.log("No MCP servers registered.");
          return;
        }

        console.log("MCP Servers:");
        console.log("------------");
        for (const server of servers) {
          const statusIcon = server.status === "active" ? "●" : server.status === "error" ? "✗" : "○";
          console.log(`  ${statusIcon} ${server.name}`);
          console.log(`    Status: ${server.status}`);
          if (server.capabilities?.length) {
            console.log(`    Capabilities: ${server.capabilities.join(", ")}`);
          }
          if (server.error) {
            console.log(`    Error: ${server.error}`);
          }
          console.log("");
        }
      } catch (error) {
        console.error("Failed to connect to server:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // mcp status <server-name>
  mcp
    .command("status <server-name>")
    .description("Get MCP server status")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (serverName: string, options: { port: string; host: string }) => {
      try {
        const response = await fetch(`http://${options.host}:${options.port}/api/mcp-status`);
        if (!response.ok) {
          console.error(`Failed to fetch MCP servers: ${response.statusText}`);
          process.exit(1);
        }

        const servers = (await response.json()) as MCPServer[];
        const server = servers.find((s) => s.name === serverName);

        if (!server) {
          console.error(`MCP server not found: ${serverName}`);
          process.exit(1);
        }

        console.log(`MCP Server: ${server.name}`);
        console.log(`Status: ${server.status}`);
        if (server.capabilities?.length) {
          console.log(`Capabilities: ${server.capabilities.join(", ")}`);
        }
        if (server.error) {
          console.log(`Error: ${server.error}`);
        }
      } catch (error) {
        console.error("Failed to connect to server:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // mcp start <server-name>
  mcp
    .command("start <server-name>")
    .description("Start an MCP server (placeholder - starts the agent)")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (serverName: string, options: { port: string; host: string }) => {
      try {
        // Restart the agent which corresponds to the MCP server
        const response = await fetch(
          `http://${options.host}:${options.port}/api/agents/${serverName}/restart`,
          { method: "POST" }
        );

        if (!response.ok) {
          if (response.status === 404) {
            console.error(`MCP server not found: ${serverName}`);
          } else {
            console.error(`Failed to start MCP server: ${response.statusText}`);
          }
          process.exit(1);
        }

        console.log(`MCP server ${serverName} started.`);
      } catch (error) {
        console.error("Failed to connect to server:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // mcp stop <server-name>
  mcp
    .command("stop <server-name>")
    .description("Stop an MCP server (placeholder - stops the agent)")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (serverName: string, options: { port: string; host: string }) => {
      try {
        // Stop the agent which corresponds to the MCP server
        const response = await fetch(
          `http://${options.host}:${options.port}/api/agents/${serverName}/stop`,
          { method: "POST" }
        );

        if (!response.ok) {
          if (response.status === 404) {
            console.error(`MCP server not found: ${serverName}`);
          } else {
            console.error(`Failed to stop MCP server: ${response.statusText}`);
          }
          process.exit(1);
        }

        console.log(`MCP server ${serverName} stopped.`);
      } catch (error) {
        console.error("Failed to connect to server:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
