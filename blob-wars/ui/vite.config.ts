import { fileURLToPath, URL } from "node:url";

import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { consoleForwardPlugin } from "./plugins/vite-console-forward";

const blobWarsRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
    },
  },
  server: {
    fs: {
      allow: [blobWarsRoot],
    },
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    consoleForwardPlugin({
      enabled: true,
      endpoint: "/api/debug/client-logs",
      levels: ["log", "warn", "error", "info", "debug"],
    }),
  ],
});
