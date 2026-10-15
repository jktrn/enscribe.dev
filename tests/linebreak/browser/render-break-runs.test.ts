import { afterEach, expect, test } from "vitest"
import { ATTRIBUTES } from "@linebreak/attributes"
import { type InlineRun, runEdgeWidths } from "@linebreak/dom/extract"
import { renderLines } from "@linebreak/dom/render"
import { breakParagraph } from "@linebreak/layout/breaker"
import { compileBlock } from "@linebreak/layout/compile"
import { createMetrics } from "@linebreak/text"
import { source } from "./support/content"

const pair = '<i id="left" style="padding-inline-start:2px;padding-inline-end:2px"><wbr id="first"></i><b id="right" style="padding-inline-start:3px;padding-inline-end:3px"><wbr id="second"></b>'
const typeset = (html: string, width: number) => {
  const { host, block } = source(html)
  const metrics = createMetrics({ measure: (text) => text.length * 10 })
  const compiled = compileBlock({ block, locale: "en", baseFont: metrics.font,
    metricsFor: () => metrics, edgesFor: (run: InlineRun) => runEdgeWidths(block, run) })
  if (!compiled.ok) throw new Error(compiled.reason)
  const result = breakParagraph(compiled.items, width)
  if (!result.ok) throw new Error("No repeated-break layout")
  const layout = { lines: result.lines, target: width, fits: null, letterfit: null,
    breakRuns: compiled.breakRuns }
  const rendered = renderLines(host, block, layout, [])
  if (!rendered) throw new Error("Renderer declined")
  return { host, layout, rendered }
}

afterEach(() => document.body.replaceChildren())

test.each([
  [54, [54, 46], 1],
  [60, [60, 40], 0],
] as const)("the selected same-offset WBR owns the correct wrappers at width%i", (width, widths, rightLine) => {
  const { host, layout, rendered } = typeset(`alpha${pair}beta`, width)
  expect(layout.lines.map((line) => line.naturalWidth)).toEqual(widths)
  expect(rendered[0]!.querySelector("#first")).not.toBeNull()
  expect(rendered[rightLine]!.querySelector("#second")).not.toBeNull()
  expect(rendered[1 - rightLine]!.querySelector("#second")).toBeNull()
  for (const id of ["first", "second", "left", "right"])
    expect(host.querySelectorAll(`#${id}`)).toHaveLength(1)
  expect(host.textContent).toBe("alphabeta")
})

test("zero-text ancestors split their edges and ID at the selected run", () => {
  const { host, rendered, layout } = typeset(
    `alpha<u id="shared" style="padding-inline-start:1px;padding-inline-end:1px">${pair}</u>beta`, 55,
  )
  expect(layout.lines.map((line) => line.naturalWidth)).toEqual([55, 47])
  const first = rendered[0]!.querySelector("u")!
  const second = rendered[1]!.querySelector("u")!
  expect(first.hasAttribute(ATTRIBUTES.fragmentStart)).toBe(true)
  expect(first.hasAttribute(ATTRIBUTES.fragmentEnd)).toBe(false)
  expect(second.hasAttribute(ATTRIBUTES.fragmentStart)).toBe(false)
  expect(second.hasAttribute(ATTRIBUTES.fragmentEnd)).toBe(true)
  expect(host.querySelectorAll("#shared")).toHaveLength(1)
  expect(rendered[1]!.querySelector("#right")).not.toBeNull()
})

test("forced endpoint at run zero retains exactly one authored BR", () => {
  const { host, rendered } = typeset('<br id="first">alpha<br id="last">', 60)
  expect(rendered).toHaveLength(2)
  expect(rendered[0]!.querySelectorAll("br")).toHaveLength(1)
  expect(rendered[1]!.querySelectorAll("br")).toHaveLength(1)
  expect(host.querySelectorAll("#first")).toHaveLength(1)
  expect(host.querySelectorAll("#last")).toHaveLength(1)
})

test.each([52, 300])("an anchor after a chosen WBR survives its tied source offset at width%i", (width) => {
  const { host, rendered } = typeset(
    'alpha<i style="padding-inline-start:2px"><wbr id="first"></i> <b id="anchor" style="padding-inline-start:7px"> </b><i style="padding-inline-start:4px"><wbr id="second"></i>beta', width,
  )
  const owner = width === 52 ? 1 : 0
  expect(rendered[owner]!.querySelector("#anchor")).not.toBeNull()
  expect(host.querySelectorAll("#anchor")).toHaveLength(1)
  expect(host.textContent).toBe("alpha beta")
})
