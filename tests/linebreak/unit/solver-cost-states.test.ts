import { expect, test } from "bun:test"
import {
  box,
  discretionary,
  glue,
  penalty,
  paragraphEnd,
  breakParagraphOnce,
  prepareParagraph,
  type Item,
} from "@linebreak/layout"
import { geometryFor, searchFor } from "@linebreak/layout/breaker/problem"
import { exhaustiveLayout } from "./support/exhaustive-layout"

test("distinct finite costs survive when a cheaper prefix would later overflow", () => {
  const items = [
    box(7),
    glue(1, 4, 3),
    box(10),
    penalty(-1, { flagged: true }),
    box(3),
    glue(2, 4, 3),
    box(2),
    penalty(-8, { flagged: true }),
    box(11),
    glue(1, 4, 1),
    box(2),
    ...paragraphEnd(),
  ]
  const options = {
    tolerance: 10000,
    policy: {
      adjDemerits: -Number.MAX_VALUE,
      doubleHyphenDemerits: Number.MAX_VALUE,
      finalHyphenDemerits: -Number.MAX_VALUE,
    },
  }
  const oracle = exhaustiveLayout({ items, width: 26, options })
  expect(oracle?.cost).toBe(-Number.MAX_VALUE)
  for (const result of [
    breakParagraphOnce(items, 26, options),
    prepareParagraph(items).breakParagraphOnce(26, options),
  ]) {
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.demerits).toBe(-Number.MAX_VALUE)
  }
})

test("extreme signed policies match independent complete-path enumeration", () => {
  let seed = 1981
  const random = (count: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed % count
  }
  const values = [0, Number.MAX_VALUE, -Number.MAX_VALUE]
  for (let sample = 0; sample < 500; sample += 1) {
    const items: Item[] = []
    for (let index = 0; index < 6; index += 1) {
      items.push(box(1 + random(12)))
      if (index < 5)
        items.push(
          random(2)
            ? glue(random(3), 1 + random(8), 1 + random(3))
            : penalty(random(21) - 10, { flagged: true }),
        )
    }
    items.push(...paragraphEnd())
    const width = 8 + random(22)
    const options = {
      tolerance: 10000,
      policy: {
        adjDemerits: values[random(3)]!,
        doubleHyphenDemerits: values[random(3)]!,
        finalHyphenDemerits: values[random(3)]!,
      },
    }
    const oracle = exhaustiveLayout({ items, width, options })
    const result = breakParagraphOnce(items, width, options)
    expect(result.ok).toBe(oracle !== null)
    if (result.ok && oracle) expect(result.demerits).toBe(oracle.cost)
  }
})

test("ordinary finite policies certify compressed states while uncertain policies retain alternatives", () => {
  const geometry = geometryFor([box(9), glue(0, 2, 3), ...paragraphEnd()], {})
  const options = { tolerance: 10000 }
  expect(searchFor(geometry, 10, options).demeritBound).not.toBeNull()
  expect(
    searchFor(geometry, 10, { ...options, policy: { linePenalty: Number.NaN } })
      .demeritBound,
  ).toBeNull()
  expect(
    searchFor(geometry, 10, { ...options, lastLineMinWidth: Number.MAX_VALUE })
      .demeritBound,
  ).toBeNull()
  const invalidPenalty = geometryFor(
    [box(9), penalty(Number.NaN), ...paragraphEnd()],
    {},
  )
  expect(searchFor(invalidPenalty, 10, options).demeritBound).toBeNull()
  expect(
    breakParagraphOnce(
      [box(9), penalty(Number.NaN), ...paragraphEnd()],
      10,
      options,
    ).ok,
  ).toBe(true)
})

