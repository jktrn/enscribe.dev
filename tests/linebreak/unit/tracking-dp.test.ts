import { describe, expect, test } from "bun:test"
import { breakParagraphOnce } from "@linebreak/layout/breaker"
import { buildExpansion } from "@linebreak/layout/expansion"
import { pooledFlex } from "@linebreak/layout/flex"
import { box, glue, type Item, paragraphEnd } from "@linebreak/layout/items"
import { texDefaults } from "@linebreak/layout/policy"
import { buildTracking } from "@linebreak/layout/tracking"
import { AFFINE } from "./support/measure"

const WORD = 100
const SPACE = 10
const SPACE_STRETCH = 5
const SPACE_SHRINK = 3
const BUDGET = 0.03

const fourWords = (): Item[] => [
  box(WORD, { start: 0, end: 1 }),
  glue(SPACE, SPACE_STRETCH, SPACE_SHRINK, { start: 1, end: 2 }),
  box(WORD, { start: 2, end: 3 }),
  glue(SPACE, SPACE_STRETCH, SPACE_SHRINK, { start: 3, end: 4 }),
  box(WORD, { start: 4, end: 5 }),
  glue(SPACE, SPACE_STRETCH, SPACE_SHRINK, { start: 5, end: 6 }),
  box(WORD, { start: 6, end: 7 }),
  ...paragraphEnd(7),
]

const NO_MARKS: ReadonlySet<number> = new Set()

const THREE_WORDS = 3 * WORD + 2 * SPACE

const GLUE_FLOOR = THREE_WORDS - 2 * SPACE_SHRINK

const LETTERFIT_FLOOR = GLUE_FLOOR - 3 * WORD * BUDGET

const TIGHT = 308

const LOOSE = 340

const solve = (items: readonly Item[], measure: number, track: boolean) =>
  breakParagraphOnce(items, measure, {
    tolerance: texDefaults.tolerance,
    ...(track ? { flex: buildTracking(items, BUDGET, NO_MARKS) } : {}),
  })

describe("elasticity the inter-character space brings to the optimizer", () => {
  test("the tight measure is under the glue's floor and over the letterfit's", () => {
    expect(TIGHT).toBeLessThan(GLUE_FLOOR)
    expect(TIGHT).toBeGreaterThan(LETTERFIT_FLOOR)
  })

  test("a line the glue could not shrink into fits once the letters close", () => {
    const items = fourWords()

    expect(solve(items, TIGHT, false).ok).toBe(false)

    const solved = solve(items, TIGHT, true)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    expect(solved.lines[0]?.end).toBe(5)
  })

  test("a line the glue could not stretch into fits once the letters open", () => {
    const items = fourWords()

    expect(solve(items, LOOSE, false).ok).toBe(false)

    const solved = solve(items, LOOSE, true)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    expect(solved.lines[0]?.end).toBe(5)
  })

  test("the budget is pooled into the line's own stretch", () => {
    const items = fourWords()
    const solved = solve(items, LOOSE, true)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    expect(solved.lines[0]?.stretch).toBeCloseTo(
      2 * SPACE_STRETCH + 3 * WORD * BUDGET,
      9,
    )
  })

  test("the budget is pooled into the line's own shrink", () => {
    const items = fourWords()
    const solved = solve(items, TIGHT, true)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    expect(solved.lines[0]?.shrink).toBeCloseTo(
      2 * SPACE_SHRINK + 3 * WORD * BUDGET,
      9,
    )
  })

  test("glyphs that earned nothing bring the optimizer nothing", () => {
    const items = fourWords()
    const barren = buildTracking(items, BUDGET, new Set([0, 2, 4, 6]))

    expect(
      breakParagraphOnce(items, TIGHT, {
        tolerance: texDefaults.tolerance,
        flex: barren,
      }).ok,
    ).toBe(false)
  })
})

describe("letterfit and the width axis reaching the DP together", () => {
  test("the pooled sidecar carries the sum of both budgets", () => {
    const items = fourWords()
    const both = pooledFlex(
      buildExpansion(items, AFFINE, NO_MARKS),
      buildTracking(items, BUDGET, NO_MARKS),
    )
    const solved = breakParagraphOnce(items, LOOSE, {
      tolerance: texDefaults.tolerance,
      flex: both,
    })

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    expect(solved.lines[0]?.stretch).toBeCloseTo(
      2 * SPACE_STRETCH + 3 * WORD * (BUDGET + 0.02),
      9,
    )
  })

  test("neither budget alone reaches what the two reach together", () => {
    const items = fourWords()
    const options = { tolerance: texDefaults.tolerance }
    const wide = 344

    expect(
      breakParagraphOnce(items, wide, {
        ...options,
        flex: buildTracking(items, BUDGET, NO_MARKS),
      }).ok,
    ).toBe(false)
    expect(
      breakParagraphOnce(items, wide, {
        ...options,
        flex: buildExpansion(items, AFFINE, NO_MARKS),
      }).ok,
    ).toBe(false)
    expect(
      breakParagraphOnce(items, wide, {
        ...options,
        flex: pooledFlex(
          buildExpansion(items, AFFINE, NO_MARKS),
          buildTracking(items, BUDGET, NO_MARKS),
        ),
      }).ok,
    ).toBe(true)
  })
})
