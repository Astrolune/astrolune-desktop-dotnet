import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";

const devProxyTarget = (port: number) => ({
  target: `http://localhost:${port}`,
  changeOrigin: true,
});

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@renderer", replacement: path.resolve(__dirname, "src/renderer/") },
      { find: "@main", replacement: path.resolve(__dirname, "src/main/") },
      { find: "@locales", replacement: path.resolve(__dirname, "src/locales/index.ts") },
      { find: "@locales/", replacement: path.resolve(__dirname, "src/locales/") },
      { find: "@types", replacement: path.resolve(__dirname, "src/types/") },
      { find: "@tauri-apps/api/core", replacement: path.resolve(__dirname, "src/lib/tauri/core.ts") },
      { find: "@tauri-apps/api/event", replacement: path.resolve(__dirname, "src/lib/tauri/event.ts") },
      { find: "@tauri-apps/api/window", replacement: path.resolve(__dirname, "src/lib/tauri/window.ts") },
      { find: "tauri-plugin-keyring-api", replacement: path.resolve(__dirname, "src/lib/tauri/keyring.ts") }
    ]
  },
  build: {
    sourcemap: true,
    emptyOutDir: true
  },
  server: {
    open: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/auth": devProxyTarget(5001),
      // Keep media avatar/banner routes before generic /api/users.
      "/api/users/@me/avatar": devProxyTarget(5005),
      "/api/users/@me/banner": devProxyTarget(5005),
      "/api/users": devProxyTarget(5002),
      "/api/guilds": devProxyTarget(5003),
      "/api/messages": devProxyTarget(5004),
      "/api/media": devProxyTarget(5005),
      "/api/voice": devProxyTarget(5005),
      "/realtime": {
        target: "http://localhost:6000",
        ws: true,
        changeOrigin: true,
        rewrite: (incomingPath) => incomingPath.replace(/^\/realtime/, ""),
      },
    },
  }
});
