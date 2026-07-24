import { describe, expect, test } from "bun:test"
import { codeBreakOffsets } from "@linebreak/text/code-breaks"

const penaltyAt = (breaks: ReadonlyMap<number, number>, offset: number) => {
  const penalty = breaks.get(offset)
  if (penalty === undefined) {
    throw new Error(`Expected a break at offset ${offset}`)
  }
  return penalty
}

describe("inline-code break heuristics", () => {
  test("prefers separators, then word and identifier boundaries, before emergencies", () => {
    const breaks = codeBreakOffsets("fooBar_baz/qux42")
    const separator = penaltyAt(breaks, 11)
    const wordSeparator = penaltyAt(breaks, 7)
    const identifierBoundary = penaltyAt(breaks, 3)
    const letterNumberBoundary = penaltyAt(breaks, 14)
    const emergency = penaltyAt(breaks, 4)

    expect(separator).toBeLessThan(wordSeparator)
    expect(wordSeparator).toBeLessThan(identifierBoundary)
    expect(identifierBoundary).toBeLessThan(letterNumberBoundary)
    expect(letterNumberBoundary).toBeLessThan(emergency)
  })

  test("does not split decimal points or repeated separators in the middle", () => {
    const decimal = codeBreakOffsets("3.14159")
    const path = codeBreakOffsets("foo//bar")

    expect(decimal.has(2)).toBe(false)
    expect(path.has(4)).toBe(false)
    expect(path.has(5)).toBe(true)
  })

  test("never creates an emergency break inside a grapheme cluster", () => {
    const text = "a\u0301bcdefgh"
    const offsets = [...codeBreakOffsets(text).keys()]

    expect(offsets).not.toContain(1)
    for (const offset of offsets) {
      expect(text.slice(0, offset).endsWith("a")).toBe(false)
    }
  })
})
