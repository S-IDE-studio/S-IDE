/**
 * User Settings Management
 *
 * Handles user-specific settings stored in ~/.side-ide/config.json
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const USER_CONFIG_DIR = join(homedir(), ".side-ide");
const USER_CONFIG_FILE = join(USER_CONFIG_DIR, "config.json");

// User settings interface
export interface UserSettings {
  defaultShell?: string;
  // Add other user settings here in the future
  theme?: string;
  editor?: {
    fontSize?: number;
    tabSize?: number;
  };
}

// In-memory cache for settings
let settingsCache: UserSettings | null = null;

/**
 * Ensure config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  if (!existsSync(USER_CONFIG_DIR)) {
    await mkdir(USER_CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load user settings from file
 */
export async function loadUserSettings(): Promise<UserSettings> {
  if (settingsCache) {
    return settingsCache;
  }

  try {
    await ensureConfigDir();

    if (existsSync(USER_CONFIG_FILE)) {
      const data = await readFile(USER_CONFIG_FILE, "utf-8");
      settingsCache = JSON.parse(data) as UserSettings;
      console.log("[USER_SETTINGS] Loaded user settings from", USER_CONFIG_FILE);
    } else {
      // Create default settings file
      settingsCache = {};
      await saveUserSettings(settingsCache);
      console.log("[USER_SETTINGS] Created new user settings file");
    }
  } catch (error) {
    console.error("[USER_SETTINGS] Failed to load settings:", error);
    settingsCache = {};
  }

  return settingsCache;
}

/**
 * Save user settings to file
 */
export async function saveUserSettings(settings: UserSettings): Promise<void> {
  try {
    await ensureConfigDir();

    const data = JSON.stringify(settings, null, 2);
    await writeFile(USER_CONFIG_FILE, data, "utf-8");

    settingsCache = settings;
    console.log("[USER_SETTINGS] Saved user settings to", USER_CONFIG_FILE);
  } catch (error) {
    console.error("[USER_SETTINGS] Failed to save settings:", error);
    throw error;
  }
}

/**
 * Get a specific setting value
 */
export async function getUserSetting<K extends keyof UserSettings>(
  key: K
): Promise<UserSettings[K] | undefined> {
  const settings = await loadUserSettings();
  return settings[key];
}

/**
 * Set a specific setting value
 */
export async function setUserSetting<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K]
): Promise<void> {
  const settings = await loadUserSettings();
  settings[key] = value;
  await saveUserSettings(settings);
}

/**
 * Clear settings cache (for testing)
 */
export function clearUserSettingsCache(): void {
  settingsCache = null;
}

/**
 * Get default shell ID from user settings
 */
export async function getDefaultShellId(): Promise<string | undefined> {
  return getUserSetting("defaultShell");
}

/**
 * Set default shell ID in user settings
 */
export async function setDefaultShellId(shellId: string): Promise<void> {
  await setUserSetting("defaultShell", shellId);
}
