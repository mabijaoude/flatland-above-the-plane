import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  use: {
    baseURL,
    actionTimeout: 10_000,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined
  },
  // An explicit URL exercises an already-running development deployment.
  // The default uses the built artifact, including its materialized LFS images.
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "pnpm preview --port 4173 --strictPort",
    url: baseURL,
    reuseExistingServer: false
  }
});
