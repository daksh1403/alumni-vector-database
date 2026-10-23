import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "ui.spec.js",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:8791", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm run dev -- --port 8791 --ip 127.0.0.1",
    url: "http://127.0.0.1:8791",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
