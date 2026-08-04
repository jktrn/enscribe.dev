import { describe, expect, test } from "bun:test"
import { breakParagraphOnce } from "@linebreak/layout/breaker"
import {
  box,
  discretionary,
  glue,
  type Item,
  paragraphEnd,
} from "@linebreak/layout/items"
import { buildHangs, type Hangs } from "@linebreak/layout/protrusion"
import { texDefaults } from "@linebreak/layout/policy"

const WORD = 100
const SPACE = 10
const SPACE_STRETCH = 5
const SPACE_SHRINK = 3

const spacer = () =>
  glue(SPACE, SPACE_STRETCH, SPACE_SHRINK, { start: 0, end: 1 })

const threeWords = (): Item[] => [
  box(WORD, { start: 0, end: 1 }),
  spacer(),
  box(WORD, { start: 2, end: 3 }),
  spacer(),
  box(WORD, { start: 4, end: 5 }),
  ...paragraphEnd(5),
]

const solve = (items: readonly Item[], measure: number, hangs?: Hangs) =>
  breakParagraphOnce(items, measure, {
    tolerance: texDefaults.tolerance,
    ...(hangs ? { hangs } : {}),
  })

const TIGHT = 206.5
const ROOMY = 213

describe("a protruding line end", () => {
  test("a line that was too long fits once its last glyph hangs", () => {
    const items = threeWords()

    expect(solve(items, TIGHT).ok).toBe(false)

    const hangs = buildHangs(items, new Map(), new Map([[2, 4]]))
    const solved = solve(items, TIGHT, hangs)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    expect(solved.lines.length).toBe(2)
    expect(solved.lines[0]?.end).toBe(3)
  })

  test("the credit comes off the line's natural width", () => {
    const items = threeWords()
    const hangs = buildHangs(items, new Map(), new Map([[2, 4]]))
    const solved = solve(items, TIGHT, hangs)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    expect(solved.lines[0]?.naturalWidth).toBe(2 * WORD + SPACE - 4)
    expect(solved.lines[0]?.hangEnd).toBe(4)
    expect(solved.lines[0]?.hangStart).toBe(0)
  })

  test("a hyphen drawn at the break hangs by its own credit", () => {
    const items: Item[] = [
      box(WORD, { start: 0, end: 1 }),
      spacer(),
      box(WORD, { start: 2, end: 3 }),
      discretionary({
        preWidth: 4,
        penalty: 50,
        hyphen: true,
        breakOffset: 4,
      }),
      box(WORD, { start: 4, end: 5 }),
      ...paragraphEnd(5),
    ]
    const hangs = buildHangs(items, new Map(), new Map([[3, 2]]))
    const solved = solve(items, 212, hangs)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    expect(solved.lines[0]?.breakKind).toBe("hyphen")
    expect(solved.lines[0]?.hangEnd).toBe(2)
    expect(solved.lines[0]?.naturalWidth).toBe(2 * WORD + SPACE + 4 - 2)
  })
})

describe("a protruding line start", () => {
  test("the paragraph's opening glyph hangs on the first line", () => {
    const items = threeWords()
    const hangs = buildHangs(items, new Map([[0, 3]]), new Map())
    const solved = solve(items, ROOMY, hangs)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    expect(solved.lines[0]?.hangStart).toBe(3)
    expect(solved.lines[0]?.naturalWidth).toBe(2 * WORD + SPACE - 3)
  })

  test("each line takes the credit of the box that opens it", () => {
    const items = threeWords()
    const hangs = buildHangs(
      items,
      new Map([
        [0, 3],
        [4, 7],
      ]),
      new Map(),
    )
    const solved = solve(items, ROOMY, hangs)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    expect(solved.lines[1]?.hangStart).toBe(7)
    expect(solved.lines[1]?.naturalWidth).toBe(WORD - 7)
  })
})

describe("with no hangs supplied", () => {
  test("widths and credits are the unprotruded ones", () => {
    const items = threeWords()
    const solved = solve(items, ROOMY)

    expect(solved.ok).toBe(true)
    if (!solved.ok) return
    for (const line of solved.lines) {
      expect(line.hangStart).toBe(0)
      expect(line.hangEnd).toBe(0)
    }
    expect(solved.lines[0]?.naturalWidth).toBe(2 * WORD + SPACE)
  })

  test("an all-zero table is the same layout as no table at all", () => {
    const items = threeWords()
    const zeroed = buildHangs(items, new Map(), new Map())

    expect(solve(items, TIGHT, zeroed)).toEqual(solve(items, TIGHT))
  })
})
