/**
 * Usage/Cost Management Commands
 *
 * Summary, agent usage, export
 */

import { writeFileSync } from "node:fs";
import type { Command } from "commander";

interface AgentUsage {
  agentId: string;
  agentName: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  requestCount: number;
}

interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  totalRequests: number;
  agents: AgentUsage[];
}

export function registerUsageCommands(program: Command): void {
  const usage = program.command("usage").description("Manage usage and costs");

  // usage summary
  usage
    .command("summary")
    .description("Show usage summary")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (options: { port: string; host: string }) => {
      try {
        // Try to fetch usage data from agent metrics endpoint
        const response = await fetch(`http://${options.host}:${options.port}/api/agents/status`);
        if (!response.ok) {
          console.error(`Failed to fetch usage data: ${response.statusText}`);
          process.exit(1);
        }

        const data = (await response.json()) as {
          agents: Array<{
            id: string;
            name: string;
            tokenUsage: number;
            contextUsage: number;
          }>;
        };

        console.log("Usage Summary:");
        console.log("--------------");

        if (!data.agents || data.agents.length === 0) {
          console.log("No agent usage data available.");
          return;
        }

        let totalTokens = 0;
        for (const agent of data.agents) {
          totalTokens += agent.tokenUsage;
          console.log(`  ${agent.name} (${agent.id}):`);
          console.log(`    Tokens: ${agent.tokenUsage.toLocaleString()}`);
          console.log(`    Context: ${agent.contextUsage.toLocaleString()} bytes`);
          console.log("");
        }

        console.log(`Total: ${totalTokens.toLocaleString()} tokens`);
        console.log("");
        console.log("Note: Detailed cost tracking will be implemented with Issue #7.");
      } catch (error) {
        console.error("Failed to connect to server:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // usage agent <agent-id>
  usage
    .command("agent <agent-id>")
    .description("Show usage for a specific agent")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (agentId: string, options: { port: string; host: string }) => {
      try {
        const response = await fetch(
          `http://${options.host}:${options.port}/api/agents/${agentId}`
        );
        if (!response.ok) {
          if (response.status === 404) {
            console.error(`Agent not found: ${agentId}`);
          } else {
            console.error(`Failed to fetch agent: ${response.statusText}`);
          }
          process.exit(1);
        }

        const agent = (await response.json()) as {
          id: string;
          name: string;
          enabled: boolean;
        };

        console.log(`Agent: ${agent.name} (${agent.id})`);
        console.log(`Status: ${agent.enabled ? "enabled" : "disabled"}`);
        console.log("");
        console.log("Note: Detailed per-agent usage tracking will be implemented with Issue #7.");
      } catch (error) {
        console.error("Failed to connect to server:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // usage export
  usage
    .command("export")
    .description("Export usage data to JSON")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .option("-o, --output <file>", "Output file", "usage-export.json")
    .action(async (options: { port: string; host: string; output: string }) => {
      try {
        const response = await fetch(`http://${options.host}:${options.port}/api/agents/status`);
        if (!response.ok) {
          console.error(`Failed to fetch usage data: ${response.statusText}`);
          process.exit(1);
        }

        const data = await response.json();
        const exportData = {
          exportedAt: new Date().toISOString(),
          server: `${options.host}:${options.port}`,
          data,
        };

        writeFileSync(options.output, JSON.stringify(exportData, null, 2));
        console.log(`Usage data exported to: ${options.output}`);
      } catch (error) {
        console.error("Failed to export usage data:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
