import { afterEach, expect, test } from "vitest"
import { type InlineRun, runEdgeWidths } from "@linebreak/dom/extract"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraph } from "@linebreak/layout/breaker"
import { createMetrics } from "@linebreak/text/segments"
import { extract } from "./support/extraction"

const metrics = createMetrics({
  font: "16px serif",
  measure: (text) => text.length * 10,
})

const compile = (html: string) => {
  const block = extract(html)
  const result = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    edgesFor: (run: InlineRun) => runEdgeWidths(block, run),
  })
  if (!result.ok) throw new Error(result.reason)
  return { block, result }
}

afterEach(() => document.body.replaceChildren())

test.each([
  "alpha beta",
  "<wbr>alpha<wbr>",
])("paragraphs without selectable authored endpoints need no break map: %s", (html) => {
  expect(compile(html).result.breakRuns).toBeUndefined()
})

test("selected equal-offset opportunities retain their distinct authored run", () => {
  const { block, result } = compile(
    'alpha<i style="padding-inline-start:2px;padding-inline-end:2px"><wbr id="first"></i><b style="padding-inline-start:3px;padding-inline-end:3px"><wbr id="second"></b>beta',
  )
  for (const [width, expected] of [
    [54, "first"],
    [60, "second"],
  ] as const) {
    const layout = breakParagraph(result.items, width)
    if (!layout.ok) throw new Error("unbreakable")
    const selected = result.breakRuns?.get(layout.lines[0]!.end)
    if (selected === undefined) throw new Error("missing authored endpoint")
    const run = block.runs[selected]
    if (run?.kind !== "break") throw new Error("expected authored break")
    expect(run.sourceElement.id).toBe(expected)
    expect(run.start).toBe(5)
    expect(result.breakRuns?.get(layout.lines[1]!.end)).toBeUndefined()
  }
})

test.each([
  false,
  true,
])("relocated space endpoints retain both authored choices (nowrap=%s)", (nowrap) => {
  const body =
    'alpha <i style="padding-inline-start:2px;padding-inline-end:2px"><wbr id="first"></i><b style="padding-inline-start:3px;padding-inline-end:3px"><wbr id="second"></b>beta'
  const { block, result } = compile(
    nowrap ? `<span data-nowrap>${body}</span>` : body,
  )
  expect(result.breakRuns?.size).toBe(2)
  for (const [width, expected] of [
    [54, "first"],
    [60, "second"],
  ] as const) {
    const layout = breakParagraph(result.items, width)
    if (!layout.ok) throw new Error("unbreakable")
    const endpoint = layout.lines[0]!.end
    const selected = result.breakRuns?.get(endpoint)
    if (selected === undefined) throw new Error("missing relocated endpoint")
    const run = block.runs[selected]
    if (run?.kind !== "break") throw new Error("expected authored break")
    expect(run.sourceElement.id).toBe(expected)
    expect(run.start).toBe(6)
    expect(result.items[endpoint]?.kind).toBe("penalty")
    expect(layout.lines.map((line) => line.sourceStart)).toEqual([0, 6])
  }
})

test("forced endpoints include the first run and preserve a trailing authored BR", () => {
  const { block, result } = compile(
    '<br id="leading">alpha<br id="middle">beta<br id="trailing">',
  )
  const layout = breakParagraph(result.items, 100)
  if (!layout.ok) throw new Error("unbreakable")
  const selected = layout.lines.map((line) => {
    const index = result.breakRuns?.get(line.end)
    if (index === undefined) throw new Error("missing forced endpoint")
    const run = block.runs[index]
    if (run?.kind !== "break") throw new Error("expected authored break")
    return { index, id: run.sourceElement.id, forced: run.forced }
  })
  expect(selected).toEqual([
    { index: 0, id: "leading", forced: true },
    { index: 2, id: "middle", forced: true },
    { index: 4, id: "trailing", forced: true },
  ])
})
