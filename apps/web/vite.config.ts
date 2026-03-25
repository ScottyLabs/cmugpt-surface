import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const devApiTarget = process.env.VITE_DEV_API_ORIGIN ?? "http://localhost:8080";

// biome-ignore lint/style/noDefaultExport: https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    allowedHosts: ["chat.scottylabs.org"],
    // Same-origin API in dev so Better Auth session cookies are sent reliably
    // (page is localhost:3000; calling localhost:8080 directly is cross-origin).
    proxy: {
      "/api": { target: devApiTarget, changeOrigin: true },
      "/chats": { target: devApiTarget, changeOrigin: true },
      "/swagger": { target: devApiTarget, changeOrigin: true },
      "/openapi.json": { target: devApiTarget, changeOrigin: true },
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
