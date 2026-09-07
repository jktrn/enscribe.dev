import { afterEach, expect, test } from "vitest"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraph } from "@linebreak/layout/breaker"
import { createMetrics } from "@linebreak/text/segments"
import { renderLines } from "@linebreak/dom/render"
import { source } from "./support/content"

const metrics = createMetrics({
  font: "16px serif",
  measure: (text) => text.length * 10,
})
const render = (html: string, width = 300) => {
  const { host, block } = source(html)
  const compiled = compileBlock({
    block,
    locale: "en",
    baseFont: metrics.font,
    metricsFor: () => metrics,
    atomWidth: () => 10,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, width)
  if (!layout.ok) throw new Error("unbreakable")
  const rendered = renderLines(
    host,
    block,
    {
      lines: layout.lines,
      target: width,
      fits: null,
      letterfit: null,
      breakRuns: compiled.breakRuns,
    },
    [],
  )
  if (!rendered) throw new Error("unrenderable")
  return { host, rendered }
}
afterEach(() => document.body.replaceChildren())

test.each([
  'alpha<i id="empty"><wbr></i>beta',
  'alpha<i id="empty"><b><wbr></b></i>beta',
])("zero-source fragments explicitly include hidden opportunity descendants: %s", (html) => {
  const { host } = render(html)
  expect(
    host.querySelector("#empty")!.getAttribute("data-linebreak-fragment"),
  ).toBe("empty")
})

test.each([
  '<i id="content">alpha<wbr>beta</i>',
  'alpha<i id="content"> </i>beta',
  '<i id="content"><img></i>alpha',
])("text and atomic source prevent the empty-fragment pseudo rule: %s", (html) => {
  const { host } = render(html)
  expect(
    host.querySelector("#content")!.getAttribute("data-linebreak-fragment"),
  ).toBe("")
})

test.each([
  "<i><br></i>",
  "<i><br><br></i>",
  "<i><wbr><br>alpha</i>",
])("forced lines retain BR nodes and independently mark partial empty fragments: %s", (html) => {
  const { host, rendered } = render(html)
  expect(host.querySelectorAll("br")).toHaveLength(
    (html.match(/<br>/g) ?? []).length,
  )
  expect(
    rendered[0]!.querySelector("i")!.getAttribute("data-linebreak-fragment"),
  ).toBe("empty")
  if (html.includes("alpha")) {
    expect(
      rendered[1]!.querySelector("i")!.getAttribute("data-linebreak-fragment"),
    ).toBe("")
    expect(rendered[1]!.textContent).toBe("alpha")
  }
})
