// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: vi.fn(),
  // debug: vi.fn(),
  // info: vi.fn(),
};

// Mock Web Crypto API for Node environment
if (!global.crypto) {
  // @ts-expect-error - crypto is read-only but we need to mock it
  global.crypto = {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    randomUUID: () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
  };
}

// Set timezone for consistent tests
process.env.TZ = "UTC";
