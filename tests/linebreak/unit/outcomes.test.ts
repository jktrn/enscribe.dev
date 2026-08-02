import { expect, test } from "bun:test"
import manifest from "@linebreak/../package.json" with { type: "json" }
import {
  DECLINE_REASONS,
  type DeclineReason,
  FAILURE_REASONS,
  type FailureReason,
  isExpected,
  type Outcome,
  SKIP_REASONS,
  type SkipReason,
} from "@linebreak/types"
import { consoleReporter } from "@linebreak/report"

const element = () => ({}) as HTMLElement

const skipped = (reason: SkipReason): Outcome => ({
  element: element(),
  status: "skipped",
  reason,
})
const declined = (reason: DeclineReason): Outcome => ({
  element: element(),
  status: "declined",
  reason,
})
const failed = (reason: FailureReason): Outcome => ({
  element: element(),
  status: "failed",
  reason,
})

test("a successful outcome carries its line and retry counts", () => {
  const outcome: Outcome = {
    element: element(),
    status: "typeset",
    lines: 7,
    retries: 0,
  }
  expect(outcome.status).toBe("typeset")
  if (outcome.status !== "typeset") return
  expect(outcome.lines).toBe(7)
  expect(outcome.retries).toBe(0)
})

test("skips and successes need no attention; declines and failures do", () => {
  expect(isExpected(skipped("single-line"))).toBe(true)
  expect(isExpected(skipped("too-narrow"))).toBe(true)
  expect(
    isExpected({ element: element(), status: "typeset", lines: 3, retries: 0 }),
  ).toBe(true)

  expect(isExpected(declined("unsupported-content"))).toBe(false)
  expect(isExpected(failed("unstable-width"))).toBe(false)
  expect(isExpected(failed("render-failed"))).toBe(false)
})

test("every reason is a plain string, so it survives serialisation", () => {
  const reasons: Outcome[] = [
    skipped("empty"),
    declined("too-long"),
    failed("layout-mismatch"),
  ]
  for (const outcome of reasons) {
    if (outcome.status === "typeset") continue
    expect(typeof outcome.reason).toBe("string")
    expect(JSON.parse(JSON.stringify({ r: outcome.reason })).r).toBe(
      outcome.reason,
    )
  }
})

test("the default reporter stays quiet about routine skips", () => {
  const seen: string[] = []
  const original = {
    debug: console.debug,
    warn: console.warn,
    info: console.info,
  }
  console.debug = (message: string) => seen.push(`debug:${message}`)
  console.warn = (message: string) => seen.push(`warn:${message}`)
  console.info = (message: string) => seen.push(`info:${message}`)
  try {
    const report = consoleReporter()
    report(skipped("single-line"))
    expect(seen).toHaveLength(0)

    report(declined("unsupported-content"))
    report(failed("render-failed"))
    expect(seen).toHaveLength(2)
    expect(seen[0]).toContain("declined")
    expect(seen[1]).toContain("failed")
  } finally {
    Object.assign(console, original)
  }
})

test("the manifest is ready to publish", () => {
  expect(manifest).not.toHaveProperty("private")
  expect(manifest.publishConfig?.access).toBe("public")
  expect(manifest.repository?.url).toContain("github.com")
  expect(manifest.keywords?.length).toBeGreaterThan(0)
  expect(manifest.files).toEqual(["dist"])
  expect(manifest.sideEffects).toEqual(["*.css"])
})

test("the optimizer is reachable without pulling in the DOM engine", () => {
  const subpaths = Object.keys(manifest.exports)
  expect(subpaths).toContain("./layout")
  expect(subpaths).toContain("./auto")
  expect(subpaths).toContain("./styles.css")
  expect(subpaths).toContain("./package.json")
  expect(manifest.exports["."]).toMatchObject({
    types: expect.any(String),
    default: expect.any(String),
  })
})

test("the three reason sets are disjoint, so replay can classify them", () => {
  // `revert()` stores FailureReasons in the same map as skips and declines, and
  // `composeOne` classifies a remembered reason by set membership. Overlap
  // between the sets makes that classification ambiguous — which is how
  // `render-failed` used to replay as `{ status: "declined" }`, a state the
  // Outcome union says cannot exist.
  const all = [...SKIP_REASONS, ...DECLINE_REASONS, ...FAILURE_REASONS]
  expect(new Set(all).size).toBe(all.length)

  for (const reason of SKIP_REASONS)
    expect(isExpected(skipped(reason))).toBe(true)
  for (const reason of DECLINE_REASONS) {
    expect(isExpected(declined(reason))).toBe(false)
  }
  for (const reason of FAILURE_REASONS) {
    expect(isExpected(failed(reason))).toBe(false)
  }
})
