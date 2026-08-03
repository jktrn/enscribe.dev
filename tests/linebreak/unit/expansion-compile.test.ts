import { describe, expect, test } from "bun:test"
import type { ExtractedBlock, InlineRun } from "@linebreak/dom/extract"
import { compileBlock } from "@linebreak/layout/compile"
import { defaultGlue, texDefaults } from "@linebreak/layout/policy"
import type { StretchScale } from "@linebreak/text/stretch"
import {
  AFFINE,
  CHARACTER,
  compileShape,
  metrics,
  SHY,
} from "./support/measure"

const NARROW_ONLY: StretchScale = {
  steps: [
    { pct: 96, ratio: 0.984 },
    { pct: 100, ratio: 1 },
  ],
}

const budgetOf = (
  texts: readonly string[],
  scaleFor: (run: InlineRun) => StretchScale | null,
  shape: { trailingEdge?: number; hyphenates?: boolean } = {},
) => {
  const compiled = compileShape(
    { texts, ...shape },
    { scaleFor, hyphenate: shape.hyphenates === true },
  )
  const { expansion } = compiled
  return {
    scale: compiled.scale,
    items: compiled.items,
    stretch: expansion?.stretch.at(-1) ?? null,
    shrink: expansion?.shrink.at(-1) ?? null,
  }
}

const always = (scale: StretchScale) => () => scale

describe("what earns a budget", () => {
  test("only boxes do, and at the calibrated endpoints", () => {
    const budget = budgetOf(["ab cd"], always(AFFINE))

    expect(budget.scale).toBe(AFFINE)
    expect(budget.stretch).toBeCloseTo(4 * CHARACTER * 0.02, 9)
    expect(budget.shrink).toBeCloseTo(4 * CHARACTER * 0.02, 9)
  })

  test("the two sides are independent", () => {
    const budget = budgetOf(["ab cd"], always(NARROW_ONLY))

    expect(budget.stretch).toBe(0)
    expect(budget.shrink).toBeCloseTo(4 * CHARACTER * 0.016, 9)
  })

  test("a materialized hyphen does not scale with the glyphs", () => {
    const plain = budgetOf(["abcdef"], always(AFFINE))
    const split = budgetOf([`abc${SHY}def`], always(AFFINE))

    expect(split.items.some((item) => item.kind === "discretionary")).toBe(true)
    expect(split.stretch).toBeCloseTo(plain.stretch as number, 9)
  })

  test("no calibration means no sidecar at all", () => {
    const compiled = compileShape({ texts: ["ab cd"] })

    expect(compiled.expansion).toBe(null)
    expect(compiled.scale).toBe(null)
  })

  test("a font with no width dimension earns nothing", () => {
    const budget = budgetOf(["ab cd"], () => null)

    expect(budget.stretch).toBe(null)
    expect(budget.scale).toBe(null)
  })
})

describe("width that is not glyph width", () => {
  test("a box that swallowed a wrapper edge is not credited", () => {
    const bare = budgetOf(["ab cd"], always(AFFINE))
    const edged = budgetOf(["ab cd"], always(AFFINE), { trailingEdge: 12 })

    expect(edged.stretch).toBeCloseTo(
      (bare.stretch as number) - 2 * CHARACTER * 0.02,
      9,
    )
  })

  test("an atom is not glyphs and earns nothing", () => {
    const runs: InlineRun[] = [
      {
        kind: "atom",
        text: "￼",
        start: 0,
        end: 1,
        wrappers: [],
        sourceElement: {} as Element,
      },
      {
        kind: "text",
        text: " ab",
        start: 1,
        end: 4,
        wrappers: [],
        sourceElement: {} as HTMLElement,
        hyphenates: false,
      },
    ]
    const block: ExtractedBlock = {
      text: "￼ ab",
      runs,
      breakRestrictions: [],
      wrappers: new Map(),
    }
    const compiled = compileBlock({
      block,
      metricsFor: () => metrics,
    baseFont: metrics.font,
      atomWidth: () => 40,
      locale: "en-US",
      policy: texDefaults,
      glue: defaultGlue,
      scaleFor: () => AFFINE,
    })

    expect(compiled.ok).toBe(true)
    if (!compiled.ok || !compiled.expansion) throw new Error("no sidecar")
    expect(compiled.expansion.stretch.at(-1)).toBeCloseTo(
      2 * CHARACTER * 0.02,
      9,
    )
  })
})

describe("more than one responsive font in one paragraph", () => {
  test("a run that does not respond still lets the rest expand", () => {
    const budget = budgetOf(["ab ", "cd"], (run) =>
      run.text === "cd" ? null : AFFINE,
    )

    expect(budget.scale).toBe(AFFINE)
    expect(budget.stretch).toBeCloseTo(2 * CHARACTER * 0.02, 9)
  })

  test("two different width axes decline the whole paragraph", () => {
    const budget = budgetOf(["ab ", "cd"], (run) =>
      run.text === "cd" ? NARROW_ONLY : AFFINE,
    )

    expect(budget.scale).toBe(null)
    expect(budget.stretch).toBe(null)
  })
})
