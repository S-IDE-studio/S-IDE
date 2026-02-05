// Setup for web component tests
import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => ({
  default: () => null,
  __esModule: true,
}));

// Mock xterm
vi.mock("xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    write: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn(),
    onBinary: vi.fn(),
  })),
}));

vi.mock("xterm-addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));

vi.mock("xterm-addon-web-links", () => ({
  WebLinksAddon: vi.fn(),
}));

vi.mock("xterm-addon-unicode11", () => ({
  Unicode11Addon: vi.fn(),
}));

vi.mock("xterm-addon-webgl", () => ({
  WebglAddon: vi.fn(),
}));

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string | ArrayBuffer) {
    // Mock send - in tests, use event emitter to trigger onmessage
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close"));
    }
  }

  addEventListener(type: string, listener: EventListener) {
    // Store listeners for test control
  }

  removeEventListener(type: string, listener: EventListener) {
    // Remove stored listeners
  }
}

// @ts-expect-error - WebSocket is read-only
global.WebSocket = MockWebSocket;

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  root = null;
  rootMargin = "";
  thresholds = [];
  takeRecords = vi.fn();
}

global.IntersectionObserver = IntersectionObserverMock as any;
