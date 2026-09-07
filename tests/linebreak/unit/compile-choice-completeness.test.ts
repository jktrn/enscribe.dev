import { expect, test } from "bun:test"
import type { CompiledBlock, CompiledRun } from "@linebreak/layout/block"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraph, breakParagraphOnce } from "@linebreak/layout/breaker"
import { createMetrics } from "@linebreak/text/segments"

const metrics = createMetrics({
  font: "16px monospace",
  measure: (text) => text.length * 10,
})

const chain = (
  padding: readonly number[],
  spaceAt: number,
  nowrap: boolean,
) => {
  const runs: CompiledRun[] = [
    { kind: "text", text: "alpha", start: 0, end: 5, hyphenates: false },
  ]
  const edges = new Map<CompiledRun, number>()
  let offset = 5
  for (let index = 0; index <= padding.length; index += 1) {
    if (index === spaceAt) {
      runs.push({
        kind: "text",
        text: " ",
        start: offset,
        end: offset + 1,
        hyphenates: false,
      })
      offset += 1
    }
    if (index === padding.length) break
    const run: CompiledRun = {
      kind: "break",
      forced: false,
      start: offset,
      end: offset,
    }
    edges.set(run, padding[index]!)
    runs.push(run)
  }
  runs.push({
    kind: "text",
    text: "beta",
    start: offset,
    end: offset + 4,
    hyphenates: false,
  })
  const block: CompiledBlock = {
    text: "alpha beta",
    runs,
    breakRestrictions: nowrap ? [{ start: 0, end: 10 }] : [],
  }
  const compiled = compileBlock({
    block,
    locale: "en",
    baseFont: metrics.font,
    metricsFor: () => metrics,
    edgesFor: (run) => ({ leading: edges.get(run) ?? 0, trailing: 0 }),
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  return { block, compiled }
}

// Expected line advances come from the source token order, before compilation.
// The single boundary SPACE is absent on both sides of a chosen authored WBR.
test.each([
  false,
  true,
])("all 80 chain choices preserve independently counted decoration (nowrap=%s)", (nowrap) => {
  for (const count of [1, 2, 3, 4]) {
    const padding = [2, 4, 6, 2].slice(0, count)
    const total = padding.reduce((sum, width) => sum + width, 0)
    for (let spaceAt = 0; spaceAt <= count; spaceAt += 1) {
      const { block, compiled } = chain(padding, spaceAt, nowrap)
      let prefix = 0
      for (const [choice, width] of padding.entries()) {
        prefix += width
        const target = 50 + prefix
        const expected = [target, 40 + total - prefix]
        const layout = breakParagraphOnce(compiled.items, target, {
          tolerance: 200,
        })
        expect(
          layout.ok,
          JSON.stringify({ count, spaceAt, nowrap, choice }),
        ).toBe(true)
        if (!layout.ok) throw new Error("lost feasible authored choice")
        expect(layout.lines.map((line) => line.naturalWidth)).toEqual(expected)
        expect(layout.lines.map((line) => line.spaceCount)).toEqual([0, 0])
        const runIndex = compiled.breakRuns!.get(layout.lines[0]!.end)!
        expect(block.runs[runIndex]!.start).toBe(spaceAt <= choice ? 6 : 5)
      }
      const wide = breakParagraph(compiled.items, 300)
      expect(wide.ok && wide.lines.map((line) => line.naturalWidth)).toEqual([
        100 + total,
      ])
    }
  }
})

test.each([
  3, 4,
])("%s authored choices need no decoration-only emergency line", (count) => {
  const { compiled } = chain([2, 4, 6, 2].slice(0, count), 1, false)
  const layout = breakParagraph(compiled.items, 52)
  expect(layout.ok).toBe(true)
  if (!layout.ok) throw new Error("lost feasible two-line plan")
  expect(layout.pass).toBe("pretolerance")
  expect(layout.lines.map((line) => line.naturalWidth)).toEqual([
    52,
    count === 3 ? 50 : 52,
  ])
})
