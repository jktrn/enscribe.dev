import { expect, test } from "bun:test"
import {
  box,
  glue,
  penalty,
  paragraphEnd,
  breakParagraphOnce,
  prepareParagraph,
} from "@linebreak/layout"
import { exhaustiveLayout } from "./support/exhaustive-layout"

test("an overflowing pool cannot displace the best path with finite line geometry", () => {
  for (const [stretch, shrink, width] of [
    [Number.MAX_VALUE, Number.MAX_VALUE, 6],
    [Number.MAX_VALUE, 0, 9],
    [Number.MAX_VALUE, 0, 12],
    [1, Number.MAX_VALUE, 9],
  ] as const) {
    const items = [
      box(3),
      glue(0, stretch, shrink),
      box(3),
      glue(0, stretch, shrink),
      box(3),
      penalty(-10000),
    ]
    const options = { tolerance: 10000 }
    const oracle = exhaustiveLayout({ items, width, options })
    if (!oracle) throw new Error("Expected a finite oracle path.")
    for (const result of [
      breakParagraphOnce(items, width, options),
      prepareParagraph(items).breakParagraphOnce(width, options),
    ]) {
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.lines.map((line) => line.end)).toEqual(oracle.breaks)
      expect(result.demerits).toBe(oracle.cost)
      for (const line of result.lines) {
        expect(Number.isFinite(line.stretch)).toBe(true)
        expect(Number.isFinite(line.shrink)).toBe(true)
      }
    }
  }
})

test("an overflowing ratio cannot displace a complete path with finite adjustment", () => {
  const items = [
    box(0.25),
    glue(0, Number.MIN_VALUE, 0),
    box(0.25),
    penalty(-9999),
    box(0.75),
    ...paragraphEnd(),
  ]
  const options = { tolerance: 10000 }
  const oracle = exhaustiveLayout({ items, width: 1, options })
  if (!oracle) throw new Error("Expected a finite oracle route.")
  expect(oracle?.breaks).toEqual([1, 7])
  expect(oracle?.cost).toBe(100020100)
  for (const result of [
    breakParagraphOnce(items, 1, options),
    prepareParagraph(items).breakParagraphOnce(1, options),
  ]) {
    expect(result.ok).toBe(true)
    if (!result.ok) continue
    expect(result.lines.map((line) => line.end)).toEqual(oracle.breaks)
    expect(result.demerits).toBe(oracle.cost)
  }
})

test("maximum finite ratios still fit the saturated-badness contract", () => {
  const result = breakParagraphOnce(
    [box(0), glue(0, 1, 0), box(0), penalty(-10000)],
    Number.MAX_VALUE,
    { tolerance: 10000 },
  )
  expect(result.ok && result.lines[0]?.adjustmentRatio).toBe(Number.MAX_VALUE)
})

test("overflowing accumulated costs cannot displace a finite complete route", () => {
  const items = [box(9), glue(0, 2, 3), ...paragraphEnd()]
  const options = {
    tolerance: 10000,
    policy: { adjDemerits: -Number.MAX_VALUE },
  }
  const oracle = exhaustiveLayout({ items, width: 10, options })
  if (!oracle) throw new Error("Expected a finite-cost oracle route.")
  expect(oracle.breaks).toEqual([4])
  for (const result of [
    breakParagraphOnce(items, 10, options),
    prepareParagraph(items).breakParagraphOnce(10, options),
  ]) {
    expect(result.ok).toBe(true)
    if (!result.ok) continue
    expect(result.lines.map((line) => line.end)).toEqual(oracle.breaks)
    expect(result.demerits).toBe(oracle.cost)
  }
})
