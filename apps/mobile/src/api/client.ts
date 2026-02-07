// API client for S-IDE mobile app
// Handles REST API calls and terminal WebSocket connections.

import { Base64 } from "js-base64";

export interface ServerConfig {
  serverUrl: string; // e.g. https://uuu.tailxxxx.ts.net or http://100.x.x.x:8787
  username: string;
  password: string;
}

export function normalizeServerUrl(serverUrl: string): string {
  const trimmed = serverUrl.trim().replace(/\/+$/, "");
  return trimmed.replace(/\.$/, "");
}

export function buildBasicAuthHeader(username: string, password: string): string {
  const token = Base64.encode(`${username}:${password}`);
  return `Basic ${token}`;
}

export function toWsBase(serverUrl: string): string {
  return normalizeServerUrl(serverUrl).replace(/^http/, "ws");
}

export class SideIdeClient {
  private baseUrl: string;
  private serverUrl: string;
  private authHeader: string;

  constructor(config: ServerConfig) {
    this.serverUrl = normalizeServerUrl(config.serverUrl);
    this.baseUrl = `${this.serverUrl}/api`;
    this.authHeader = buildBasicAuthHeader(config.username, config.password);
  }

  private async getCsrfToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/csrf-token`, {
      method: "GET",
      headers: { Authorization: this.authHeader },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Failed to get CSRF token (${res.status})`);
    }
    const json = (await res.json()) as { token?: string };
    if (!json?.token) {
      throw new Error("Failed to get CSRF token (missing token)");
    }
    return json.token;
  }

  private async request<T>(endpoint: string, init: RequestInit): Promise<T> {
    const method = (init.method || "GET").toUpperCase();
    const needsCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);

    const extraHeaders: Record<string, string> = {};
    const raw = init.headers;
    if (raw instanceof Headers) {
      raw.forEach((value: string, key: string) => {
        extraHeaders[key] = value;
      });
    } else if (Array.isArray(raw)) {
      for (const [key, value] of raw) {
        extraHeaders[key] = value;
      }
    } else if (raw && typeof raw === "object") {
      for (const [key, value] of Object.entries(raw as Record<string, string>)) {
        extraHeaders[key] = String(value);
      }
    }

    const run = async (csrfToken?: string) => {
      const headers: Record<string, string> = {
        Authorization: this.authHeader,
        ...extraHeaders,
      };
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      return fetch(`${this.baseUrl}${endpoint}`, {
        ...init,
        headers,
      });
    };

    const csrfToken = needsCsrf ? await this.getCsrfToken() : undefined;
    let response = await run(csrfToken);

    // If CSRF enforcement is enabled and token was rejected, retry once with a fresh token.
    if (needsCsrf && response.status === 403) {
      const retryToken = await this.getCsrfToken();
      response = await run(retryToken);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const msg = text || `HTTP ${response.status}: ${response.statusText}`;
      const err = new Error(msg);
      (err as any).status = response.status;
      throw err;
    }

    // 204 etc.
    if (response.status === 204) return undefined as unknown as T;
    return (await response.json()) as T;
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async getWsToken(): Promise<string> {
    // Same endpoint as web app.
    return this.request<{ token: string }>("/ws-token", { method: "GET" }).then((r) => r.token);
  }

  connectTerminalWebSocket(terminalId: string, token?: string): WebSocket {
    const wsBase = toWsBase(this.serverUrl);
    const url = token
      ? `${wsBase}/api/terminals/${terminalId}?token=${encodeURIComponent(token)}`
      : `${wsBase}/api/terminals/${terminalId}`;
    return new WebSocket(url, undefined);
  }
}

let clientInstance: SideIdeClient | null = null;

export function setClient(config: ServerConfig): void {
  clientInstance = new SideIdeClient(config);
}

export function clearClient(): void {
  clientInstance = null;
}

export function getClient(): SideIdeClient {
  if (!clientInstance) {
    throw new Error("Client not configured. Please connect first.");
  }
  return clientInstance;
}
