import { expect, test } from "bun:test"
import {
  box,
  glue,
  penalty,
  discretionary,
  paragraphEnd,
  breakParagraphOnce,
  prepareParagraph,
  type Item,
} from "@linebreak/layout"
import { buildExpansion, fitLines } from "@linebreak/layout/expansion"
import { buildTracking, trackLines } from "@linebreak/layout/tracking"
import { flexBetween, pooledFlex } from "@linebreak/layout/flex"
import { exhaustiveLayout } from "./support/exhaustive-layout"

const grouped = (): Item[] => [
  box(50),
  box(10),
  penalty(0, { width: -6, continuationWidth: 6 }),
  penalty(0),
  glue(10, 5, 3),
  box(40),
  ...paragraphEnd(),
]
const options = { tolerance: 100 }
const widths = (items: readonly Item[], target: number) => {
  const result = breakParagraphOnce(items, target, options)
  if (!result.ok) throw new Error("Expected a finite layout.")
  return result.lines.map((line) => line.naturalWidth)
}

test("only penalty metadata can supply a fixed continuation after a chosen glue", () => {
  // Structural Item inputs can carry caller fields that belong to another
  // item kind. The discriminant still defines their geometric meaning.
  const annotatedGlue = { ...glue(0, 10, 0), continuationWidth: 123 }
  const items = [box(10), annotatedGlue, box(10), ...paragraphEnd()]
  const plain = [box(10), glue(0, 10, 0), box(10), ...paragraphEnd()]
  const expected = breakParagraphOnce(plain, 10, { tolerance: 0 })
  expect(expected.ok && expected.lines.map((line) => line.naturalWidth)).toEqual([
    10,
    10,
  ])
  expect(breakParagraphOnce(items, 10, { tolerance: 0 })).toEqual(expected)
  expect(
    prepareParagraph(items).breakParagraphOnce(10, { tolerance: 0 }),
  ).toEqual(expected)
})

test("fixed continuation adjustments preserve both optional breaks and unbroken glue", () => {
  const items = grouped()
  expect(widths(items, 54)).toEqual([54, 46])
  expect(widths(items, 60)).toEqual([60, 40])
  expect(widths(items, 110)).toEqual([110])
  for (const target of [54, 60, 110]) {
    const oracle = exhaustiveLayout({ items, width: target, options })
    const result = breakParagraphOnce(items, target, options)
    expect(result.ok && oracle !== null).toBe(true)
    if (result.ok && oracle) expect(result.demerits).toBe(oracle.cost)
  }
  const selected = breakParagraphOnce(items, 54, options)
  expect(selected.ok && selected.lines.map((line) => line.spaceCount)).toEqual([
    0, 0,
  ])
  if (selected.ok) {
    expect(selected.lines[1]?.shrink).toBe(0)
    expect(selected.lines[1]?.stretch).toBe(100000)
  }
})

test("continuation adjustments skip consecutive optional endpoints without phantom lines", () => {
  const items = [
    box(10),
    penalty(0, { continuationWidth: 6 }),
    penalty(0, { continuationWidth: 100 }),
    glue(7, 3, 2),
    box(4),
    ...paragraphEnd(),
  ]
  expect(widths(items, 10)).toEqual([10, 10])
  expect(
    widths(
      [
        penalty(0, { continuationWidth: 6 }),
        glue(7, 3, 2),
        box(10),
        ...paragraphEnd(),
      ],
      10,
    ),
  ).toEqual([10])
  expect(
    widths(
      [
        box(10),
        penalty(0, { continuationWidth: 6 }),
        penalty(0),
        ...paragraphEnd(),
      ],
      10,
    ),
  ).toEqual([10])
})

test("forced endpoints apply only the selected continuation and preserve mandatory empty lines", () => {
  expect(
    widths(
      [
        box(10),
        penalty(-10000, { continuationWidth: 6 }),
        glue(7, 3, 2),
        box(4),
        penalty(-10000, { continuationWidth: 99 }),
      ],
      10,
    ),
  ).toEqual([10, 10])
  const result = breakParagraphOnce(
    [
      penalty(-10000, { continuationWidth: 6 }),
      penalty(-10000, { continuationWidth: 10 }),
      penalty(-10000),
    ],
    10,
    { tolerance: 10000 },
  )
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    0, 6, 10,
  ])
})

test("a printed discretionary post fragment retains its ordinary following material", () => {
  const items = grouped()
  items[2] = discretionary({ preWidth: -6, postWidth: 6, breakOffset: 0 })
  expect(widths(items, 54)).toEqual([54, 56])
})

