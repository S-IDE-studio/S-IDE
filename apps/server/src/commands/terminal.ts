/**
 * Terminal Management Commands
 *
 * List, create, kill terminal sessions
 */

import type { Command } from "commander";

interface TerminalSession {
  id: string;
  deckId?: string;
  workspaceId?: string;
  shell: string;
  title?: string;
  createdAt: string;
}

export function registerTerminalCommands(program: Command): void {
  const terminal = program.command("terminal").description("Manage terminal sessions");

  // terminal list
  terminal
    .command("list")
    .description("List active terminal sessions")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .action(async (options: { port: string; host: string }) => {
      try {
        const response = await fetch(`http://${options.host}:${options.port}/api/terminals`);
        if (!response.ok) {
          console.error(`Failed to fetch terminals: ${response.statusText}`);
          process.exit(1);
        }

        const terminals = (await response.json()) as TerminalSession[];
        if (terminals.length === 0) {
          console.log("No active terminal sessions.");
          return;
        }

        console.log("Active Terminal Sessions:");
        console.log("-------------------------");
        for (const term of terminals) {
          console.log(`  ID: ${term.id}`);
          console.log(`    Shell: ${term.shell}`);
          if (term.title) console.log(`    Title: ${term.title}`);
          if (term.deckId) console.log(`    Deck: ${term.deckId}`);
          if (term.workspaceId) console.log(`    Workspace: ${term.workspaceId}`);
          console.log(`    Created: ${new Date(term.createdAt).toLocaleString()}`);
          console.log("");
        }
      } catch (error) {
        console.error("Failed to connect to server:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // terminal create
  terminal
    .command("create")
    .description("Create a new terminal session")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .option("-s, --shell <shell>", "Shell to use (e.g., bash, zsh, powershell)")
    .option("-c, --cwd <cwd>", "Working directory")
    .option("-t, --title <title>", "Terminal title")
    .action(
      async (options: {
        port: string;
        host: string;
        shell?: string;
        cwd?: string;
        title?: string;
      }) => {
        try {
          const body: Record<string, unknown> = {};
          if (options.shell) body.shellId = options.shell;
          if (options.cwd) body.cwd = options.cwd;
          if (options.title) body.title = options.title;

          const response = await fetch(`http://${options.host}:${options.port}/api/terminals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            console.error(`Failed to create terminal: ${response.statusText}`);
            process.exit(1);
          }

          const terminal = (await response.json()) as TerminalSession;
          console.log(`Terminal created: ${terminal.id}`);
          console.log(`  Shell: ${terminal.shell}`);
          if (terminal.title) console.log(`  Title: ${terminal.title}`);
        } catch (error) {
          console.error("Failed to connect to server:", error instanceof Error ? error.message : error);
          process.exit(1);
        }
      }
    );

  // terminal kill <session-id>
  terminal
    .command("kill <session-id>")
    .description("Kill a terminal session")
    .option("-p, --port <port>", "Server port", "8787")
    .option("-h, --host <host>", "Server host", "localhost")
    .option("-f, --force", "Force kill (SIGKILL)", false)
    .action(
      async (
        sessionId: string,
        options: { port: string; host: string; force: boolean }
      ) => {
        try {
          const response = await fetch(
            `http://${options.host}:${options.port}/api/terminals/${sessionId}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ force: options.force }),
            }
          );

          if (!response.ok) {
            if (response.status === 404) {
              console.error(`Terminal session not found: ${sessionId}`);
            } else {
              console.error(`Failed to kill terminal: ${response.statusText}`);
            }
            process.exit(1);
          }

          console.log(`Terminal ${sessionId} killed.`);
        } catch (error) {
          console.error("Failed to connect to server:", error instanceof Error ? error.message : error);
          process.exit(1);
        }
      }
    );
}
