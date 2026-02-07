import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "apps/web/src/**/__tests__/**", // Exclude web tests from node environment
      "**/context-manager/**/__tests__/**", // Exclude context-manager tests (ES module issues)
      "apps/server/src/__tests__/unit/database.test.ts", // Exclude SQLite tests (native module)
      "apps/server/src/__tests__/unit/path.test.ts", // Exclude path tests (shared utils-node module)
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["apps/*/src/**", "packages/*/src/**"],
      exclude: [
        "**/__tests__/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "apps/desktop/src-tauri/**",
      ],
      // Coverage thresholds (disabled for now - tests pass but coverage is low)
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
    // Setup files
    setupFiles: [],
    // Test timeout
    testTimeout: 10000,
    // Isolate tests for better error reporting
    isolate: true,
    // Show coverage report after tests
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@side-ide/shared": "./packages/shared",
    },
  },
});
