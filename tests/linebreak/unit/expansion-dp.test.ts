import { describe, expect, test } from "bun:test"
import { breakParagraphOnce } from "@linebreak/layout/breaker"
import { buildExpansion, fitLines } from "@linebreak/layout/expansion"
import { box, glue, type Item, paragraphEnd } from "@linebreak/layout/items"
import { texDefaults } from "@linebreak/layout/policy"
import { AFFINE } from "./support/measure"

const WORD = 100
const SPACE = 10
const SPACE_STRETCH = 5
const SPACE_SHRINK = 3

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

/** Three words measure 320 with 6px of glue shrink, so they cannot be
 * squeezed below 314. The three boxes earn 300 * 2% = 6px more. */
const TIGHT = 310

const solve = (items: readonly Item[], measure: number, expand: boolean) =>
  breakParagraphOnce(items, measure, {
    tolerance: texDefaults.tolerance,
    ...(expand ? { expansion: buildExpansion(items, AFFINE, NO_MARKS) } : {}),
  })

describe("elasticity the glyphs bring to the optimizer", () => {
  test("a line the glue could not shrink into fits once the glyphs can", () => {
    const items = fourWords()

    expect(solve(items, TIGHT, false).ok).toBe(false)

    const solved = solve(items, TIGHT, true)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    expect(solved.lines[0]?.end).toBe(5)
  })

  test("the budget is pooled into the line's own shrink", () => {
    const items = fourWords()
    const solved = solve(items, TIGHT, true)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    const line = solved.lines[0]
    expect(line?.shrink).toBeCloseTo(2 * SPACE_SHRINK + 3 * WORD * 0.02, 9)
    expect(line?.adjustmentRatio).toBeCloseTo(-10 / 12, 9)
  })

  test("the renderer is handed the glue's share, not the pooled one", () => {
    const items = fourWords()
    const expansion = buildExpansion(items, AFFINE, NO_MARKS)
    const solved = solve(items, TIGHT, true)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    const fit = fitLines(solved.lines, TIGHT, expansion, AFFINE)[0]

    expect(fit?.shrink).toBeCloseTo(2 * SPACE_SHRINK, 9)
    expect(fit?.pct).toBe(98)
  })
})

describe("prefix sums are memoized per item stream", () => {
  test("the same stream re-broken without a budget loses it again", () => {
    const items = fourWords()

    expect(solve(items, TIGHT, true).ok).toBe(true)
    expect(solve(items, TIGHT, false).ok).toBe(false)
    expect(solve(items, TIGHT, true).ok).toBe(true)
  })

  test("two different budgets over one stream do not share sums", () => {
    const items = fourWords()
    const narrow = buildExpansion(items, AFFINE, new Set([0, 2, 4, 6]))
    const wide = buildExpansion(items, AFFINE, NO_MARKS)
    const options = { tolerance: texDefaults.tolerance }

    expect(
      breakParagraphOnce(items, TIGHT, { ...options, expansion: wide }).ok,
    ).toBe(true)
    expect(
      breakParagraphOnce(items, TIGHT, { ...options, expansion: narrow }).ok,
    ).toBe(false)
  })
})
