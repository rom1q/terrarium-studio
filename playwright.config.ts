import { defineConfig, devices } from "@playwright/test";
import { execPath } from "node:process";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4179",
  },
  webServer: {
    command: `"${execPath}" ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4179`,
    url: "http://127.0.0.1:4179",
    reuseExistingServer: true,
  },
});