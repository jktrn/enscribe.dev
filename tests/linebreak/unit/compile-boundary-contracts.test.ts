import { expect, test } from "bun:test"
import { compileBlock, type RunEdges } from "@linebreak/layout/compile"
import { breakParagraph } from "@linebreak/layout/breaker"
import type { CompiledBlock, CompiledRun } from "@linebreak/layout/block"
import { createMetrics } from "@linebreak/text/segments"

const metrics = createMetrics({
  font: "16px serif",
  measure: (text) => text.length * 10,
})
const solve = (
  block: CompiledBlock,
  target: number,
  edgesFor?: (run: CompiledRun) => RunEdges,
) => {
  const compiled = compileBlock({
    block,
    locale: "en",
    baseFont: metrics.font,
    metricsFor: () => metrics,
    atomWidth: () => 50,
    edgesFor,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const result = breakParagraph(compiled.items, target)
  if (!result.ok) throw new Error("unbreakable")
  return result
}

test("an authored WBR separates two nowrap atoms without textual content", () => {
  const result = solve(
    {
      text: "\ufffc\ufffc",
      runs: [
        { kind: "atom", start: 0, end: 1 },
        { kind: "break", forced: false, start: 1, end: 1 },
        { kind: "atom", start: 1, end: 2 },
      ],
      breakRestrictions: [{ start: 0, end: 2 }],
    },
    50,
  )
  expect(
    result.lines.map((line) => [line.sourceEnd, line.naturalWidth]),
  ).toEqual([
    [1, 50],
    [2, 50],
  ])
})

test("consecutive automatic atom boundaries do not acquire hyphen demerits", () => {
  const result = solve(
    {
      text: "\ufffc\ufffc\ufffc",
      runs: [0, 1, 2].map((start) => ({ kind: "atom", start, end: start + 1 })),
      breakRestrictions: [],
    },
    50,
  )
  expect(result.lines).toHaveLength(3)
  expect(result.demerits).toBe(300)
})

test("a leading padded WBR cannot turn the opening atom boundary into a blank line", () => {
  const result = solve(
    {
      text: "\ufffcbeta",
      runs: [
        { kind: "break", forced: false, start: 0, end: 0 },
        { kind: "atom", start: 0, end: 1 },
        { kind: "text", text: "beta", start: 1, end: 5, hyphenates: false },
      ],
      breakRestrictions: [],
    },
    50,
    (run) => ({ leading: run.kind === "break" ? 5 : 0, trailing: 0 }),
  )
  expect(result.lines.map((line) => line.naturalWidth)).toEqual([55, 40])
})

test("an invisible forbidden soft hyphen may leave no items before an atom", () => {
  const result = solve(
    {
      text: "\u00ad\ufffc",
      runs: [
        { kind: "text", text: "\u00ad", start: 0, end: 1, hyphenates: false },
        { kind: "atom", start: 1, end: 2 },
      ],
      breakRestrictions: [{ start: 0, end: 1 }],
    },
    50,
  )
  expect(result.lines.map((line) => line.naturalWidth)).toEqual([50])
})

test("a final whitespace-only wrapper keeps its edge width on preceding content", () => {
  const result = solve(
    {
      text: "alpha",
      runs: [
        { kind: "text", text: "alpha", start: 0, end: 5, hyphenates: false },
        { kind: "anchor", affinity: "previous", start: 5, end: 5 },
      ],
      breakRestrictions: [],
    },
    300,
    (run) => ({
      leading: run.kind === "anchor" ? 3 : 0,
      trailing: run.kind === "anchor" ? 7 : 0,
    }),
  )
  expect(result.lines.map((line) => line.naturalWidth)).toEqual([60])
})

test("multiple trailing WBRs cannot trade final-hyphen cost for a phantom blank line", () => {
  const text = "alph\u00adbetaa"
  const result = solve(
    {
      text,
      runs: [
        { kind: "text", text, start: 0, end: text.length, hyphenates: false },
        { kind: "break", forced: false, start: text.length, end: text.length },
        { kind: "break", forced: false, start: text.length, end: text.length },
      ],
      breakRestrictions: [],
    },
    50,
  )
  expect(
    result.lines.map((line) => [line.sourceEnd, line.naturalWidth]),
  ).toEqual([
    [5, 50],
    [10, 50],
  ])
})

test("a distant hyphen cannot flag later ordinary break opportunities", () => {
  const text = "alpha-beta gamma\u200bdelta"
  const compiled = compileBlock({
    block: {
      text,
      runs: [
        { kind: "text", text, start: 0, end: text.length, hyphenates: false },
      ],
      breakRestrictions: [],
    },
    locale: "en",
    baseFont: metrics.font,
    metricsFor: () => metrics,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  expect(
    compiled.items
      .filter((item) => item.kind === "penalty" && item.flagged)
      .map((item) => item.source!.start),
  ).toEqual([6])
})
