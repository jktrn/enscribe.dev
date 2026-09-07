import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL("../../", import.meta.url))

export default defineConfig({
  root,
  resolve: {
    alias: {
      "bun:test": "vitest",
      "@linebreak": `${root}packages/linebreak/src`,
    },
  },
  test: {
    // Exhaustive solver checks run longer under coverage instrumentation.
    testTimeout: 30_000,
    maxWorkers: 1,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["packages/linebreak/src/**/*.ts"],
      exclude: ["**/*.d.ts"],
      reportsDirectory: "tests/linebreak/coverage",
      reporter: ["text-summary", "html", "lcov"],
    },
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/linebreak/unit/**/*.test.ts"] } },
      { extends: true, test: { name: "browser", include: ["tests/linebreak/browser/**/*.test.ts"], environment: "happy-dom" } },
    ],
  },
})
