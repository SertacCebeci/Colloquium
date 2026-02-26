import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5174",
  },
  webServer: [
    {
      // UAT seed server — in-memory API with 75 messages, port 5099
      // GET /channels/:id/messages without auth returns 401 — Playwright accepts 401 as "ready"
      command: "pnpm --filter @colloquium/colloquium-api exec tsx src/uat-seed-server.ts",
      url: "http://localhost:5099/channels/ch-uat-001/messages",
      stdout: "pipe",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // Vite web app — proxies /channels/* to localhost:5099
      command: "pnpm dev",
      url: "http://localhost:5174",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
