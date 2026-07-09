import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Backend dev port; matches ./.env PORT (3001). Override via VITE_DEV_API_ORIGIN.
const devApiTarget = process.env.VITE_DEV_API_ORIGIN ?? "http://localhost:3001";

// biome-ignore lint/style/noDefaultExport: https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    allowedHosts: ["chat.scottylabs.org"],
    // Same-origin API in dev so auth cookies/headers are sent reliably
    // (page is localhost:3000; calling the backend directly is cross-origin).
    proxy: {
      "/api": { target: devApiTarget, changeOrigin: true },
      "/chats": { target: devApiTarget, changeOrigin: true },
      "/me": { target: devApiTarget, changeOrigin: true },
      "/hello": { target: devApiTarget, changeOrigin: true },
      "/swagger": { target: devApiTarget, changeOrigin: true },
      "/openapi.json": { target: devApiTarget, changeOrigin: true },
      // Server-side auth endpoints (login/callback/logout/me) live on the API.
      "/api/auth": { target: devApiTarget, changeOrigin: true },
    },
  },
  plugins: [
    ...(mode === "development" ? [devtools()] : []),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    viteReact({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
}));
