import { defineConfig, devices } from "@playwright/test"
import { fileURLToPath } from "node:url"

const fixtureRoot = fileURLToPath(new URL("./fixture", import.meta.url))
const port = Number(process.env.LINEBREAK_PLAYWRIGHT_PORT ?? 4391)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: "./specs",
  testMatch: "**/*.pw.ts",
  outputDir: "./test-results",
  reporter: "line",
  fullyParallel: false,
  workers: 1,
  maxFailures: 1,
  globalTimeout: 3 * 60_000,
  preserveOutput: "failures-only",
  use: { baseURL, trace: "off", video: "off" },
  webServer: {
    command: `vite --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: fixtureRoot,
    reuseExistingServer: false,
    timeout: 15_000,
    url: baseURL,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
})
