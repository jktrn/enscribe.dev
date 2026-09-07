import { expect, test } from "bun:test"
import {
  box,
  glue,
  penalty,
  paragraphEnd,
  prepareParagraph,
  breakParagraph,
  breakParagraphOnce,
  discretionary,
  type Item,
} from "@linebreak/layout"

test("mandatory and optional huge prefixes cannot erase a later small line", () => {
  for (const boundary of [-10000, -100]) {
    const items = [
      box(1e16),
      glue(0, 0, 1e16),
      penalty(boundary),
      box(1),
      ...paragraphEnd(),
    ]
    const prepared = prepareParagraph(items)
    for (const result of [
      breakParagraphOnce(items, 1, { tolerance: 100 }),
      prepared.breakParagraphOnce(1, { tolerance: 100 }),
    ]) {
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.lines.map((line) => line.naturalWidth)).toEqual([1e16, 1])
      expect(result.lines[1]?.adjustmentRatio).toBe(0)
    }
  }
})

test("overflowing global prefixes can still contain finite, representable lines", () => {
  const large = Number.MAX_VALUE
  const items = [
    box(large),
    box(large),
    box(-large),
    glue(0, 0, large),
    penalty(-100),
    box(1),
    ...paragraphEnd(),
  ]
  const result = breakParagraphOnce(items, 1, { tolerance: 100 })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    large,
    1,
  ])
})

test("later lines retain their own small elasticity after a huge earlier pool", () => {
  const items = [
    box(3),
    glue(0, 1e16, 1e16),
    penalty(-10000),
    box(4),
    glue(0, 1, 1),
    penalty(-10000),
    box(2),
    glue(0, 1, 1),
    penalty(-10000),
  ]
  const result = breakParagraphOnce(items, 3, { tolerance: 100 })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.lines.map((line) => line.adjustmentRatio)).toEqual([0, -1, 1])
  expect(result.lines.map((line) => [line.stretch, line.shrink])).toEqual([
    [1e16, 1e16],
    [1, 1],
    [1, 1],
  ])
})

test("fragment and margin cancellation preserves a small positive physical width", () => {
  const items = [
    box(1e16),
    discretionary({
      preWidth: 1,
      postWidth: 1,
      penalty: -10000,
      breakOffset: 0,
    }),
    box(1e16),
    penalty(-10000),
  ]
  const hangs = {
    start: new Float64Array(items.length + 1),
    end: new Float64Array(items.length),
  }
  hangs.end[1] = 1e16
  hangs.start[2] = 1e16
  const result = breakParagraphOnce(items, 1, { tolerance: 100, hangs })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    1, 1,
  ])
})

test("multiple lost capacity components are recovered with and without caller elasticity", () => {
  const items = [
    box(4),
    ...[1e100, 1, 1e-100, -1e100].map((value) => glue(0, value, value)),
    penalty(-10000),
  ]
  for (const flex of [
    undefined,
    {
      stretch: new Float64Array(items.length + 1),
      shrink: new Float64Array(items.length + 1),
    },
  ]) {
    const result = breakParagraphOnce(items, 3, { tolerance: 100, flex })
    expect(result.ok).toBe(true)
    if (!result.ok) continue
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]?.stretch).toBe(1)
    expect(result.lines[0]?.shrink).toBe(1)
    expect(result.lines[0]?.adjustmentRatio).toBe(-1)
  }
})

test("automatic emergency spacing avoids intermediate overflow and subnormal double rounding", () => {
  for (const [widths, target, budget] of [
    [[1e307, 1e307], 1e308, 1.2e308],
    [Array.from({ length: 32 }, () => 1e307), 1e308, 1.2e308],
    [
      [Number.MIN_VALUE, 2 * Number.MIN_VALUE],
      9 * Number.MIN_VALUE,
      18 * Number.MIN_VALUE,
    ],
  ] as const) {
    const items: Item[] = [...widths, 0, -1].flatMap<Item>((width) => [
      box(-width),
      glue(width, 0, 0),
    ])
    items.push(box(0), penalty(-10000))
    const expected = breakParagraph(items, target, { emergencyStretch: budget })
    expect(expected.ok && expected.pass).toBe("emergency")
    expect(breakParagraph(items, target)).toEqual(expected)
    expect(prepareParagraph(items).breakParagraph(target)).toEqual(expected)
  }
})

