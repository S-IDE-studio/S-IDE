import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const serverDir = path.join(rootDir, "apps", "server");
const serverDistDir = path.join(serverDir, "dist");
const resourcesDir = path.join(rootDir, "apps", "desktop", "src-tauri", "resources");
const bundleDir = path.join(resourcesDir, "server");
const sharedDir = path.join(rootDir, "packages", "shared");

// Parse command line arguments
const args = process.argv.slice(2);
const outputArg = args.find((arg) => arg.startsWith("--output="));
const outputZip = outputArg ? outputArg.split("=")[1] : null;

console.log("[Bundle] Starting server file bundling...");

// Clean and create bundle directory
if (fs.existsSync(bundleDir)) {
  fs.rmSync(bundleDir, { recursive: true, force: true });
}
fs.mkdirSync(bundleDir, { recursive: true });

// Copy server dist files
console.log(`[Bundle] Copying server files from ${serverDistDir} to ${bundleDir}`);
copyDirectory(serverDistDir, bundleDir);

// Create package.json FIRST (before copying shared package)
console.log("[Bundle] Creating production package.json...");
const serverPackageJson = JSON.parse(fs.readFileSync(path.join(serverDir, "package.json"), "utf8"));
const prodPackageJson = {
  name: serverPackageJson.name,
  version: serverPackageJson.version,
  type: "module",
  dependencies: serverPackageJson.dependencies,
};
fs.writeFileSync(path.join(bundleDir, "package.json"), JSON.stringify(prodPackageJson, null, 2));

// Use npm to install production dependencies FIRST
console.log("[Bundle] Installing production dependencies...");
try {
  execSync("npm install --production --no-package-lock --omit=dev", {
    cwd: bundleDir,
    stdio: "inherit",
    shell: true,
  });
  console.log("[Bundle] Production dependencies installed!");
} catch (error) {
  throw new Error(`npm install failed: ${error.message}`);
}

// NOW copy shared package AFTER npm install (to override any symlink)
console.log(
  `[Bundle] Copying shared package from ${sharedDir} to ${bundleDir}/node_modules/@side-ide/shared`
);
const sharedDestDir = path.join(bundleDir, "node_modules", "@side-ide");

// Ensure @side-ide directory exists
if (!fs.existsSync(sharedDestDir)) {
  console.log("[Bundle] Creating @side-ide directory...");
  fs.mkdirSync(sharedDestDir, { recursive: true });
}

// Remove symlink or directory if it exists
const sharedDest = path.join(sharedDestDir, "shared");
console.log(`[Bundle] Checking if ${sharedDest} exists...`);

// Use lstatSync to detect symlinks/junctions
try {
  const stats = fs.lstatSync(sharedDest);
  console.log(
    `[Bundle] Found existing shared: isSymLink=${stats.isSymbolicLink()}, isDir=${stats.isDirectory()}`
  );
  console.log("[Bundle] Removing existing shared (symlink or directory)...");

  // On Windows, use unlinkSync for junctions/symlinks
  if (stats.isSymbolicLink()) {
    fs.unlinkSync(sharedDest);
  } else {
    fs.rmSync(sharedDest, { recursive: true, force: true });
  }
  console.log("[Bundle] Removed!");
} catch (err) {
  if (err.code !== "ENOENT") {
    console.log(`[Bundle] Error checking/removing shared: ${err.message}`);
  } else {
    console.log("[Bundle] shared does not exist, will create new");
  }
}

console.log(
  `[Bundle] Checking if @side-ide still exists after removal: ${fs.existsSync(sharedDestDir)}`
);

console.log("[Bundle] Copying shared package files...");
copyDirectory(sharedDir, sharedDest);

console.log("[Bundle] Server files bundled successfully!");

// Create zip file if --output is specified
if (outputZip) {
  console.log(`[Bundle] Creating zip file: ${outputZip}`);
  await createZip(bundleDir, path.join(rootDir, outputZip));
  console.log(`[Bundle] Zip file created: ${outputZip}`);
}

console.log("[Bundle] Complete!");

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }

  // Ensure destination parent directory exists first
  const destParent = path.dirname(dest);
  if (!fs.existsSync(destParent)) {
    console.log(`[Bundle] Creating parent directory: ${destParent}`);
    fs.mkdirSync(destParent, { recursive: true });
  }

  // Ensure destination directory exists
  if (!fs.existsSync(dest)) {
    console.log(`[Bundle] Creating directory: ${dest}`);
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules when copying dist
      if (entry.name !== "node_modules") {
        copyDirectory(srcPath, destPath);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Creates a zip file from the source directory
 * @param {string} sourceDir - Directory to zip
 * @param {string} outputPath - Output zip file path
 */
async function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    output.on("close", () => {
      console.log(`[Bundle] Zip created: ${archive.pointer()} total bytes`);
      resolve();
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add the entire directory contents under "server/" prefix
    archive.directory(sourceDir, "server");

    archive.finalize();
  });
}
