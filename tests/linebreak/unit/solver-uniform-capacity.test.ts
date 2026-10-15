import { expect, test } from "bun:test"
import {
  box,
  glue,
  penalty,
  prepareParagraph,
  breakParagraphOnce,
  type Item,
} from "@linebreak/layout"

const segment = (unit: number, count: number): Item[] => [
  box(10),
  ...Array.from({ length: count }, () => glue(0, 0, unit)),
  penalty(-10000),
]

test("equal space capacities retain exact multiplicities across forced lines", () => {
  for (const unit of [
    0,
    -0,
    5 / 3,
    -5 / 3,
    Number.MIN_VALUE,
    Number.MAX_VALUE,
  ]) {
    const counts = unit === Number.MAX_VALUE ? [1, 1, 1, 0] : [1, 7, 0, 3]
    const items = counts.flatMap((count) => segment(unit, count))
    const prepared = prepareParagraph(items)
    for (const result of [
      breakParagraphOnce(items, 10, { tolerance: 0 }),
      prepared.breakParagraphOnce(10, { tolerance: 0 }),
    ]) {
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.lines.map((line) => line.shrink)).toEqual(
        counts.map((count) => count * unit + 0),
      )
      expect(result.lines.map((line) => line.spaceCount)).toEqual(counts)
    }
  }
})

test("source-empty glue has capacity even though it contributes no rendered space", () => {
  const items = [
    box(10),
    glue(0, 0, 2, { start: 0, end: 1 }),
    glue(0, 0, 3, { start: 1, end: 1 }),
    penalty(-10000),
  ]
  const result = breakParagraphOnce(items, 10, { tolerance: 0 })
  expect(result.ok && result.lines[0]?.shrink).toBe(5)
  expect(result.ok && result.lines[0]?.spaceCount).toBe(1)
})

test("different capacities and caller flexibility retain their independent contributions", () => {
  const items = [box(10), glue(0, 0, 2), glue(0, 0, 3), penalty(-10000)]
  const flex = {
    stretch: new Float64Array(items.length + 1),
    shrink: Float64Array.from([0, 4, 8, 12, 12]),
  }
  for (const [geometry, expected] of [
    [undefined, 5],
    [flex, 17],
  ] as const) {
    const result = breakParagraphOnce(items, 10, {
      tolerance: 0,
      flex: geometry,
    })
    expect(result.ok && result.lines[0]?.shrink).toBe(expected)
  }
})

test("equal space capacity snapshots do not retain caller geometry or source objects", () => {
  const space = {
    kind: "glue" as const,
    width: 0,
    stretch: 0,
    shrink: 5 / 3,
    source: { start: 1, end: 2 },
  }
  const items = [box(10), space, penalty(-10000)]
  const prepared = prepareParagraph(items)
  const before = prepared.breakParagraphOnce(10, { tolerance: 0 })
  space.shrink = 99
  space.source.end = 1
  items.length = 0
  expect(prepared.breakParagraphOnce(10, { tolerance: 0 })).toEqual(before)
  expect(before.ok && before.lines[0]?.shrink).toBe(5 / 3)
  expect(before.ok && before.lines[0]?.spaceCount).toBe(1)
})

test("nonfinite capacities cannot be hidden by the equal-space representation", () => {
  for (const unit of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]) {
    expect(breakParagraphOnce(segment(unit, 1), 10, { tolerance: 0 }).ok).toBe(
      false,
    )
  }
})

test("equal fractional capacities preserve a later feasible path during pruning", () => {
  const items = [
    ...segment(5 / 3, 7),
    box(15),
    penalty(0),
    glue(0, 0, 5 / 3),
    glue(0, 0, 5 / 3),
    glue(0, 0, 5 / 3),
    penalty(-10000),
  ]
  const result = breakParagraphOnce(items, 10, { tolerance: 100 })
  expect(result.ok && result.lines.map((line) => line.shrink)).toEqual([
    11.666666666666668,
    5,
  ])
  expect(result.ok && result.lines.map((line) => line.adjustmentRatio)).toEqual(
    [0, -1],
  )
})
