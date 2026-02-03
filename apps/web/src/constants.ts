/**
 * Application-wide constants
 */

// API configuration
export const API_BASE = import.meta.env.VITE_API_BASE || "";
export const DEFAULT_ROOT_FALLBACK = import.meta.env.VITE_DEFAULT_ROOT || "";

// UI messages
export const MESSAGE_SAVED = "保存しました。";
export const MESSAGE_WORKSPACE_FETCH_ERROR = "ワークスペースを取得できませんでした";
export const MESSAGE_DECK_FETCH_ERROR = "デッキを取得できませんでした";
export const MESSAGE_TERMINAL_FETCH_ERROR = "ターミナルを取得できませんでした";
export const MESSAGE_WORKSPACE_ADD_ERROR = "ワークスペースを追加できませんでした";
export const MESSAGE_DECK_CREATE_ERROR = "デッキの作成に失敗しました";
export const MESSAGE_TERMINAL_START_ERROR = "ターミナルを起動できませんでした";
export const MESSAGE_FILE_OPEN_ERROR = "ファイルを開けませんでした";
export const MESSAGE_SAVE_ERROR = "保存に失敗しました";
export const MESSAGE_PATH_REQUIRED = "パスを入力してください。";
export const MESSAGE_DUPLICATE_WORKSPACE = "同じパスのワークスペースは追加できません。";
export const MESSAGE_WORKSPACE_REQUIRED = "デッキを作成する前にワークスペースを追加してください。";
export const MESSAGE_SELECT_WORKSPACE = "ワークスペースを選択してください。";
export const MESSAGE_SELECT_DECK = "デッキを選択してください。";

// Timing constants
export const SAVED_MESSAGE_TIMEOUT = 2000;
export const STATUS_CHECK_INTERVAL = 5000;
export const DEFAULT_REQUEST_TIMEOUT = 10000;
export const SERVER_STARTUP_DELAY = 2000;
export const COPY_FEEDBACK_TIMEOUT = 2000;
export const RECONNECT_BASE_DELAY_MS = 1000;

// Port configuration
export const DEFAULT_SERVER_PORT = 8787;
export const COMMON_PORTS_TO_CHECK = [3000, 5173, 5174, 5175, 5176, 8787] as const;

// Terminal configuration
export const TERMINAL_SCROLLBACK = 10000;
export const TERMINAL_X10_MOUSE_MODE = 1000;
export const TERMINAL_WEBSOCKET_NORMAL_CLOSE = 1000;

// WebSocket configuration
export const DEFAULT_WS_LIMIT = 1000;
export const MAX_WS_LIMIT = 10000;
export const MIN_WS_LIMIT = 1;

// UI z-index
export const MODAL_Z_INDEX = 1000;

// Language mapping
export const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  md: "markdown",
  css: "css",
  html: "html",
  yml: "yaml",
  yaml: "yaml",
  sh: "shell",
  ps1: "powershell",
  py: "python",
  go: "go",
  rs: "rust",
};

// Editor configuration
export const EDITOR_FONT_FAMILY = '"JetBrains Mono", monospace';
export const EDITOR_FONT_SIZE = 14;

// Terminal configuration
export const TERMINAL_FONT_FAMILY =
  '"Cascadia Code", "JetBrains Mono", "Consolas", "Menlo", monospace';
export const TERMINAL_FONT_SIZE = 13;
export const TERMINAL_BACKGROUND_COLOR = "#000000";
export const TERMINAL_FOREGROUND_COLOR = "#ffffff";

// Local storage keys
export const STORAGE_KEY_THEME = "deck-theme";
