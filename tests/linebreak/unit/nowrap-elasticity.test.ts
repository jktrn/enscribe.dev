import { expect, test } from "bun:test"
import { breakParagraphOnce } from "@linebreak/layout/breaker"
import { compileRuns, createMetrics } from "@linebreak/text"

const metrics = createMetrics({ measure: (text) => text.length * 10 })
const compile = (track = 0) => {
  const result = compileRuns([{ text: "alpha beta gamma" }], metrics, {
    nowrap: [{ start: 0, end: 10 }], track,
  })
  if (!result.ok) throw new Error(result.reason)
  return result
}

test.each([98, 102])("a nowrap space remains elastic at a %spx measure", (target) => {
  const compiled = compile()
  const layout = breakParagraphOnce(compiled.items, target, { tolerance: 100 })
  if (!layout.ok) throw new Error(layout.reason)
  expect(layout.lines.map((line) => [line.sourceStart, line.sourceEnd]))
    .toEqual([[0, 10], [11, 16]])
  const line = layout.lines[0]!
  expect(line.naturalWidth).toBe(100)
  expect(line.spaceCount).toBe(1)
  expect(line.stretch).toBe(5)
  expect(line.shrink).toBeCloseTo(10 / 3, 12)
  expect(line.adjustmentRatio).toBeCloseTo(target === 98 ? -0.6 : 0.4, 12)
})

test("spacing flexibility cannot authorize a break inside a nowrap range", () => {
  expect(breakParagraphOnce(compile().items, 60, { tolerance: 100 }).ok).toBe(false)
})

test("nowrap spaces and letter tracking contribute their separate capacities", () => {
  const compiled = compile(0.02)
  const layout = breakParagraphOnce(compiled.items, 96, {
    tolerance: 100, flex: compiled.flex ?? undefined,
  })
  if (!layout.ok) throw new Error(layout.reason)
  const line = layout.lines[0]!
  expect(line.sourceEnd).toBe(10)
  expect(line.spaceCount).toBe(1)
  expect(line.shrink).toBeCloseTo(10 / 3 + 90 * 0.02, 12)
  expect(line.adjustmentRatio).toBeCloseTo(-4 / (10 / 3 + 90 * 0.02), 12)
})
