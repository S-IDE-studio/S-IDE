/**
 * Shell Detection and Management
 *
 * Discovers and manages available shells on the system
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export interface ShellInfo {
  id: string;
  name: string;
  path: string;
  args: string[];
  icon?: string;
  category: "default" | "wsl" | "git" | "other";
}

// Common shell paths by platform
const WINDOWS_SHELL_PATHS = {
  powershell: [
    "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    "C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe",
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ],
  cmd: ["C:\\Windows\\System32\\cmd.exe"],
  gitBash: [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    join(homedir(), "scoop", "apps", "git", "current", "bin", "bash.exe"),
  ],
  wsl: ["C:\\Windows\\System32\\wsl.exe"],
};

const UNIX_SHELL_PATHS = {
  bash: ["/bin/bash", "/usr/local/bin/bash", "/usr/bin/bash"],
  zsh: ["/bin/zsh", "/usr/local/bin/zsh", "/usr/bin/zsh"],
  fish: ["/usr/local/bin/fish", "/usr/bin/fish"],
  nu: ["/usr/local/bin/nu", "/usr/bin/nu"],
};

// Cache for discovered shells
let shellCache: ShellInfo[] | null = null;
let defaultShellCache: string | null = null;

/**
 * Check if a file exists and is executable
 */
function shellExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

/**
 * Find first existing shell from a list of paths
 */
function findShell(paths: string[]): string | null {
  for (const path of paths) {
    if (shellExists(path)) {
      return path;
    }
  }
  return null;
}

/**
 * Discover WSL distributions
 */
async function discoverWSL(): Promise<ShellInfo[]> {
  if (platform() !== "win32") {
    return [];
  }

  const wslPath = findShell(WINDOWS_SHELL_PATHS.wsl);
  if (!wslPath) {
    return [];
  }

  const { execSync } = await import("node:child_process");
  const shells: ShellInfo[] = [];

  try {
    // Get list of WSL distributions
    console.log("[shells] Checking for WSL distributions...");
    const output = execSync("wsl.exe -l -q", {
      encoding: "utf8",
      windowsHide: true, // Hide console window on Windows
    });
    console.log("[shells] WSL check complete");
    const distros = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const distro of distros) {
      // Skip "docker-desktop" and similar non-interactive distros
      if (distro.toLowerCase().includes("docker")) {
        continue;
      }

      shells.push({
        id: `wsl-${distro.toLowerCase().replace(/\s+/g, "-")}`,
        name: `WSL: ${distro}`,
        path: wslPath,
        args: ["-d", distro, "--", "bash", "-l"],
        icon: "terminal",
        category: "wsl",
      });
    }
  } catch {
    // WSL not available or error reading distributions
  }

  return shells;
}

/**
 * Discover Git Bash on Windows
 */
function discoverGitBash(): ShellInfo[] {
  if (platform() !== "win32") {
    return [];
  }

  const gitBashPath = findShell(WINDOWS_SHELL_PATHS.gitBash);
  if (!gitBashPath) {
    return [];
  }

  return [
    {
      id: "git-bash",
      name: "Git Bash",
      path: gitBashPath,
      args: ["--login", "-i"],
      icon: "terminal-square",
      category: "git",
    },
  ];
}

/**
 * Discover additional shells in common directories
 */
async function discoverAdditionalShells(): Promise<ShellInfo[]> {
  const shells: ShellInfo[] = [];

  if (platform() === "win32") {
    // Check scoop-installed shells
    const scoopShellsDir = join(homedir(), "scoop", "shims");
    if (existsSync(scoopShellsDir)) {
      try {
        const files = await readdir(scoopShellsDir);
        const shellExes = files.filter(
          (f) =>
            f.endsWith(".exe") &&
            !f.endsWith(".shim") &&
            ["nu", "elvish", "oil", "yash"].some((name) => f.toLowerCase().includes(name))
        );

        for (const exe of shellExes) {
          const name = exe.replace(".exe", "");
          shells.push({
            id: `scoop-${name.toLowerCase()}`,
            name: `Scoop: ${name}`,
            path: join(scoopShellsDir, exe),
            args: [],
            icon: "terminal",
            category: "other",
          });
        }
      } catch {
        // Directory not readable
      }
    }

    // Check for common Cygwin/MSYS2 installations
    const msysPaths = [
      "C:\\msys64\\usr\\bin\\bash.exe",
      "C:\\cygwin64\\bin\\bash.exe",
      "C:\\mingw64\\msys\\1.0\\bin\\bash.exe",
    ];

    for (const msysPath of msysPaths) {
      if (shellExists(msysPath)) {
        const name = msysPath.includes("msys64")
          ? "MSYS2"
          : msysPath.includes("cygwin")
            ? "Cygwin"
            : "MinGW";
        shells.push({
          id: name.toLowerCase(),
          name,
          path: msysPath,
          args: ["--login", "-i"],
          icon: "terminal",
          category: "other",
        });
      }
    }
  } else {
    // Unix: Check for additional shells in /usr/local/bin, /usr/bin, etc.
    const binDirs = ["/usr/local/bin", "/usr/bin", "/opt/homebrew/bin"];
    const shellNames = ["nu", "elvish", "oil", "fish"];

    for (const dir of binDirs) {
      for (const name of shellNames) {
        const path = join(dir, name);
        if (shellExists(path) && !shells.some((s) => s.path === path)) {
          shells.push({
            id: `unix-${name}`,
            name: name.charAt(0).toUpperCase() + name.slice(1),
            path,
            args: ["-l"],
            icon: "terminal",
            category: "other",
          });
        }
      }
    }
  }

  return shells;
}

