// Re-export shared types
export type { Deck, Workspace } from "@side-ide/shared/types";
export type { AgentId } from "./agents/types.js";

import type { DatabaseSync } from "node:sqlite";
// Import WebSocket type explicitly from 'ws' package to avoid conflicts
import type { WebSocket as WebSocketType } from "ws";

// Hono Context Variables
declare module "hono" {
  interface ContextVariableMap {
    db: DatabaseSync;
    requestId: string;
  }
}

export type TerminalSession = {
  id: string;
  deckId: string;
  title: string;
  command: string | null;
  createdAt: string;
  term: import("node-pty").IPty;
  sockets: Set<WebSocketType>;
  buffer: string;
  lastActive: number;
  dispose: import("node-pty").IDisposable | null;
  screenBuffer?: import("./terminal/ScreenBuffer.js").ScreenBuffer;
};

export type HttpError = Error & { status?: number };
