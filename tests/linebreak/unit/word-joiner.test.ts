import { expect, test } from "bun:test"
import {
  compileRuns,
  compileText,
  createMetrics,
  type CompileResult,
  segmentText,
} from "@linebreak/text"
import { breakPenalty, type Item } from "@linebreak/layout/items"

// Unicode 17 LineBreak.txt: 2060 and FEFF are WJ; UAX #14 LB11 forbids
// adjacent breaks, except that the earlier LB8 rule permits ZW SP* breaks.
const joiners = ["\u2060", "\uFEFF"]
const metrics = createMetrics({
  measure: (text) => text.replace(/[\u2060\uFEFF\u200B]/gu, "").length,
})

const offsets = (compiled: CompileResult) => {
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.items.flatMap((item: Item, index) => {
    const penalty = breakPenalty(compiled.items, index)
    if (penalty === null || penalty <= -10_000 || !item.source) return []
    if (item.kind === "discretionary") return [item.breakOffset]
    if (
      item.source.start === item.source.end &&
      item.source.end === compiled.items.at(-1)?.source?.end
    )
      return []
    // A zero-width opportunity followed by spaces consumes those leading spaces.
    let next = index + 1
    while (
      compiled.items[next]?.kind === "glue" ||
      compiled.items[next]?.kind === "penalty"
    )
      next += 1
    return [compiled.items[next]?.source?.start ?? item.source.end]
  })
}

test("WJ characters stay within the text segment they join", () => {
  for (const joiner of joiners) {
    const text = `ab${joiner}cd`
    expect(segmentText(text)).toEqual([
      { text, start: 0, end: text.length, kind: "text" },
    ])
  }
  expect(segmentText("ab\u200Bcd").map((segment) => segment.kind)).toEqual([
    "text",
    "break-opportunity",
    "text",
  ])
})

test("WJ forbids breaks next to hyphens, dashes and discretionary hyphens", () => {
  for (const joiner of joiners) {
    for (const text of [
      `ab-${joiner}cd`,
      `ab${joiner}—cd`,
      `ab\u00AD${joiner}cd`,
    ]) {
      const at = text.indexOf(joiner)
      const breaks = offsets(compileText(text, metrics))
      expect(breaks).not.toContain(at)
      expect(breaks).not.toContain(at + 1)
    }
  }
})

test("space breaking is tested after consumed spaces, including across runs", () => {
  for (const joiner of joiners) {
    expect(offsets(compileText(`ab ${joiner}cd`, metrics))).not.toContain(3)
    expect(offsets(compileText(`ab${joiner} cd`, metrics))).toContain(4)
    expect(
      offsets(compileRuns([{ text: "ab " }, { text: `${joiner}cd` }], metrics)),
    ).not.toContain(3)
  }
})

test("code and custom hyphenation cannot insert breaks next to WJ", () => {
  for (const joiner of joiners) {
    const text = `some${joiner}.camelCase`
    const at = text.indexOf(joiner)
    for (const options of [
      { code: true },
      {
        hyphenate: (word: string) =>
          Array.from({ length: word.length - 1 }, (_, index) => index + 1),
      },
    ]) {
      const breaks = offsets(compileText(text, metrics, options))
      expect(breaks.length).toBeGreaterThan(0)
      expect(breaks).not.toContain(at)
      expect(breaks).not.toContain(at + 1)
    }
  }
})

test("the earlier Unicode ZW rule keeps its priority over a following WJ", () => {
  for (const joiner of joiners) {
    expect(offsets(compileText(`ab\u200B${joiner}cd`, metrics))).toContain(3)
    expect(offsets(compileText(`ab\u200B  ${joiner}cd`, metrics))).toContain(5)
  }
})
