import { defineConfig, devices } from "@playwright/test"
import { fileURLToPath } from "node:url"

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url))
const port = Number(process.env.LINEBREAK_PLAYWRIGHT_PORT ?? 4391)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: "./specs",
  testMatch: "**/*.pw.ts",
  outputDir: "./test-results",
  reporter: "line",
  fullyParallel: false,
  workers: 1,
  globalTimeout: 45 * 60_000,
  timeout: 90_000,
  preserveOutput: "failures-only",
  use: { baseURL, trace: "off", video: "off" },
  webServer: {
    command: `bunx astro preview --host 127.0.0.1 --port ${port}`,
    cwd: repoRoot,
    reuseExistingServer: true,
    timeout: 60_000,
    url: baseURL,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
})
