import { describe, expect, test } from "bun:test"
import type { ExtractedBlock, InlineRun } from "@linebreak/dom/extract"
import { compileBlock } from "@linebreak/layout/compile"
import { defaultGlue, texDefaults } from "@linebreak/layout/policy"
import { AFFINE, CHARACTER, compileShape, metrics, SHY } from "./support/measure"

const BUDGET = 0.03

const budgetOf = (
  texts: readonly string[],
  shape: { trailingEdge?: number; hyphenates?: boolean } = {},
) => {
  const compiled = compileShape(
    { texts, ...shape },
    { track: BUDGET, hyphenate: shape.hyphenates === true },
  )
  const { tracking } = compiled
  return {
    items: compiled.items,
    stretch: tracking?.stretch.at(-1) ?? null,
    shrink: tracking?.shrink.at(-1) ?? null,
  }
}

describe("what earns a letterfit budget", () => {
  test("only boxes do, and symmetrically", () => {
    const budget = budgetOf(["ab cd"])

    expect(budget.stretch).toBeCloseTo(4 * CHARACTER * BUDGET, 9)
    expect(budget.shrink).toBeCloseTo(4 * CHARACTER * BUDGET, 9)
  })

  test("a materialized hyphen is not letterspaced with the glyphs", () => {
    const plain = budgetOf(["abcdef"])
    const split = budgetOf([`abc${SHY}def`])

    expect(split.items.some((item) => item.kind === "discretionary")).toBe(true)
    expect(split.stretch).toBeCloseTo(plain.stretch as number, 9)
  })

  test("asking for nothing builds no sidecar at all", () => {
    const compiled = compileShape({ texts: ["ab cd"] })

    expect(compiled.tracking).toBe(null)
    expect(compiled.flex).toBe(null)
  })

  test("a box that swallowed a wrapper edge is not credited", () => {
    const bare = budgetOf(["ab cd"])
    const edged = budgetOf(["ab cd"], { trailingEdge: 12 })

    expect(edged.stretch).toBeCloseTo(
      (bare.stretch as number) - 2 * CHARACTER * BUDGET,
      9,
    )
  })

  test("an atom has no characters to letterspace and earns nothing", () => {
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
      track: BUDGET,
    })

    expect(compiled.ok).toBe(true)
    if (!compiled.ok || !compiled.tracking) throw new Error("no sidecar")
    expect(compiled.tracking.stretch.at(-1)).toBeCloseTo(
      2 * CHARACTER * BUDGET,
      9,
    )
  })
})

describe("what the DP is handed when both axes are on", () => {
  test("the letterfit alone reaches the DP as itself", () => {
    const compiled = compileShape({ texts: ["ab cd"] }, { track: BUDGET })

    expect(compiled.flex).toBe(compiled.tracking)
  })

  test("the width axis alone reaches the DP as itself", () => {
    const compiled = compileShape({ texts: ["ab cd"] }, { scaleFor: () => AFFINE })

    expect(compiled.flex).toBe(compiled.expansion)
  })

  test("together they reach it as one pooled sidecar", () => {
    const compiled = compileShape(
      { texts: ["ab cd"] },
      { track: BUDGET, scaleFor: () => AFFINE },
    )

    expect(compiled.flex).not.toBe(compiled.tracking)
    expect(compiled.flex).not.toBe(compiled.expansion)
    expect(compiled.flex?.stretch.at(-1)).toBeCloseTo(
      4 * CHARACTER * (BUDGET + 0.02),
      9,
    )
    expect(compiled.flex?.shrink.at(-1)).toBeCloseTo(
      4 * CHARACTER * (BUDGET + 0.02),
      9,
    )
  })

  test("a run with no width axis still earns its letterfit", () => {
    const compiled = compileShape(
      { texts: ["ab ", "cd"] },
      { track: BUDGET, scaleFor: (run) => (run.text === "cd" ? null : AFFINE) },
    )

    expect(compiled.expansion?.stretch.at(-1)).toBeCloseTo(
      2 * CHARACTER * 0.02,
      9,
    )
    expect(compiled.tracking?.stretch.at(-1)).toBeCloseTo(
      4 * CHARACTER * BUDGET,
      9,
    )
  })
})
