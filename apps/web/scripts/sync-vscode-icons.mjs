import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

async function main() {
  const pkgPath = require.resolve("vscode-icons-ts/package.json");
  const packageRoot = path.dirname(pkgPath);
  const sourceDir = path.join(packageRoot, "build", "icons");
  const targetDir = path.resolve(process.cwd(), "public", "vscode-icons");

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
  await fs.cp(sourceDir, targetDir, { recursive: true });

  console.log(`[sync-vscode-icons] copied icons to ${targetDir}`);
}

main().catch((error) => {
  console.error("[sync-vscode-icons] failed:", error);
  process.exit(1);
});
