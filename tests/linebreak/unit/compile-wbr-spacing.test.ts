import { expect, test } from "bun:test"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraph } from "@linebreak/layout/breaker"
import { createMetrics } from "@linebreak/text/segments"
import type { CompiledBlock } from "@linebreak/layout/block"

const metrics = createMetrics({
  font: "16px serif",
  measure: (text) => text.length * 10,
})
const solve = (target: number, edges: readonly number[]) => {
  const block: CompiledBlock = {
    text: "alpha beta",
    runs: [
      { kind: "text", text: "alpha ", start: 0, end: 6, hyphenates: false },
      ...edges.map(() => ({
        kind: "break" as const,
        forced: false,
        start: 6,
        end: 6,
      })),
      { kind: "text", text: "beta", start: 6, end: 10, hyphenates: false },
    ],
    breakRestrictions: [{ start: 0, end: 10 }],
  }
  let edge = 0
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    metricsFor: () => metrics,
    locale: "en",
    edgesFor: (run) => ({
      leading: run.kind === "break" ? edges[edge++]! : 0,
      trailing: 0,
    }),
    track: 0.02,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, target)
  if (!layout.ok) throw new Error("unbreakable")
  return { compiled, lines: layout.lines }
}

test("a chosen WBR removes a preceding collapsed nowrap space", () => {
  const { compiled, lines } = solve(60, [0])
  expect(
    lines.map((line) => [line.sourceEnd, line.breakKind, line.naturalWidth]),
  ).toEqual([
    [6, "space", 50],
    [10, "end", 40],
  ])
  expect(compiled.tracking!.stretch.at(-1)).toBeCloseTo(1.8)
})

test("an unchosen WBR keeps its preceding space", () => {
  expect(solve(300, [0]).lines.map((line) => line.naturalWidth)).toEqual([100])
})

test.each([
  { edges: [5] },
  { edges: [3, 7] },
])("WBR wrapper edges remain on the broken line: %j", ({ edges }) => {
  const padding = edges.reduce((sum, width) => sum + width, 0)
  expect(solve(60, edges).lines.map((line) => line.naturalWidth)).toEqual([
    50 + padding,
    40,
  ])
  expect(solve(300, edges).lines.map((line) => line.naturalWidth)).toEqual([
    100 + padding,
  ])
})
