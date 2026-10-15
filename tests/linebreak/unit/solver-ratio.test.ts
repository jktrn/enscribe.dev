import { expect, test } from "bun:test"
import {
  box,
  glue,
  penalty,
  prepareParagraph,
  breakParagraphOnce,
} from "@linebreak/layout"
import cases from "./support/exact-ratios.json"

test("finite adjustment ratios survive numerator, denominator, and combined overflow", () => {
  const max = Number.MAX_VALUE
  for (const [target, natural, stretch, emergencyStretch, expected] of [
    [max, -max, max, 0, 2],
    [max, 0, max, max, 0.5],
    [max, -max, max, max, 1],
    [Number.MIN_VALUE, 0, max, max, 0],
    [max, -max / 2, max, max / 2, 1],
  ] as const) {
    const items = [
      box(natural),
      penalty(10000),
      glue(0, stretch, 0),
      penalty(-10000),
    ]
    const options = {
      tolerance: 800,
      emergencyStretch,
      policy: { adjDemerits: 0 },
    }
    for (const result of [
      breakParagraphOnce(items, target, options),
      prepareParagraph(items).breakParagraphOnce(target, options),
    ]) {
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.lines).toHaveLength(1)
      expect(result.lines[0]?.adjustmentRatio).toBe(expected)
      expect(result.demerits).toBe((10 + 100 * expected ** 3) ** 2)
    }
  }
})

test("overflow scaling agrees with independent rational ratios within ordinary arithmetic rounding", () => {
  for (const entry of cases) {
    const items = [
      box(entry.natural),
      penalty(10000),
      glue(0, entry.stretch, 0),
      penalty(-10000),
    ]
    const result = breakParagraphOnce(items, entry.target, {
      tolerance: 800,
      emergencyStretch: entry.emergency,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) continue
    // The ratio uses binary64 operations, as on the ordinary finite path.
    // These independent Fraction references bound their combined rounding.
    expect(
      Math.abs(result.lines[0]!.adjustmentRatio - entry.ratio),
    ).toBeLessThanOrEqual(2 * Number.EPSILON * entry.ratio)
  }
})

test("finite ordinary and subnormal ratios retain their existing arithmetic order", () => {
  const min = Number.MIN_VALUE
  for (const [target, natural, stretch, emergencyStretch] of [
    [3 * min, 0, 2 * min, 2 * min],
    [3 * min, 0, 3 * min, 2 * min],
    [Number.MAX_VALUE, 0, Number.MAX_VALUE, min],
    [1, 0.1, 0.2, 0.3],
  ] as const) {
    const expected = (target - natural) / (stretch + emergencyStretch)
    const items = [
      box(natural),
      penalty(10000),
      glue(0, stretch, 0),
      penalty(-10000),
    ]
    const result = breakParagraphOnce(items, target, {
      tolerance: 800,
      emergencyStretch,
    })
    expect(result.ok && result.lines[0]?.adjustmentRatio).toBe(expected)
  }
})
