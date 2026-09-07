import { describe, expect, test } from "bun:test"
import { breakParagraph, type Line } from "@linebreak/layout/breaker"
import { type Item, paragraphEnd } from "@linebreak/layout/items"
import { defaultGlue } from "@linebreak/layout/policy"

const SPACE = 10
const WORD = 25
const MEASURE = 400

const source = { start: 0, end: 0 }

const box = (width: number): Item => ({ kind: "box", width, source })

const glue = (): Item => ({
  kind: "glue",
  width: SPACE,
  stretch: SPACE * defaultGlue.stretch,
  shrink: SPACE * defaultGlue.shrink,
  source: { start: 0, end: 1 },
})

const evenWords = (count: number): Item[] => {
  const items: Item[] = []
  for (let index = 0; index < count; index += 1) {
    if (index > 0) items.push(glue())
    items.push(box(WORD))
  }
  return [...items, ...paragraphEnd(0)]
}

const contentWidth = (line: Line) =>
  (WORD + SPACE) * (line.spaceCount + 1) - SPACE

const solve = (count: number, indent: number) => {
  const result = breakParagraph(evenWords(count), MEASURE, { indent })
  if (!result.ok) throw new Error(`no layout: ${result.reason}`)
  return result
}

describe("an indent narrows the first line and nothing else", () => {
  test("the first line's natural width carries the indent", () => {
    const { lines } = solve(22, 100)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines[0]?.naturalWidth).toBeCloseTo(
      contentWidth(lines[0] as Line) + 100,
      9,
    )
  })

  test("every later line's natural width is its content alone", () => {
    const { lines } = solve(22, 100)
    for (const line of lines.slice(1)) {
      expect(line.naturalWidth).toBeCloseTo(contentWidth(line), 9)
    }
  })

  test("the indent buys the first line fewer words", () => {
    const plain = solve(22, 0).lines[0] as Line
    const indented = solve(22, 100).lines[0] as Line
    expect(indented.spaceCount).toBeLessThan(plain.spaceCount)
    expect(Math.abs(indented.naturalWidth - MEASURE)).toBeLessThan(WORD + SPACE)
  })

  test("a negative indent lends the first line the room instead", () => {
    const plain = solve(22, 0).lines[0] as Line
    const outdented = solve(22, -100).lines[0] as Line
    expect(outdented.spaceCount).toBeGreaterThan(plain.spaceCount)
    expect(contentWidth(outdented)).toBeGreaterThan(MEASURE)
  })

  test("no indent is the layout the paragraph had before", () => {
    const plain = solve(22, 0)
    const zero = breakParagraph(evenWords(22), MEASURE, { indent: 0 })
    const absent = breakParagraph(evenWords(22), MEASURE, {})
    expect(zero.ok && absent.ok).toBe(true)
    if (!zero.ok || !absent.ok) return
    expect(zero.lines.map((line) => line.end)).toEqual(
      plain.lines.map((line) => line.end),
    )
    expect(absent.lines.map((line) => line.end)).toEqual(
      plain.lines.map((line) => line.end),
    )
  })

  test("an indent wider than the measure runs out of rungs and forces", () => {
    const forced = breakParagraph(evenWords(22), MEASURE, { indent: 500 })
    expect(forced.ok).toBe(true)
    if (!forced.ok) return
    expect(forced.pass).toBe("forced")
    expect(forced.lines[0]?.naturalWidth).toBeGreaterThan(MEASURE)
  })
})
