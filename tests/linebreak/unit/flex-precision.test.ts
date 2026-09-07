import { expect, test } from "bun:test"
import {
  box,
  glue,
  penalty,
  prepareParagraph,
  breakParagraphOnce,
} from "@linebreak/layout"
import {
  budgetFlex,
  flexBetween,
  pooledFlex,
  type Flex,
} from "@linebreak/layout/flex"
import { buildTracking, trackLines } from "@linebreak/layout/tracking"
import { buildExpansion, fitLines } from "@linebreak/layout/expansion"
import cases from "./support/exact-ranges.json"
import products from "./support/exact-flex-products.json"

const budget = (widths: readonly number[], amount = 1) =>
  budgetFlex(
    widths.map((width) => box(width)),
    amount,
    amount,
    new Set(),
  )

test("builder capacities preserve exact per-item products through cancellation and overflow", () => {
  for (const entry of cases) {
    const flex = budget(entry.values)
    for (const range of entry.ranges) {
      const expected = Number(range.difference)
      expect(flexBetween(flex, range.start, range.end)).toEqual({
        stretch: expected,
        shrink: expected,
      })
    }
  }
})

test("changed endpoints use supplied values without discarding untouched endpoint precision", () => {
  const flex = budget([1e16, 1, 3])
  expect(flexBetween(flex, 1, 2).stretch).toBe(1)
  flex.stretch[0] = 99
  expect(flexBetween(flex, 1, 2).stretch).toBe(1)
  flex.stretch[1] = 1e16 - 2
  expect(flexBetween(flex, 1, 2).stretch).toBe(3)
  flex.stretch[2] = 1e16 + 2
  expect(flexBetween(flex, 1, 2).stretch).toBe(4)
  flex.stretch[1] = 1e16
  flex.stretch[2] = 1e16
  expect(flexBetween(flex, 1, 2).stretch).toBe(1)
  expect(flexBetween(flex, 1, 2).shrink).toBe(1)
})

test("pooling preserves both exact budgets and independently snapshots changed endpoints", () => {
  const first = budget([1e16, 1])
  const second = budget([1e16, 2])
  const pooled = pooledFlex(first, second)
  expect(flexBetween(pooled, 1, 2)).toEqual({ stretch: 3, shrink: 3 })
  first.stretch[1] = 0
  second.shrink[2] = 0
  expect(flexBetween(pooled, 1, 2)).toEqual({ stretch: 3, shrink: 3 })
  const changed = pooledFlex(first, second)
  expect(flexBetween(changed, 1, 2)).toEqual({
    stretch: 1e16 + 4,
    shrink: -1e16,
  })
})

test("raw sidecars keep arbitrary endpoint offsets and pooling preserves rounded-sum residuals", () => {
  const first: Flex = {
    stretch: Float64Array.of(1e16, 1e16),
    shrink: Float64Array.of(4, 6),
  }
  const second: Flex = {
    stretch: Float64Array.of(0, 1),
    shrink: Float64Array.of(3, 5),
  }
  expect(flexBetween(pooledFlex(first, second), 0, 1)).toEqual({
    stretch: 1,
    shrink: 4,
  })
  expect(flexBetween(first, 0, 1)).toEqual({ stretch: 0, shrink: 2 })
})

test("wide budgets survive pooling, invalid endpoints, and exact solver snapshotting", () => {
  const first = budget([2 ** 100, 1, 2 ** -100])
  const second = budget([2 ** 100, 2, 2 ** -99])
  expect(flexBetween(pooledFlex(first, second), 2, 3).stretch).toBe(
    3 * 2 ** -100,
  )
  const invalid = budget([Number.POSITIVE_INFINITY, 1])
  expect(flexBetween(invalid, 1, 2).stretch).toBeNaN()
  expect(flexBetween(pooledFlex(invalid, first), 1, 2).stretch).toBeNaN()
  const items = [
    box(2 ** 100),
    penalty(-10000),
    box(1),
    penalty(-10000),
    box(2 ** -100),
    penalty(-10000),
  ]
  const flex = budgetFlex(items, 1, 1, new Set())
  const prepared = prepareParagraph(items, { flex })
  const result = prepared.breakParagraph(1)
  expect(result.ok).toBe(true)
  if (result.ok)
    expect(result.lines.map((line) => line.stretch)).toEqual([
      2 ** 100,
      1,
      2 ** -100,
    ])
  flex.stretch.fill(0)
  expect(prepared.breakParagraph(1)).toEqual(result)
  const changed = breakParagraphOnce(items, 1, { flex, tolerance: 10000 })
  expect(changed.ok).toBe(true)
  if (changed.ok)
    expect(changed.lines.every((line) => line.stretch === 0)).toBe(true)
})

test("pooling can recover finite exact endpoints after opposite overflowing approximations", () => {
  const max = Number.MAX_VALUE
  const positive = budget([max, max, 1])
  const negative = budget([-max, -max, 2])
  const pooled = pooledFlex(positive, negative)
  expect(flexBetween(pooled, 2, 3)).toEqual({ stretch: 3, shrink: 3 })
  pooled.stretch[2] = 10
  expect(flexBetween(pooled, 2, 3).stretch).toBe(-7)
})

