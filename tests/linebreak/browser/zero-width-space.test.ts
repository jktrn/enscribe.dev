import { afterEach, expect, test } from "vitest"
import { runEdgeWidths, type InlineRun } from "@linebreak/dom/extract"
import { renderLines } from "@linebreak/dom/render"
import { breakParagraph, breakParagraphOnce } from "@linebreak/layout"
import { compileBlock } from "@linebreak/layout/compile"
import { createMetrics } from "@linebreak/text"
import { source } from "./support/content"

const metrics = createMetrics({
  measure: (text) => text.replace(/\u200b/gu, "").length * 10,
})
afterEach(() => document.body.replaceChildren())

const compose = (html: string, width: number) => {
  const { host, block } = source(html)
  const original = host.textContent
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    edgesFor: (run) => runEdgeWidths(block, run as InlineRun),
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraphOnce(compiled.items, width, { tolerance: 1 })
  if (!layout.ok) throw new Error("Expected a feasible zero-width-space layout")
  const rendered = renderLines(host, block, {
    lines: layout.lines, target: width, fits: null, letterfit: null,
  }, [])
  if (!rendered) throw new Error("Expected rendered lines")
  expect(host.textContent).toBe(original)
  return { host, lines: rendered.map((line) => line.textContent), layout }
}

test.each([
  "alpha\u200b beta",
  'alpha<span id="marker">\u200b</span> beta',
  'alpha<span id="marker">\u200b</span><span>\u200b</span> beta',
])("a selected zero-width break trims the next line while preserving copy text: %s", (html) => {
  const result = compose(html, 50)
  expect(result.lines[1]).toBe("beta")
  expect(result.lines[0]).toBe(html.includes("</span><span>") ? "alpha\u200b\u200b" : "alpha\u200b")
  if (html.includes('id="marker"')) {
    expect(result.host.querySelectorAll("#marker")).toHaveLength(1)
  }
})

test("a different selected gap preserves a marker-separated leading space", () => {
  expect(compose("alpha \u200b beta", 50).lines).toEqual(["alpha", "\u200b beta"])
  expect(compose("alpha \u200b beta", 60).lines).toEqual(["alpha \u200b", "beta"])
})

test("a marker wrapper keeps both padding edges before its selected break", () => {
  const result = compose('alpha<i id="marker" style="padding-inline-start:3px;padding-inline-end:7px">\u200b</i> beta', 60)
  expect(result.lines).toEqual(["alpha\u200b", "beta"])
  expect(result.layout.lines.map((line) => line.naturalWidth)).toEqual([60, 40])
  expect(result.host.querySelectorAll("#marker")).toHaveLength(1)
  const marker = result.host.querySelector("#marker")!
  expect(marker.hasAttribute("data-linebreak-fragment-start")).toBe(true)
  expect(marker.hasAttribute("data-linebreak-fragment-end")).toBe(true)
})

test("padding that cannot fit stays with its marker in the overfull fallback", () => {
  const { host, block } = source('alpha<i id="marker" style="padding-inline-start:3px">\u200b</i> beta')
  const compiled = compileBlock({
    block, baseFont: metrics.font, locale: "en", metricsFor: () => metrics,
    edgesFor: (run) => runEdgeWidths(block, run as InlineRun),
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  expect(breakParagraphOnce(compiled.items, 50, { tolerance: 1 }).ok).toBe(false)
  const layout = breakParagraph(compiled.items, 50)
  if (!layout.ok) throw new Error("Expected the normal overfull fallback")
  expect(layout.pass).toBe("forced")
  expect(layout.lines.map((line) => line.naturalWidth)).toEqual([53, 40])
  const lines = renderLines(host, block, {
    lines: layout.lines, target: 50, fits: null, letterfit: null,
  }, [])!
  expect(lines.map((line) => line.textContent)).toEqual(["alpha\u200b", "beta"])
  expect(lines[0]!.querySelector("#marker")).not.toBeNull()
  expect(host.textContent).toBe(block.text)
})
