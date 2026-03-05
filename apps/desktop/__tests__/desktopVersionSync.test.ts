import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();

const readJsonVersion = (filePath: string): string => {
  const absolutePath = path.resolve(workspaceRoot, filePath);
  const content = readFileSync(absolutePath, "utf-8");
  const parsed = JSON.parse(content) as { version?: unknown };
  if (typeof parsed.version !== "string") {
    throw new Error(`version is missing in ${filePath}`);
  }
  return parsed.version;
};

const readCargoVersion = (filePath: string): string => {
  const absolutePath = path.resolve(workspaceRoot, filePath);
  const content = readFileSync(absolutePath, "utf-8");
  const match = content.match(/^version\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"/m);
  if (!match) {
    throw new Error(`version is missing in ${filePath}`);
  }
  return match[1];
};

const readReleaseTagVersionAtHead = (): string | null => {
  try {
    const output = execSync("git tag --points-at HEAD", {
      cwd: workspaceRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const semverTags = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^v\d+\.\d+\.\d+$/.test(line))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    return semverTags.length > 0 ? semverTags[semverTags.length - 1].slice(1) : null;
  } catch {
    return null;
  }
};

describe("desktop version sync", () => {
  it("should keep desktop manifest versions aligned", () => {
    const packageJsonVersion = readJsonVersion("apps/desktop/package.json");
    const tauriConfigVersion = readJsonVersion("apps/desktop/src-tauri/tauri.conf.json");
    const cargoTomlVersion = readCargoVersion("apps/desktop/src-tauri/Cargo.toml");

    expect(tauriConfigVersion).toBe(packageJsonVersion);
    expect(cargoTomlVersion).toBe(packageJsonVersion);
  });

  it("should match release tag version when HEAD is tagged", () => {
    const headTagVersion = readReleaseTagVersionAtHead();
    if (!headTagVersion) {
      return;
    }

    const packageJsonVersion = readJsonVersion("apps/desktop/package.json");
    expect(packageJsonVersion).toBe(headTagVersion);
  });
});
