import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: "line",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "node e2e/mock-supabase.mjs",
      url: "http://127.0.0.1:54321/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "node e2e/start-worker.mjs",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host localhost --port 5173",
      url: "http://localhost:5173/e2e/collaboration-harness.html",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...process.env,
        VITE_AZ_COLLABORATION_URL: "http://127.0.0.1:8787",
      },
    },
  ],
});
