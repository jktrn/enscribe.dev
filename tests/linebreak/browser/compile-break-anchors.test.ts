import { afterEach, expect, test } from "vitest"
import { type InlineRun, runEdgeWidths } from "@linebreak/dom/extract"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraph, breakParagraphOnce } from "@linebreak/layout/breaker"
import { createMetrics } from "@linebreak/text/segments"
import { extract } from "./support/extraction"
const metrics = createMetrics({
  font: "16px serif",
  measure: (text) => text.length * 10,
})
afterEach(() => document.body.replaceChildren())

const compile = (html: string) => {
  const block = extract(html)
  const compiled = compileBlock({
    block,
    locale: "en",
    baseFont: metrics.font,
    metricsFor: () => metrics,
    edgesFor: (run: InlineRun) => runEdgeWidths(block, run),
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  return { block, compiled }
}

test.each([
  false,
  true,
])("an anchored whitespace contributor belongs between its authored WBR choices (nowrap=%s)", (nowrap) => {
  const body =
    'alpha<i style="padding-inline-start:2px"><wbr id="first"></i> <b style="padding-inline-start:7px"> </b><i style="padding-inline-start:4px"><wbr id="second"></i>beta'
  const { block, compiled } = compile(
    nowrap ? `<span data-nowrap>${body}</span>` : body,
  )
  expect(block.runs.some((run) => run.kind === "anchor")).toBe(true)
  for (const [target, expected] of [
    [52, [52, 51]],
    [63, [63, 40]],
  ] as const) {
    const layout = breakParagraphOnce(compiled.items, target, {
      tolerance: 1,
      force: false,
    })
    expect(layout.ok).toBe(true)
    if (!layout.ok) throw new Error("missing feasible anchored choice")
    expect(
      layout.lines.map((line) => [line.naturalWidth, line.spaceCount]),
    ).toEqual(expected.map((width) => [width, 0]))
  }
  const wide = breakParagraph(compiled.items, 300)
  if (!wide.ok) throw new Error("unbreakable")
  expect(wide.lines.map((line) => line.naturalWidth)).toEqual([113])
})

test("a SPACE run's trailing padding precedes its later authored WBR", () => {
  const { compiled } = compile(
    'alpha<i style="padding-inline-start:2px"><wbr></i><b style="padding-inline-end:7px"> </b><i style="padding-inline-start:4px"><wbr></i>beta',
  )
  const result = breakParagraphOnce(compiled.items, 63, { tolerance: 1 })
  if (!result.ok) throw new Error("lost the exact later choice")
  expect(result.lines.map((line) => line.naturalWidth)).toEqual([63, 40])
  expect(result.lines.map((line) => line.spaceCount)).toEqual([0, 0])
})

test("anchor padding before an authored BR cannot move past a later WBR", () => {
  const { block, compiled } = compile(
    'alpha<i style="padding-inline-start:2px"><wbr id="first"></i><b style="padding-inline-start:7px"> </b><i style="padding-inline-start:4px"><wbr id="second"></i><br>beta',
  )
  const result = breakParagraph(compiled.items, 56)
  if (!result.ok) throw new Error("unbreakable anchored forced line")
  expect(result.lines.map((line) => line.naturalWidth)).toEqual([52, 11, 40])
  const selected = compiled.breakRuns!.get(result.lines[0]!.end)!
  const run = block.runs[selected]!
  if (run.kind !== "break") throw new Error("missing authored break")
  expect(run.sourceElement.id).toBe("first")
})
