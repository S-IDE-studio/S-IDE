const ALLOWED_ENV_PREFIXES = ["CUSTOM_", "PROJECT_", "USER_", "npm_config_", "NODE_"];

const BUILTIN_ENV_VARS = [
  "PATH",
  "Path",
  "TERM",
  "HOME",
  "USER",
  "USERPROFILE",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "COLORTERM",
  "TERM_PROGRAM",
  "TERM_PROGRAM_VERSION",
  "MSYS2_PATH",
  "NODE_ENV",
  "DEBUG",
];

/**
 * Sanitizes environment variables to prevent command injection.
 * Removes null bytes/control characters and only allows safe prefixes/builtin vars.
 */
export function sanitizeEnvVars(env: Record<string, string> = {}): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    // Remove null bytes and control characters from key and value
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Sanitizing control characters
    const cleanKey = key.replace(/[\x00-\x1F]/g, "");
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Sanitizing control characters
    const cleanValue = String(value).replace(/[\x00-\x1F]/g, "");

    const isAllowedPrefix = ALLOWED_ENV_PREFIXES.some((prefix) => cleanKey.startsWith(prefix));
    const isBuiltinEnv = BUILTIN_ENV_VARS.includes(cleanKey);

    if (isAllowedPrefix || isBuiltinEnv) {
      result[cleanKey] = cleanValue;
    }
  }

  return result;
}
