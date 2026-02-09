import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const resourcesDir = path.join(rootDir, "apps", "desktop", "src-tauri", "resources");
const serverDir = path.join(resourcesDir, "server");
const bundleOutput = path.join(rootDir, "server-bundle.zip");

console.log("[Bundle] Creating server bundle for GitHub Releases...");

// Check if server directory exists
if (!fs.existsSync(serverDir)) {
  console.error("[Bundle] Server directory not found. Run 'pnpm run bundle:server' first.");
  process.exit(1);
}

// Create a zip archive
const output = fs.createWriteStream(bundleOutput);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`[Bundle] Server bundle created: ${bundleOutput} (${archive.pointer()} bytes)`);
});

archive.on("error", (err) => {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add the entire server directory to the archive (as "server/")
archive.directory(serverDir, "server");

// Finalize the archive
archive.finalize();
