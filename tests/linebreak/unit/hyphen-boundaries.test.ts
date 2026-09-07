import { expect, test } from "bun:test"
import {
  compileText,
  createMetrics,
  type CompileResult,
  type TextSegment,
} from "@linebreak/text"
import { breakPenalty } from "@linebreak/layout/items"

// HY and every HH code point in Unicode 17 LineBreak.txt. UAX #14 LB21
// prohibits breaks before them; earlier SP and ZW opportunities retain priority.
const hyphens = [
  "-",
  "\u058A",
  "\u05BE",
  "\u1400",
  "\u2010",
  "\u2012",
  "\u2013",
  "\u2E17",
  "\u2E40",
  "\u2E5D",
  "\u{10D6E}",
  "\u{10EAD}",
]

// A measuring segmenter can split punctuation into its own run. Its segment
// boundaries are candidates, not permission to violate the source boundary.
const metrics = createMetrics({
  measure: (text) => [...text].length,
  segment(text) {
    const segments: TextSegment[] = []
    let start = 0
    for (const character of text) {
      const end = start + character.length
      segments.push({
        text: character,
        start,
        end,
        kind:
          character === " "
            ? "space"
            : character === "\u200B"
              ? "break-opportunity"
              : "text",
      })
      start = end
    }
    return segments
  },
})

const offsets = (compiled: CompileResult) => {
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.items.flatMap((item, index) => {
    const penalty = breakPenalty(compiled.items, index)
    if (penalty === null || penalty <= -10_000 || !item.source) return []
    if (item.kind === "discretionary") return [item.breakOffset]
    let next = index + 1
    while (
      compiled.items[next]?.kind === "glue" ||
      compiled.items[next]?.kind === "penalty"
    )
      next += 1
    return [compiled.items[next]?.source?.start ?? item.source.end]
  })
}

test("a measuring segment boundary cannot detach HY or HH from its left text", () => {
  for (const hyphen of hyphens) {
    const breaks = offsets(compileText(`ab${hyphen}cd`, metrics))
    expect(breaks).not.toContain(2)
    expect(breaks).toContain(2 + hyphen.length)
  }
})

test("spaces and explicit zero-width opportunities before hyphens remain legal", () => {
  for (const hyphen of hyphens) {
    for (const separator of [" ", "\u200B", "\u200B  "]) {
      const breaks = offsets(compileText(`ab${separator}${hyphen}cd`, metrics))
      expect(breaks).toContain(2 + separator.length)
    }
  }
})

test("hyphen plus WJ clusters cannot become isolated at the start of a line", () => {
  for (const joiner of ["\u2060", "\uFEFF"]) {
    const breaks = offsets(compileText(`ab-${joiner}cd`, metrics))
    expect(breaks).not.toContain(2)
    expect(breaks).not.toContain(3)
    expect(breaks).not.toContain(4)
  }
})

test("em dashes retain their separate before-and-after break behavior", () => {
  expect(offsets(compileText("ab—cd", metrics))).toEqual(
    expect.arrayContaining([2, 3]),
  )
  expect(offsets(compileText("ab—-cd", metrics))).toContain(2)
})
