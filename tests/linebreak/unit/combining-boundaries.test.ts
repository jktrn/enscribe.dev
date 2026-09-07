import { expect, test } from "bun:test"
import { breakParagraph, breakParagraphOnce } from "@linebreak/layout/breaker"
import { breakPenalty } from "@linebreak/layout/items"
import { compileRuns, compileText, createMetrics, segmentText } from "@linebreak/text"
import type { CompileResult, TextSegment } from "@linebreak/text"
import { combiningBaseEnd, combiningBoundaryAllows } from "@linebreak/text/source"

const metrics = createMetrics({
  measure: (text) => text.replace(/[\p{M}\u200D]/gu, "").length * 10,
})

const breakOffsets = (compiled: CompileResult) => {
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.items.flatMap((item, index) => {
    const cost = breakPenalty(compiled.items, index)
    if (cost === null || cost <= -10_000) return []
    return [item.kind === "discretionary" ? item.breakOffset : item.source?.end]
  })
}

test.each(["\u0300", "\u0301", "\u0301\u0308", "\uFE0F", "\u{1D185}"])(
  "a dash keeps following marks on its own line: %s",
  (marks) => {
    const text = `a-${marks}b`
    expect(segmentText(text).map((segment) => segment.text)).toEqual([
      `a-${marks}`, "b",
    ])
    const compiled = compileText(text, metrics)
    if (!compiled.ok) throw new Error(compiled.reason)
    const plan = breakParagraph(compiled.items, 20)
    if (!plan.ok) throw new Error("expected the valid break after the marked dash")
    expect(plan.lines.map((line) => text.slice(line.sourceStart, line.sourceEnd)))
      .toEqual([`a-${marks}`, "b"])
    expect(compiled.items[1]).toMatchObject({
      kind: "penalty", penalty: 50, flagged: true,
    })
  },
)

test.each(["–", "—", "―"])("a marked %s offers breaks around the complete cluster", (dash) => {
  const text = `a${dash}\u0301b`
  expect(segmentText(text).map((segment) => segment.text)).toEqual([
    "a", `${dash}\u0301`, "b",
  ])
  const offsets = breakOffsets(compileText(text, metrics))
  expect(offsets).not.toContain(2)
  expect(offsets).toContain(3)
})

test("a joiner prevents a break immediately before and after itself", () => {
  const text = "a-\u200Db"
  expect(segmentText(text).map((segment) => segment.text)).toEqual([text])
  const offsets = breakOffsets(compileText(text, metrics))
  expect(offsets).not.toContain(2)
  expect(offsets).not.toContain(3)
})

test.each(["\u2060", "\uFEFF"])("combining marks retain the nonbreaking behavior of %s", (joiner) => {
  const text = `a${joiner}\u0301—b`
  expect(breakOffsets(compileText(text, metrics))).not.toContain(3)
})

test("provider segments cannot offer a break between a base and its mark", () => {
  const segment = (text: string): TextSegment[] => [
    { text: text.slice(0, 2), start: 0, end: 2, kind: "text" },
    { text: text.slice(2), start: 2, end: text.length, kind: "text" },
  ]
  const custom = createMetrics({ measure: metrics.measureRun, segment })
  expect(breakOffsets(compileText("a-\u0301b", custom))).not.toContain(2)
})

test("custom hyphenation cannot divide a combining sequence or joiner", () => {
  const hyphenate = (text: string) => Array.from(
    { length: text.length - 1 }, (_, index) => index + 1,
  )
  expect(breakOffsets(compileText("ab\u0301cd", metrics, { hyphenate })))
    .toEqual(expect.arrayContaining([1, 3, 4]))
  expect(breakOffsets(compileText("ab\u0301cd", metrics, { hyphenate })))
    .not.toContain(2)
  const joined = breakOffsets(compileText("ab\u200Dcd", metrics, { hyphenate }))
  expect(joined).not.toContain(2)
  expect(joined).not.toContain(3)
})

test("combining safety uses paragraph offsets across styled runs", () => {
  const custom = createMetrics({
    measure: metrics.measureRun,
    segment: (text) => [
      { text: text.slice(0, 2), start: 0, end: 2, kind: "text" },
      { text: text.slice(2), start: 2, end: text.length, kind: "text" },
    ],
  })
  const compiled = compileRuns([
    { text: "prefix " }, { text: "a-\u0301b", metrics: custom },
  ], metrics)
  expect(breakOffsets(compiled)).not.toContain(9)
})

test.each([" ", "\n", "\v", "\f", "\r", "\u0085", "\u2028", "\u2029", "\u200B"])(
  "a line-break reset retains priority before a combining mark: %s",
  (reset) => expect(combiningBoundaryAllows(`a${reset}\u0301b`, 2)).toBe(true),
)

test("a tab has BA line-break behavior and does not reset a following mark", () => {
  expect(combiningBoundaryAllows("a\t\u0301b", 2)).toBe(false)
})

test("SPACE and explicit zero-width breaks still permit a following mark", () => {
  for (const reset of [" ", "\u200B"]) {
    expect(breakOffsets(compileText(`a${reset}\u0301b`, metrics))).toContain(2)
  }
})

test("base lookup handles leading mark sequences and both UTF-16 widths", () => {
  expect(combiningBaseEnd("\u0301\u{1D185}", 3)).toBe(0)
  expect(combiningBaseEnd("a\u{1D185}\u0301", 4)).toBe(1)
  expect(combiningBaseEnd("", 0)).toBe(0)
})

const markedMetrics = createMetrics({
  measure: (text) => text.replace(/[\p{M}\u2060\uFEFF]/gu, "").length * 10,
})

test.each(["\u2060", "\uFEFF"])(
  "a marked word joiner does not suppress the valid break after a later dash: %s",
  (joiner) => {
    const text = `a${joiner}\u0301—bb`
    const compiled = compileText(text, markedMetrics)
    if (!compiled.ok) throw new Error(compiled.reason)
    const plan = breakParagraphOnce(compiled.items, 20, { tolerance: 0 })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.lines.map((line) => line.naturalWidth)).toEqual([20, 20])
    expect(plan.lines.map((line) => text.slice(line.sourceStart, line.sourceEnd)))
      .toEqual([`a${joiner}\u0301—`, "bb"])
  },
)
