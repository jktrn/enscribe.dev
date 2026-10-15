import { expect, test } from "bun:test"
import { compileBlock } from "@linebreak/layout/compile"
import { createMetrics } from "@linebreak/text/segments"

const compile = (difference: number, protrude: boolean, probes: string[]) => {
  const metrics = createMetrics({
    font: "16px inset",
    measure: (text) => {
      probes.push(text)
      if (text === "i") return 0
      if (text === "M") return difference
      return text.length * 10
    },
  })
  const result = compileBlock({
    block: {
      text: "“alpha”,",
      runs: [
        { kind: "text", start: 0, end: 8, text: "“alpha”,", hyphenates: false },
      ],
      breakRestrictions: [],
    },
    baseFont: "16px base",
    metricsFor: () => metrics,
    locale: "en",
    protrude,
  })
  if (!result.ok) throw new Error(result.reason)
  return result
}

test("the monospace tolerance excludes its upper boundary", () => {
  expect(compile(0.01, true, []).hangs!.start[0]).toBeGreaterThan(0)
  expect(compile(0.005, true, []).hangs!.start[0]).toBe(0)
})

test("disabled protrusion does not measure an unused inset-font classification", () => {
  const probes: string[] = []
  expect(compile(0.01, false, probes).hangs).toBeNull()
  expect(probes).not.toContain("i")
  expect(probes).not.toContain("M")
})