/**
 * Get system default shell path (fallback)
 */
function getSystemDefaultShellPath(): string {
  if (platform() === "win32") {
    const psPath = findShell(WINDOWS_SHELL_PATHS.powershell);
    if (psPath) return psPath;
    const cmdPath = findShell(WINDOWS_SHELL_PATHS.cmd);
    if (cmdPath) return cmdPath;
    return "cmd.exe";
  }

  // Unix-like
  for (const shell of [...UNIX_SHELL_PATHS.bash, ...UNIX_SHELL_PATHS.zsh]) {
    if (shellExists(shell)) {
      return shell;
    }
  }
  return "/bin/sh";
}

/**
 * Scan system for available shells
 */
export async function scanShells(): Promise<ShellInfo[]> {
  const shells: ShellInfo[] = [];
  const isWindows = platform() === "win32";

  // Default shells (highest priority)
  if (isWindows) {
    // PowerShell
    const psPath = findShell(WINDOWS_SHELL_PATHS.powershell);
    if (psPath) {
      const isPwsh = psPath.toLowerCase().includes("pwsh.exe");
      shells.push({
        id: isPwsh ? "pwsh" : "powershell",
        name: isPwsh ? "PowerShell 7" : "Windows PowerShell",
        path: psPath,
        args: [],
        icon: "terminal",
        category: "default",
      });
    }

    // Command Prompt
    const cmdPath = findShell(WINDOWS_SHELL_PATHS.cmd);
    if (cmdPath) {
      shells.push({
        id: "cmd",
        name: "Command Prompt",
        path: cmdPath,
        args: [],
        icon: "terminal",
        category: "default",
      });
    }
  } else {
    // Unix shells
    for (const [name, paths] of Object.entries(UNIX_SHELL_PATHS)) {
      const path = findShell(paths);
      if (path && !shells.some((s) => s.path === path)) {
        shells.push({
          id: name,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          path,
          args: ["-l"],
          icon: "terminal",
          category: "default",
        });
      }
    }
  }

  // Git Bash
  shells.push(...discoverGitBash());

  // WSL distributions (async)
  const wslShells = await discoverWSL();
  shells.push(...wslShells);

  // Additional shells
  const additionalShells = await discoverAdditionalShells();
  shells.push(...additionalShells);

  shellCache = shells;
  return shells;
}

/**
 * Get cached shells or scan if not cached
 */
export async function getShells(): Promise<ShellInfo[]> {
  if (shellCache) {
    return shellCache;
  }
  return scanShells();
}

/**
 * Get shell by ID
 */
export async function getShellById(id: string): Promise<ShellInfo | undefined> {
  const shells = await getShells();
  return shells.find((s) => s.id === id);
}

/**
 * Get default shell ID (system default, not user preference)
 */
export function getDefaultShellId(): string {
  if (defaultShellCache) {
    return defaultShellCache;
  }

  const isWindows = platform() === "win32";

  // Check for PowerShell 7 first, then Windows PowerShell, then cmd
  if (isWindows) {
    const psPath = findShell(WINDOWS_SHELL_PATHS.powershell);
    if (psPath?.toLowerCase().includes("pwsh.exe")) {
      defaultShellCache = "pwsh";
    } else if (psPath) {
      defaultShellCache = "powershell";
    } else {
      defaultShellCache = "cmd";
    }
  } else {
    // Unix: prefer zsh if available (macOS default), otherwise bash
    if (shellExists("/bin/zsh") || shellExists("/usr/local/bin/zsh")) {
      defaultShellCache = "zsh";
    } else {
      defaultShellCache = "bash";
    }
  }

  return defaultShellCache;
}

/**
 * Set default shell ID
 */
export function setDefaultShellId(id: string): void {
  defaultShellCache = id;
}

/**
 * Clear shell cache (for testing or refresh)
 */
export function clearShellCache(): void {
  shellCache = null;
}

/**
 * Get default shell path (considering user preference if available)
 * This is a synchronous fallback that returns the system default
 * For user-aware shell selection, use getShellById with user's defaultShellId
 */
export function getDefaultShellPath(): string {
  return getSystemDefaultShellPath();
}