test("pruning accounts for a recovered capacity after its visible prefixes cancel", () => {
  const large = 2 ** 100
  const items = [
    box(10),
    glue(0, 0, -large),
    glue(0, 0, -1),
    glue(0, 0, large),
    penalty(-10000),
    box(11),
    penalty(0),
    glue(0, 0, 1),
    glue(0, 0, large),
    glue(0, 0, -large),
    penalty(-10000),
  ]
  const result = breakParagraphOnce(items, 10, { tolerance: 100 })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    10, 11,
  ])
  expect(result.ok && result.lines.map((line) => line.shrink)).toEqual([-1, 1])
  expect(result.ok && result.demerits).toBe(12200)
})

test("a future capacity correction can make an initially overfull line feasible", () => {
  const large = 2 ** 100
  const items = [
    box(11),
    penalty(0),
    glue(0, 0, large),
    glue(0, 0, 1),
    glue(0, 0, -large),
    penalty(-10000),
  ]
  const result = breakParagraphOnce(items, 10, { tolerance: 100 })
  expect(result.ok && result.lines.map((line) => line.shrink)).toEqual([1])
  expect(result.ok && result.demerits).toBe(12100)
})

test("exact capacity recovery includes signed differences of nonzero flex prefixes", () => {
  const items = [
    box(8),
    ...[1e100, 1, 1e-100, -1e100].map((value) => glue(0, value, value)),
    penalty(-10000),
  ]
  const flex = {
    stretch: Float64Array.from([0, 3, 3, 4, 5, 6, 6]),
    shrink: Float64Array.from([0, 3, 3, 4, 5, 6, 6]),
  }
  const result = breakParagraphOnce(items, 1, { tolerance: 100, flex })
  expect(
    result.ok && result.lines.map((line) => [line.stretch, line.shrink]),
  ).toEqual([[7, 7]])
  expect(result.ok && result.lines[0]?.adjustmentRatio).toBe(-1)
})

test("automatic spacing averages nonuniform widths even when their total overflows", () => {
  const widths = [2e307, ...Array.from({ length: 31 }, () => 1e307)]
  const items: Item[] = widths.flatMap<Item>((width) => [
    box(-width),
    glue(width, 0, 0),
  ])
  items.push(box(0), penalty(-10000))
  const result = breakParagraph(items, 1e308)
  expect(result.ok && result.pass).toBe("emergency")
  if (!result.ok) return
  expect(result.lines).toHaveLength(1)
  expect(result.lines[0]?.adjustmentRatio).toBeCloseTo(1e308 / 1.2375e308, 12)
})

test("a future negative endpoint width can repair an earlier overfull candidate", () => {
  const items = [box(10), penalty(0), penalty(-10000, { width: -9 })]
  const result = breakParagraphOnce(items, 1, { tolerance: 0 })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    1,
  ])
})

test("future fragment and margin magnitudes participate in the pruning roundoff bound", () => {
  const large = 2 ** 100 + 2 ** 48
  const target = 2 ** 47
  const items = [box(large), penalty(0), penalty(-10000, { width: target })]
  const hangs = {
    start: new Float64Array(items.length + 1),
    end: Float64Array.from([0, 0, large]),
  }
  // (large + target) rounds upward before subtracting large; the exact
  // line sum equals target. The future operands, not merely their bound,
  // must determine the allowance used at the earlier overfull endpoint.
  const result = breakParagraphOnce(items, target, { tolerance: 0, hangs })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    target,
  ])
})
