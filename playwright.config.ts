import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  maxFailures: process.env.CI ? 2 : undefined,
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
  use: {
    baseURL,
    actionTimeout: 10_000,
    viewport: process.env.CI ? { width: 1024, height: 768 } : { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      // Hosted runners have no physical GPU. Explicit SwiftShader uses the
      // supported software ANGLE path; this flag never ships in the app.
      // Let Skia draw the 2D native-vision canvas directly on the CPU instead
      // of routing hundreds of paint operations through an emulated GPU.
      args: process.env.CI ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] : []
    }
  },
  // An explicit URL exercises an already-running development deployment.
  // The default uses the built artifact, including its materialized LFS images.
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "pnpm preview --port 4173 --strictPort",
    url: baseURL,
    reuseExistingServer: false
  }
});
