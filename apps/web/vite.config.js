import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Get target from environment
const isDesktop = process.env.TAURI_FAMILY === "desktop";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === "production"
      ? [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: [],
            manifest: {
              name: "S-IDE Studio IDE",
              short_name: "S-IDE",
              description: "A modern IDE for AI agent workflows",
              theme_color: "#2563eb",
              icons: [],
            },
          }),
        ]
      : []),
  ],
  // Set log level to error to suppress warnings
  logLevel: "error",
  // Tauri expects a fixed port, and fails if it's not available
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        ws: true, // Enable WebSocket proxy for /api paths
      },
      "/ws": {
        target: "ws://localhost:8787",
        ws: true,
      },
    },
  },
  // Prevent vite from obscuring rust errors
  clearScreen: false,
  // Tauri expects a specific frontend dist directory
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: isDesktop ? ["es2021", "chrome97", "safari13"] : "modules",
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    // Set chunk size warning limit to avoid warnings
    chunkSizeWarningLimit: 2000,
    // Optimize deps to include Tauri API
    optimizeDeps: {
      include: ["@tauri-apps/api"],
    },
  },
  // Suppress rollup warnings
  onwarn(warning, warn) {
    // Suppress warnings for Tauri API mixed imports
    if (warning.code === "MIXED_EXPORTS") return;
    if (warning.code === "DUPLICATE_IMPORT") return;
    if (warning.code === "EVAL") return;
    // Suppress dynamic import warnings for Tauri API
    if (
      warning.message?.includes("dynamically imported") &&
      warning.message?.includes("@tauri-apps/api")
    )
      return;
    warn(warning);
  },
}));
