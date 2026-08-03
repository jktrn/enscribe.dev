import { describe, expect, test } from "bun:test"
import { breakParagraph, type Line } from "@linebreak/layout/breaker"
import { type Item, lineBreak, paragraphEnd } from "@linebreak/layout/items"
import { defaultGlue } from "@linebreak/layout/policy"

const SPACE = 10
const WORD = 25
const MEASURE = 400
const THIRD = 1 / 3

const source = { start: 0, end: 0 }

const box = (width: number): Item => ({ kind: "box", width, source })

const glue = (): Item => ({
  kind: "glue",
  width: SPACE,
  stretch: SPACE * defaultGlue.stretch,
  shrink: SPACE * defaultGlue.shrink,
  source: { start: 0, end: 1 },
})

const words = (count: number): Item[] => {
  const items: Item[] = []
  for (let index = 0; index < count; index += 1) {
    if (index > 0) items.push(glue())
    items.push(box(WORD))
  }
  return items
}

const evenWords = (count: number) => [...words(count), ...paragraphEnd(0)]

const solve = (items: readonly Item[], min?: number) => {
  const result = breakParagraph(
    items,
    MEASURE,
    min === undefined ? {} : { lastLineMinWidth: min },
  )
  if (!result.ok) throw new Error(`no layout: ${result.reason}`)
  return result
}

const fill = (lines: readonly Line[]) =>
  (lines[lines.length - 1] as Line).naturalWidth / MEASURE

const shape = (lines: readonly Line[]) =>
  lines.map((line) => line.spaceCount + 1).join("/")

describe("the floor is off unless it is asked for", () => {
  test("absent, zero and negative all leave the layout alone", () => {
    const plain = solve(evenWords(25))
    expect(shape(solve(evenWords(25), 0).lines)).toBe(shape(plain.lines))
    expect(shape(solve(evenWords(25), -1).lines)).toBe(shape(plain.lines))
    expect(fill(plain.lines)).toBeCloseTo(0.0625, 4)
  })
})

describe("a paragraph that can satisfy the floor does", () => {
  test("an ending under a third is lengthened past it", () => {
    const before = solve(evenWords(27)).lines
    const after = solve(evenWords(27), THIRD).lines
    expect(fill(before)).toBeLessThan(THIRD)
    expect(fill(after)).toBeGreaterThanOrEqual(THIRD)
    expect(shape(before)).toBe("12/12/3")
    expect(shape(after)).toBe("11/11/5")
  })

  test("an ending already past the floor is not touched", () => {
    for (const count of [30, 33, 36]) {
      const before = solve(evenWords(count)).lines
      expect(fill(before)).toBeGreaterThanOrEqual(THIRD)
      expect(shape(solve(evenWords(count), THIRD).lines)).toBe(shape(before))
    }
  })
})

describe("a paragraph that cannot satisfy the floor still improves", () => {
  test("the ending gets as long as the tolerances allow", () => {
    const before = solve(evenWords(25)).lines
    const after = solve(evenWords(25), THIRD).lines
    expect(fill(after)).toBeLessThan(THIRD)
    expect(fill(after)).toBeGreaterThan(fill(before))
    expect(shape(before)).toBe("12/12/1")
    expect(shape(after)).toBe("11/11/3")
  })

  test("an unreachable floor asks for what it can get, not for nothing", () => {
    const after = solve(evenWords(25), 1).lines
    expect(shape(after)).toBe("11/11/3")
    expect(shape(solve(evenWords(25), 4).lines)).toBe(shape(after))
  })
})

describe("the floor never shortens an ending", () => {
  test("no paragraph length regresses", () => {
    for (let count = 20; count <= 36; count += 1) {
      const before = fill(solve(evenWords(count)).lines)
      const after = fill(solve(evenWords(count), THIRD).lines)
      expect(after).toBeGreaterThanOrEqual(before - 1e-9)
    }
  })
})

describe("only the paragraph's own last line is floored", () => {
  test("a line ending at a forced break stays as short as it was", () => {
    const items = [
      ...words(3),
      ...lineBreak(0),
      ...words(27),
      ...paragraphEnd(0),
    ]
    const before = solve(items).lines
    const after = solve(items, THIRD).lines

    expect(before[0]?.breakKind).toBe("forced")
    expect(fill([before[0] as Line])).toBeLessThan(THIRD)
    expect(after[0]?.spaceCount).toBe(before[0]?.spaceCount as number)
    expect(fill(after)).toBeGreaterThanOrEqual(THIRD)
  })
})
