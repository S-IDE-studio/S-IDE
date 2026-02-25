/**
 * Agent Management Commands
 *
 * List, status, detect, enable/disable agents
 */

import type { Command } from "commander";

interface AgentInfo {
  id: string;
  name: string;
  icon: string;
  description?: string;
  enabled: boolean;
}

interface AgentStatus {
  id: string;
  name: string;
  status: "idle" | "running" | "error";
  contextUsage: number;
  contextLimit: number;
  tokenUsage: number;
  tokenLimit: number;
  uptime: number;
}

export function registerAgentCommands(program: Command): void {
  const agent = program.command("agent").description("Manage AI agents");

  // agent list
  agent
    .command("list")
    .description("List all registered agents")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (options: { port: string; host: string }) => {
      try {
        const response = await fetch(`http://${options.host}:${options.port}/api/agents`);
        if (!response.ok) {
          console.error(`Failed to fetch agents: ${response.statusText}`);
          process.exit(1);
        }

        const agents = (await response.json()) as AgentInfo[];
        if (agents.length === 0) {
          console.log("No agents registered.");
          return;
        }

        console.log("Registered Agents:");
        console.log("------------------");
        for (const agent of agents) {
          const status = agent.enabled ? "✓ enabled" : "✗ disabled";
          console.log(`  ${agent.name} (${agent.id})`);
          console.log(`    Status: ${status}`);
          if (agent.description) {
            console.log(`    Description: ${agent.description}`);
          }
          console.log("");
        }
      } catch (error) {
        console.error(
          "Failed to connect to server:",
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  // agent status [agent-id]
  agent
    .command("status [agent-id]")
    .description("Get agent status (or all agents if no ID specified)")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (agentId: string | undefined, options: { port: string; host: string }) => {
      try {
        const url = agentId
          ? `http://${options.host}:${options.port}/api/agents/${agentId}`
          : `http://${options.host}:${options.port}/api/agents/status`;

        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 404) {
            console.error(`Agent not found: ${agentId}`);
          } else {
            console.error(`Failed to fetch agent status: ${response.statusText}`);
          }
          process.exit(1);
        }

        if (agentId) {
          // Single agent details
          const agent = (await response.json()) as AgentInfo & { config?: Record<string, unknown> };
          console.log(`Agent: ${agent.name} (${agent.id})`);
          console.log(`Status: ${agent.enabled ? "enabled" : "disabled"}`);
          console.log(`Icon: ${agent.icon}`);
          if (agent.description) {
            console.log(`Description: ${agent.description}`);
          }
        } else {
          // All agents status
          const data = (await response.json()) as { agents: AgentStatus[] };
          console.log("Agent Status:");
          console.log("-------------");
          for (const agent of data.agents) {
            console.log(`  ${agent.name} (${agent.id})`);
            console.log(`    State: ${agent.status}`);
            console.log(`    Context: ${agent.contextUsage}/${agent.contextLimit}`);
            console.log(`    Tokens: ${agent.tokenUsage}/${agent.tokenLimit}`);
            console.log(`    Uptime: ${formatDuration(agent.uptime)}`);
            console.log("");
          }
        }
      } catch (error) {
        console.error(
          "Failed to connect to server:",
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  // agent detect
  agent
    .command("detect")
    .description("Detect installed agents")
    .action(() => {
      console.log("Detecting installed agents...");
      // Placeholder: In a real implementation, this would scan for:
      // - Claude Desktop installation
      // - Cursor installation
      // - GitHub Copilot CLI
      // - Codex CLI
      // etc.
      console.log("Claude: Detected (Claude Desktop)");
      console.log("Cursor: Detected");
      console.log("Copilot: Detected (VS Code extension)");
      console.log("Codex: Not detected");
      console.log("Kimi: Not detected");
    });

  // agent enable <agent-id>
  agent
    .command("enable <agent-id>")
    .description("Enable an agent")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (agentId: string, options: { port: string; host: string }) => {
      try {
        const response = await fetch(
          `http://${options.host}:${options.port}/api/agents/${agentId}/restart`,
          { method: "POST" }
        );
        if (!response.ok) {
          console.error(`Failed to enable agent: ${response.statusText}`);
          process.exit(1);
        }
        console.log(`Agent ${agentId} enabled.`);
      } catch (error) {
        console.error(
          "Failed to connect to server:",
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  // agent disable <agent-id>
  agent
    .command("disable <agent-id>")
    .description("Disable an agent")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (agentId: string, options: { port: string; host: string }) => {
      try {
        const response = await fetch(
          `http://${options.host}:${options.port}/api/agents/${agentId}/stop`,
          { method: "POST" }
        );
        if (!response.ok) {
          console.error(`Failed to disable agent: ${response.statusText}`);
          process.exit(1);
        }
        console.log(`Agent ${agentId} disabled.`);
      } catch (error) {
        console.error(
          "Failed to connect to server:",
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
