/**
 * Terminal Types
 *
 * Type definitions for terminal spawn options
 */

export interface TerminalSpawnOptions {
  cwd: string;
  cols: number;
  rows: number;
  env: Record<string, string>;
  encoding?: string;
  useConpty?: boolean;
  name?: string;
}