test("invalid and detached builder endpoints remain ordinary infeasible geometry", () => {
  const items = [box(Number.POSITIVE_INFINITY), box(1), penalty(-10000)]
  const invalid = budgetFlex(items, 1, 1, new Set())
  expect(
    breakParagraphOnce(items, 10, { flex: invalid, tolerance: 0 }).ok,
  ).toBe(false)
  const detached = budget([1e16, 1])
  structuredClone(detached.stretch, {
    transfer: [detached.stretch.buffer as ArrayBuffer],
  })
  expect(flexBetween(detached, 1, 2).stretch).toBeNaN()
  expect(flexBetween(detached, -1, 2).shrink).toBeNaN()
  expect(
    breakParagraphOnce([box(1), box(1), penalty(-10000)], 2, {
      flex: detached,
      tolerance: 0,
    }).ok,
  ).toBe(false)
})

test("solver, tracking, and expansion agree on a small line after a huge mandatory prefix", () => {
  const items = [
    box(1e16),
    penalty(-10000),
    box(1),
    glue(0, 0, 0),
    box(1),
    penalty(-10000),
  ]
  const tracking = buildTracking(items, 1, new Set())
  const scale = {
    steps: [
      { pct: 100, ratio: 1 },
      { pct: 200, ratio: 2 },
    ],
  }
  const expansion = buildExpansion(items, scale, new Set())
  const prepared = prepareParagraph(items, {
    flex: pooledFlex(tracking, expansion),
  })
  const result = prepared.breakParagraph(2)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  const small = result.lines.at(-1)!
  expect(small.stretch).toBe(4)
  expect(flexBetween(tracking, small.start, small.end).stretch).toBe(2)
  expect(fitLines([small], 4, expansion, scale)[0]?.stretch).toBe(2)
  expect(
    trackLines([{ ...small, breakKind: "space" }], 4, tracking, null)[0]?.gain,
  ).toBe(1)
})

test("unequal signed budgets retain the exact sums of individually rounded products", () => {
  // Expected values come from Python Fraction.from_float after each binary64
  // multiplication, rather than multiplying an already-rounded range sum.
  for (const entry of products) {
    const flex = budgetFlex(
      entry.values.map((width) => box(width)),
      entry.up,
      entry.down,
      new Set(),
    )
    for (const range of entry.ranges) {
      expect(flexBetween(flex, range.start, range.end)).toEqual({
        stretch: Number(range.stretch),
        shrink: Number(range.shrink),
      })
    }
  }
})

test("changing only the ending endpoint discards only its original residual", () => {
  const flex = budget([1e16, 1, 3])
  flex.stretch[2] = 1e16 + 2
  expect(flexBetween(flex, 1, 2)).toEqual({ stretch: 2, shrink: 1 })
})

test("a changed ending retains the nonzero carry at an untouched starting endpoint", () => {
  const flex = budget([1e16, 1, 3])
  flex.stretch[3] = 1e16 + 8
  // The untouched starting value is exactly 1e16 + 1, despite its visible
  // prefix being 1e16. The edited ending is its supplied binary64 value.
  expect(flexBetween(flex, 2, 3)).toEqual({ stretch: 7, shrink: 3 })

  const wide = budget([2 ** 100, 1, 2 ** -100, 3])
  wide.stretch[4] = 2 ** 100 + 2 ** 49
  // The exact difference is 2^49 - 1 - 2^-100, which rounds to 2^49 - 1.
  expect(flexBetween(wide, 3, 4)).toEqual({
    stretch: 2 ** 49 - 1,
    shrink: 3,
  })
})

test("pooled point records can contain a valid endpoint after an invalid endpoint", () => {
  const first = {
    stretch: Float64Array.of(Number.NaN, 1),
    shrink: Float64Array.of(0, 2),
  }
  const second = {
    stretch: Float64Array.of(0, 2),
    shrink: Float64Array.of(0, 3),
  }
  expect(flexBetween(pooledFlex(first, second), 0, 1)).toEqual({
    stretch: Number.NaN,
    shrink: 5,
  })
})

test("an undersized exact sidecar fails without treating absent metadata as a bigint", () => {
  const flex = budget([2 ** 100, 1, 2 ** -100])
  expect(flexBetween(flex, 3, 4).stretch).toBeNaN()
  expect(
    breakParagraphOnce([box(1), box(1), box(1), box(1), penalty(-10000)], 4, {
      tolerance: 0,
      flex,
    }).ok,
  ).toBe(false)
})

test("pooling preserves residuals even when every supplied endpoint has a carry", () => {
  const first = {
    stretch: Float64Array.of(1e16, 1e16),
    shrink: Float64Array.of(1e16, 1e16),
  }
  const second = {
    stretch: Float64Array.of(1, 3),
    shrink: Float64Array.of(3, 1),
  }
  const pooled = pooledFlex(first, second)
  expect(flexBetween(pooled, 0, 1)).toEqual({ stretch: 2, shrink: -2 })
  const zero = { stretch: Float64Array.of(0, 0), shrink: Float64Array.of(0, 0) }
  expect(flexBetween(pooledFlex(pooled, zero), 0, 1)).toEqual({
    stretch: 2,
    shrink: -2,
  })
})
