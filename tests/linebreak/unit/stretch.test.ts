import { describe, expect, test } from "bun:test"
import {
  calibrateStretch,
  narrowestRatio,
  type StretchProbe,
  widestRatio,
} from "@linebreak/text/stretch"

const BASE = 543

const tableProbe = (ratios: Readonly<Record<number, number>>): StretchProbe => {
  return (pct) => BASE * (ratios[pct] ?? 1)
}

const affine: StretchProbe = (pct) => (BASE * pct) / 100

const pctsOf = (scale: { steps: readonly { pct: number }[] } | null) =>
  scale?.steps.map((step) => step.pct) ?? null

const PLEX_GEOMETRIC_PRECISION = {
  99: 0.996448,
  98: 0.992371,
  97: 0.988353,
  96: 0.984305,
  95: 0.980227,
  94: 0.976119,
}

const PLEX_HINTED_TO_WHOLE_PIXELS = {
  99: 1,
  98: 0.994475,
  97: 0.994475,
  96: 0.98895,
  95: 0.98895,
  94: 0.983425,
}

const PLEX_COARSE = {
  99: 1,
  98: 0.9944029850746269,
  97: 0.9757462686567164,
  96: 0.9757462686567164,
}

describe("a font with no width dimension", () => {
  test("a flat response calibrates to nothing", () => {
    expect(calibrateStretch(0.02, tableProbe({}))).toBe(null)
  })

  test("an unmeasurable baseline calibrates to nothing", () => {
    expect(calibrateStretch(0.02, () => 0)).toBe(null)
  })
})

describe("a design axis", () => {
  test("an affine font stops as soon as the budget is met", () => {
    const scale = calibrateStretch(0.02, affine)

    expect(pctsOf(scale)).toEqual([98, 99, 100, 101, 102])
    expect(narrowestRatio(scale as never)).toBeCloseTo(0.98, 12)
    expect(widestRatio(scale as never)).toBeCloseTo(1.02, 12)
  })

  test("a smaller budget stops sooner", () => {
    expect(pctsOf(calibrateStretch(0.011, affine))).toEqual([99, 100, 101])
  })

  test("a budget no rung fits inside calibrates to nothing", () => {
    expect(calibrateStretch(0.009, affine)).toBe(null)
  })

  test("a near-linear axis with an inert stretch side comes back one-sided", () => {
    const scale = calibrateStretch(0.02, tableProbe(PLEX_GEOMETRIC_PRECISION))

    expect(pctsOf(scale)).toEqual([96, 97, 98, 99, 100])
    expect(widestRatio(scale as never)).toBe(1)
    expect(narrowestRatio(scale as never)).toBeCloseTo(0.984305, 12)
  })

  test("a rung that lands past the budget is left off the table", () => {
    const scale = calibrateStretch(0.02, tableProbe(PLEX_COARSE))

    expect(pctsOf(scale)).toEqual([98, 100])
    expect(narrowestRatio(scale as never)).toBeCloseTo(0.9944029850746269, 12)
  })

  test("a staircase response emits only the rungs the font can honour", () => {
    const scale = calibrateStretch(
      0.02,
      tableProbe(PLEX_HINTED_TO_WHOLE_PIXELS),
    )

    expect(pctsOf(scale)).toEqual([94, 96, 98, 100])
  })

  test("no table reaches further than six points from 100", () => {
    const gentle: StretchProbe = (pct) => BASE * (1 + (pct - 100) * 0.0005)
    const scale = calibrateStretch(0.02, gentle)

    expect(pctsOf(scale)).toEqual([96, 97, 98, 99, 100, 101, 102, 103, 104])
  })
})

describe("what is not a design axis", () => {
  test("a face swap is rejected, not calibrated", () => {
    const swap = tableProbe({ 99: 1, 98: 0.8895, 97: 0.8895, 96: 0.8895 })

    expect(calibrateStretch(0.02, swap)).toBe(null)
  })

  test("a response that reverses direction is rejected", () => {
    const wobble = tableProbe({ 99: 0.996, 98: 0.999, 97: 0.99 })

    expect(calibrateStretch(0.02, wobble)).toBe(null)
  })

  test("a wider-when-condensed response is rejected", () => {
    expect(calibrateStretch(0.02, tableProbe({ 99: 1.004 }))).toBe(null)
  })
})
