import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

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
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8787",
        ws: true,
      },
    },
  },
}));
