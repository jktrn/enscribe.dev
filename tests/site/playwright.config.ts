import { defineConfig, devices } from "@playwright/test"
import { fileURLToPath } from "node:url"

const repoRoot = fileURLToPath(new URL("../..", import.meta.url))
const port = Number(process.env.SITE_PLAYWRIGHT_PORT ?? 4321)
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: "./specs",
  testMatch: "**/*.pw.ts",
  outputDir: "./test-results",
  reporter: "line",
  fullyParallel: false,
  workers: 1,
  globalTimeout: 5 * 60_000,
  timeout: 30_000,
  preserveOutput: "failures-only",
  use: {
    baseURL,
    colorScheme: "light",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: `bun run dev -- --host localhost --port ${port}`,
    cwd: repoRoot,
    reuseExistingServer: process.env.CI !== "true",
    timeout: 60_000,
    url: baseURL,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
