import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const bundleDir = path.join(rootDir, "apps", "desktop", "src-tauri", "resources", "server");
const zipPath = path.join(rootDir, "apps", "desktop", "src-tauri", "resources", "server-bundle.zip");

console.log("[Zip] Creating server-bundle.zip...");

// Remove existing zip if present
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Create a write stream for the zip file
const output = fs.createWriteStream(zipPath);
const archive = archiver("zip", {
  zlib: { level: 9 } // Maximum compression
});

// Pipe archive data to the file
archive.pipe(output);

// Add the entire server directory contents
archive.directory(bundleDir, "server");

// Finalize the archive
await archive.finalize();

// Wait for the stream to finish
await new Promise((resolve, reject) => {
  output.on("close", resolve);
  output.on("error", reject);
  archive.on("error", reject);
});

console.log(`[Zip] Created ${zipPath} (${archive.pointer()} bytes)`);