test("fitness pruning retains a dearer prefix when future binary64 rounding reverses its cost", () => {
  const items = [
    box(10),
    penalty(21.60000000021041),
    box(5),
    penalty(10000),
    glue(0, 0, 10 / 0.6),
    box(5),
    discretionary({
      noBreakWidth: 1000,
      penalty: -21.599999999824085,
      hyphen: true,
      breakOffset: 0,
    }),
    box(9),
    penalty(10000),
    glue(0, 2, 0),
    penalty(-10000, { flagged: true }),
  ]
  const options = {
    tolerance: 100,
    policy: {
      linePenalty: 0,
      adjDemerits: 0.6 * 2 ** -26,
      doubleHyphenDemerits: 99999843.75,
    },
  }
  const oracle = exhaustiveLayout({ items, width: 10, options })
  expect(oracle?.cost).toBe(100000000.00000001)
  expect(oracle?.breaks).toEqual([1, 6, 10])
  if (!oracle) throw new Error("Expected a finite oracle path.")
  for (const result of [
    breakParagraphOnce(items, 10, options),
    prepareParagraph(items).breakParagraphOnce(10, options),
  ]) {
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.demerits).toBe(oracle.cost)
      expect(result.lines.map((line) => line.end)).toEqual(oracle.breaks)
    }
  }
})

test("both hyphen directions participate in the finite-cost certificate", () => {
  const geometry = geometryFor([box(1), penalty(-10000)], {})
  for (const policy of [
    {
      adjDemerits: 0,
      doubleHyphenDemerits: Number.MAX_VALUE,
      finalHyphenDemerits: 0,
    },
    {
      adjDemerits: 0,
      doubleHyphenDemerits: 0,
      finalHyphenDemerits: Number.MAX_VALUE,
    },
  ])
    expect(
      searchFor(geometry, 1, { tolerance: 0, policy }).demeritBound,
    ).toBeNull()
  expect(
    searchFor(geometry, 1, {
      tolerance: 0,
      policy: {
        adjDemerits: Number.MAX_VALUE / 4,
        doubleHyphenDemerits: 0,
        finalHyphenDemerits: 0,
      },
    }).demeritBound,
  ).toBe(Number.MAX_VALUE / 4)
})

test("near-tied fractional rewards match complete enumeration across both fitness-charge signs", () => {
  let seed = 1981
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  for (let sample = 0; sample < 800; sample += 1) {
    const items = [
      box(10),
      penalty(21.6 + (random() - 0.5) * 2 ** -28),
      box(5),
      penalty(10000),
      glue(0, 0, 10 / 0.6),
      box(5),
      discretionary({
        noBreakWidth: 1000,
        penalty: -21.6 + (random() - 0.5) * 2 ** -28,
        hyphen: true,
        breakOffset: 0,
      }),
      box(9),
      penalty(10000),
      glue(0, 2, 0),
      penalty(-10000, { flagged: true }),
    ]
    const options = {
      tolerance: 100,
      policy: {
        linePenalty: 0,
        adjDemerits: (random() - 0.5) * 2 ** -24,
        doubleHyphenDemerits: (sample % 2 ? 1 : -1) * 99999843.75,
      },
    }
    const oracle = exhaustiveLayout({ items, width: 10, options })
    const result = breakParagraphOnce(items, 10, options)
    expect(result.ok).toBe(oracle !== null)
    if (result.ok && oracle) expect(result.demerits).toBe(oracle.cost)
  }
})

test.each(["continuous", "integer"] as const)(
  "%s keeps the first equal-cost route when extreme policy charges require alternatives",
  (scoring) => {
    const items = [
      box(10), penalty(0), box(0), penalty(0), box(10), penalty(-10000),
    ]
    const options = {
      tolerance: 0,
      policy: { scoring, linePenalty: 0, adjDemerits: Number.MAX_VALUE },
    }
    for (const result of [
      breakParagraphOnce(items, 10, options),
      prepareParagraph(items).breakParagraphOnce(10, options),
    ]) {
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.demerits).toBe(0)
      expect(result.lines.map(({ end }) => end)).toEqual([1, 5])
      expect(result.lines.map(({ naturalWidth }) => naturalWidth)).toEqual([10, 10])
    }
  },
)
