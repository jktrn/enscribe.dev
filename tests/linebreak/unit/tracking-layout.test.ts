import { describe, expect, test } from "bun:test"
import type { Line } from "@linebreak/layout/breaker"
import type { LineFit } from "@linebreak/layout/expansion"
import { box, glue, type Item } from "@linebreak/layout/items"
import { buildTracking, trackLines } from "@linebreak/layout/tracking"

const WORD = 100
const SPACE_STRETCH = 5
const SPACE_SHRINK = 3
const BUDGET = 0.03

const ITEMS: Item[] = [
  box(WORD, { start: 0, end: 1 }),
  glue(10, SPACE_STRETCH, SPACE_SHRINK, { start: 1, end: 2 }),
  box(WORD, { start: 2, end: 3 }),
]

const NO_MARKS: ReadonlySet<number> = new Set()

const tracking = buildTracking(ITEMS, BUDGET, NO_MARKS)

/** 200px of glyphs at 3%: 6px of letterfit in either direction, which the DP
 * has already pooled into the line's own elasticity. */
const POOL = (tracking.stretch[3] as number) - (tracking.stretch[0] as number)

const lineOf = (overrides: Partial<Line> = {}): Line => ({
  start: 0,
  end: 3,
  sourceStart: 0,
  sourceEnd: 3,
  naturalWidth: 210,
  spaceCount: 1,
  stretch: SPACE_STRETCH + POOL,
  shrink: SPACE_SHRINK + POOL,
  adjustmentRatio: 0,
  breakKind: "space",
  hangStart: 0,
  hangEnd: 0,
  ...overrides,
})

const trackOne = (
  target: number,
  overrides: Partial<Line> = {},
  fits: readonly LineFit[] | null = null,
) => trackLines([lineOf(overrides)], target, tracking, fits)[0] as LineTrack

type LineTrack = { gain: number; shrink: number }

describe("what the letterfit is worth to a line", () => {
  test("the budget is three per cent of the line's own glyphs", () => {
    expect(POOL).toBeCloseTo(2 * WORD * BUDGET, 9)
  })

  test("a short line opens by its share of the pooled ratio", () => {
    const track = trackOne(215)

    expect(track.gain).toBeCloseTo((5 / (SPACE_STRETCH + POOL)) * POOL, 9)
  })

  test("a long line closes by its share of the pooled ratio", () => {
    const track = trackOne(205)

    expect(track.gain).toBeCloseTo(-(5 / (SPACE_SHRINK + POOL)) * POOL, 9)
  })

  test("a line the ratio would drive past the budget saturates there", () => {
    expect(trackOne(400).gain).toBeCloseTo(POOL, 9)
    expect(trackOne(100).gain).toBeCloseTo(-POOL, 9)
  })

  test("a line the breaker set exactly is left alone", () => {
    expect(trackOne(210).gain).toBe(0)
  })

  test("the spaces keep their own shrink and are charged no more", () => {
    expect(trackOne(205).shrink).toBeCloseTo(SPACE_SHRINK, 9)
  })

  test("glyphs that earned nothing cannot be letterspaced", () => {
    const barren = buildTracking(ITEMS, BUDGET, new Set([0, 2]))

    expect(trackLines([lineOf()], 215, barren, null)[0]?.gain).toBe(0)
  })

  test("each direction spends the budget booked for that direction", () => {
    const lopsided = {
      stretch: Float64Array.from([0, 0, 0, POOL]),
      shrink: Float64Array.from([0, 0, 0, 2 * POOL]),
    }
    const line = lineOf({ shrink: SPACE_SHRINK + 2 * POOL })

    expect(trackLines([line], 205, lopsided, null)[0]?.gain).toBeCloseTo(
      -(5 / (SPACE_SHRINK + 2 * POOL)) * 2 * POOL,
      9,
    )
  })
})

describe("endings, whose slack is free", () => {
  test("a paragraph ending is never letterspaced open", () => {
    const track = trackOne(300, {
      stretch: 100_000 + POOL,
      breakKind: "end",
    })

    expect(track.gain).toBe(0)
  })

  test("a line ending at a forced break is never letterspaced open", () => {
    const track = trackOne(300, {
      stretch: 100_000 + POOL,
      breakKind: "forced",
    })

    expect(track.gain).toBe(0)
  })

  test("an ending too long for the measure still closes", () => {
    const track = trackOne(205, {
      stretch: 100_000 + POOL,
      breakKind: "end",
    })

    expect(track.gain).toBeCloseTo(-(5 / (SPACE_SHRINK + POOL)) * POOL, 9)
  })
})

describe("letterfit composing with the width axis on one line", () => {
  const fitOf = (overrides: Partial<LineFit> = {}): LineFit => ({
    pct: 101,
    gain: 2,
    stretch: SPACE_STRETCH + POOL,
    shrink: SPACE_SHRINK + POOL,
    ...overrides,
  })

  test("the glyphs' quantized gain is spent before the letterfit's share", () => {
    const track = trackOne(215, {}, [fitOf()])

    expect(track.gain).toBeCloseTo((3 / (SPACE_STRETCH + POOL)) * POOL, 9)
  })

  test("the ratio is taken against the continuous pool the rungs left", () => {
    const track = trackOne(215, { stretch: SPACE_STRETCH + POOL + 4 }, [
      fitOf({ stretch: SPACE_STRETCH + POOL }),
    ])

    expect(track.gain).toBeCloseTo((3 / (SPACE_STRETCH + POOL)) * POOL, 9)
  })

  test("the spaces are charged neither the axis' share nor the letterfit's", () => {
    const track = trackOne(205, {}, [fitOf({ gain: -1 })])

    expect(track.shrink).toBeCloseTo(SPACE_SHRINK, 9)
  })

  test("a line the axis alone overshot is pulled back by the letterfit", () => {
    const track = trackOne(215, {}, [fitOf({ gain: 7 })])

    expect(track.gain).toBeLessThan(0)
    expect(track.gain).toBeCloseTo(-(2 / (SPACE_SHRINK + POOL)) * POOL, 9)
  })
})
