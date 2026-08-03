import { describe, expect, test } from "bun:test"
import type { Line } from "@linebreak/layout/breaker"
import { buildExpansion, fitLines } from "@linebreak/layout/expansion"
import { box, glue, type Item } from "@linebreak/layout/items"
import { AFFINE } from "./support/measure"

const WORD = 100
const SPACE_STRETCH = 5
const SPACE_SHRINK = 3

const ITEMS: Item[] = [
  box(WORD, { start: 0, end: 1 }),
  glue(10, SPACE_STRETCH, SPACE_SHRINK, { start: 1, end: 2 }),
  box(WORD, { start: 2, end: 3 }),
]

const NO_MARKS: ReadonlySet<number> = new Set()

const expansion = buildExpansion(ITEMS, AFFINE, NO_MARKS)

const POOL = (expansion.stretch[3] as number) - (expansion.stretch[0] as number)

const ENDPOINT = 0.02

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

const fitOne = (target: number, overrides: Partial<Line> = {}) =>
  fitLines([lineOf(overrides)], target, expansion, AFFINE)[0] as {
    pct: number
    gain: number
    shrink: number
  }

describe("a line the breaker left short", () => {
  test("the pool the DP handed the line is the endpoint of its own glyphs", () => {
    expect(POOL).toBeCloseTo(2 * WORD * ENDPOINT, 9)
    expect(lineOf().stretch).toBeCloseTo(SPACE_STRETCH + POOL, 9)
    expect(lineOf().shrink).toBeCloseTo(SPACE_SHRINK + POOL, 9)
  })

  test("the glyphs take their pooled share, quantized down", () => {
    const fit = fitOne(215)

    expect(fit.pct).toBe(101)
    expect(fit.gain).toBeCloseTo(POOL / 2, 9)
  })

  test("what the glyphs take never exceeds the shortfall", () => {
    for (const target of [210.5, 211, 212, 214, 218, 226, 260]) {
      const fit = fitOne(target)

      expect(fit.gain).toBeLessThanOrEqual(target - 210)
      expect(fit.gain).toBeLessThanOrEqual(POOL)
    }
  })

  test("a shortfall too small for the first rung leaves the line alone", () => {
    expect(fitOne(210.5).pct).toBe(100)
  })

  test("a paragraph ending spends nothing, its slack being free", () => {
    const fit = fitOne(300, { stretch: 100_000 + POOL, breakKind: "end" })

    expect(fit.pct).toBe(100)
    expect(fit.gain).toBe(0)
  })

  test("glyphs that earned nothing cannot be stretched", () => {
    const barren = buildExpansion(ITEMS, AFFINE, new Set([0, 2]))
    const fit = fitLines([lineOf()], 215, barren, AFFINE)[0]

    expect(fit?.pct).toBe(100)
  })
})

describe("a line the breaker left long", () => {
  test("condensation rounds up, never down", () => {
    const fit = fitOne(205)

    expect(fit.pct).toBe(98)
    expect(fit.gain).toBeCloseTo(-POOL, 9)
  })

  test("a small excess still takes the gentlest sufficient rung", () => {
    const fit = fitOne(209.5)

    expect(fit.pct).toBe(99)
    expect(fit.gain).toBeCloseTo(-POOL / 2, 9)
  })

  test("the rendered line is never wider than the unquantized model", () => {
    for (const target of [209.9, 209, 208, 207, 206, 204, 200]) {
      const fit = fitOne(target)
      const excess = 210 - target
      const want = Math.min(excess / (SPACE_SHRINK + POOL), 1) * POOL

      expect(-fit.gain).toBeGreaterThanOrEqual(want - 1e-12)
    }
  })

  test("the glue is charged its own share and no more", () => {
    const fit = fitOne(205)

    expect(fit.shrink).toBe(SPACE_SHRINK)
  })
})

describe("an axis that only condenses, which is what real fonts give", () => {
  const CONDENSE_ONLY = {
    steps: [
      { pct: 96, ratio: 0.9775 },
      { pct: 98, ratio: 0.9944 },
      { pct: 100, ratio: 1 },
    ],
  }

  const oneSided = buildExpansion(ITEMS, CONDENSE_ONLY, NO_MARKS)

  const SHRINK_POOL =
    (oneSided.shrink[3] as number) - (oneSided.shrink[0] as number)

  const fitOneSided = (target: number, natural: number) =>
    fitLines(
      [lineOf({ naturalWidth: natural, shrink: SPACE_SHRINK + SHRINK_POOL })],
      target,
      oneSided,
      CONDENSE_ONLY,
    )[0] as { pct: number; gain: number; stretch: number; shrink: number }

  test("nothing is budgeted on the side the font cannot move", () => {
    expect(oneSided.stretch[3]).toBe(0)
  })

  test("a short line is left alone rather than set at a rung it cannot honour", () => {
    const fit = fitOneSided(230, 210)

    expect(fit.pct).toBe(100)
    expect(fit.gain).toBe(0)
  })

  test("a long line still spends the side the font does move", () => {
    const fit = fitOneSided(200, 210)

    expect(fit.pct).toBe(96)
    expect(fit.gain).toBeCloseTo(-SHRINK_POOL, 9)
  })
})
