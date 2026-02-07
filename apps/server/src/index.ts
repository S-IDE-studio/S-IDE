import { createServer } from "./server.js";

// Parse command line arguments for port
const args = process.argv.slice(2);
const portArg = args.find((arg) => arg.startsWith("--port"));
const port = portArg ? parseInt(portArg.split("=")[1], 10) : undefined;

async function main() {
  await createServer(port);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
