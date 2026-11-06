import { runtimeEnv } from "@quote/contract/runtime-env";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const dev = runtimeEnv("development");

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      "/v1": `http://127.0.0.1:${dev.SERVER_PORT}`,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
  },
});