test("signed continuation adjustments retain exact cancellation and overflowing prefix recovery", () => {
  for (const adjustment of [1e16, -1e16]) {
    const items = [
      box(1),
      penalty(-10000, { continuationWidth: adjustment }),
      box(-adjustment),
      box(1),
      penalty(-10000),
    ]
    expect(widths(items, 1)).toEqual([1, 1])
    expect(exhaustiveLayout({ items, width: 1, options })?.cost).toBe(200)
  }
  const max = Number.MAX_VALUE
  const items = [
    box(max),
    penalty(-10000, { continuationWidth: max }),
    box(max),
    box(-max),
    penalty(-10000),
  ]
  for (const result of [
    breakParagraphOnce(items, max, options),
    prepareParagraph(items).breakParagraphOnce(max, options),
  ]) {
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      max,
      max,
    ])
  }
  expect(
    widths(
      [
        box(1),
        penalty(-10000, { continuationWidth: Number.MIN_VALUE }),
        box(0),
        ...paragraphEnd(),
      ],
      1,
    ),
  ).toEqual([1, Number.MIN_VALUE])
})

test("nonfinite selected credits are infeasible while ignored credits have no effect", () => {
  for (const continuationWidth of [Number.NaN, Infinity, -Infinity]) {
    const selected = [
      box(10),
      penalty(-10000, { continuationWidth }),
      box(10),
      penalty(-10000),
    ]
    expect(breakParagraphOnce(selected, 10, options).ok).toBe(false)
    expect(
      widths(
        [box(5), penalty(0, { continuationWidth }), box(5), penalty(-10000)],
        10,
      ),
    ).toEqual([10])
  }
})

test("prepared paragraphs snapshot the optional credit and factory defaults keep their old shape", () => {
  expect(Object.hasOwn(penalty(0), "continuationWidth")).toBe(false)
  expect(
    Object.hasOwn(
      penalty(0, { continuationWidth: undefined }),
      "continuationWidth",
    ),
  ).toBe(false)
  expect(penalty(0, { continuationWidth: 0 }).continuationWidth).toBe(0)
  const credit = { ...penalty(0, { width: -6, continuationWidth: 6 }) }
  const items = grouped()
  items[2] = credit
  const prepared = prepareParagraph(items)
  const before = prepared.breakParagraphOnce(54, options)
  credit.continuationWidth = 7
  expect(prepared.breakParagraphOnce(54, options)).toEqual(before)
  expect(widths(items, 54)).toEqual([54, 47])
})

test("fixed grouped decorations receive no expansion or tracking credit", () => {
  const items = grouped()
  const uncredited = new Set([1])
  const scale = {
    steps: [
      { pct: 87.5, ratio: 0.875 },
      { pct: 100, ratio: 1 },
      { pct: 112.5, ratio: 1.125 },
    ],
  }
  const expansion = buildExpansion(items, scale, uncredited)
  const tracking = buildTracking(items, 0.125, uncredited)
  const result = breakParagraphOnce(items, 54, {
    ...options,
    flex: pooledFlex(expansion, tracking),
  })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.lines.map((line) => line.naturalWidth)).toEqual([54, 46])
  expect(
    result.lines.map((line) => flexBetween(expansion, line.start, line.end)),
  ).toEqual([
    { stretch: 6.25, shrink: 6.25 },
    { stretch: 5, shrink: 5 },
  ])
  const first = result.lines[0]!
  const fits = fitLines([first], 66.5, expansion, scale)
  expect(fits[0]?.gain).toBe(6.25)
  expect(trackLines([first], 66.5, tracking, fits)[0]?.gain).toBe(6.25)
})

test("the independent oracle includes coincident endpoints with fixed continuation geometry", () => {
  const items = [
    box(6),
    penalty(-20, { continuationWidth: 6 }),
    discretionary({ noBreakWidth: 100, breakOffset: 0 }),
    box(6),
    penalty(-10000),
  ]
  const options = { tolerance: 0 }
  const oracle = exhaustiveLayout({ items, width: 6, options })
  const result = breakParagraphOnce(items, 6, options)
  expect(oracle?.cost).toBe(-100)
  expect(oracle?.breaks).toEqual([1, 2, 4])
  expect(result.ok && result.demerits).toBe(-100)
})

test("mixed signed endpoint and continuation adjustments match independent complete enumeration", () => {
  let seed = 1981
  const random = (count: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed % count
  }
  for (let sample = 0; sample < 500; sample += 1) {
    const items: Item[] = []
    for (let index = 0; index < 6; index += 1) {
      items.push(box(1 + random(16)))
      if (index < 5)
        items.push(
          random(2)
            ? penalty(random(31) - 15, {
                width: random(13) - 6,
                continuationWidth: random(13) - 6,
              })
            : glue(random(5), 1 + random(5), 1 + random(3)),
        )
    }
    items.push(...paragraphEnd())
    const target = 6 + random(22)
    const oracle = exhaustiveLayout({
      items,
      width: target,
      options: { tolerance: 800 },
    })
    const result = breakParagraphOnce(items, target, { tolerance: 800 })
    expect(result.ok).toBe(oracle !== null)
    if (result.ok && oracle) expect(result.demerits).toBe(oracle.cost)
  }
})
