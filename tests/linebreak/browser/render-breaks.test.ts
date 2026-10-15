import { afterEach, describe, expect, test } from "vitest"
import { trimmedSlice } from "@linebreak/dom/render-content"
import { texDefaults } from "@linebreak/layout/policy"
import { runEdgeWidths, type InlineRun } from "@linebreak/dom/extract"
import { breakParagraph } from "@linebreak/layout/breaker"
import { compileBlock } from "@linebreak/layout/compile"
import { createMetrics } from "@linebreak/text"
import { line, render, source } from "./support/content"

afterEach(() => document.body.replaceChildren())

describe("authored blank lines", () => {
  test("a trailing WBR cannot introduce a blank line to evade final-hyphen demerits", () => {
    const { host, block } = source('a\u00adb<wbr id="trailing">')
    const metrics = createMetrics({
      font: "16px serif",
      measure: (text) =>
        Array.from(text).reduce(
          (width, char) =>
            width +
            (char === "a" ? 6 : char === "b" ? 10 : char === "-" ? 4 : 0),
          0,
        ),
    })
    const compiled = compileBlock({
      block,
      baseFont: metrics.font,
      locale: "en",
      metricsFor: () => metrics,
    })
    if (!compiled.ok) throw new Error(compiled.reason)
    const layout = breakParagraph(compiled.items, 10, {
      policy: { ...texDefaults, tolerance: 0 },
    })
    if (!layout.ok) throw new Error("Cannot lay out soft hyphen")
    expect(
      layout.lines.map((line) => [line.naturalWidth, line.breakKind]),
    ).toEqual([
      [10, "hyphen"],
      [10, "end"],
    ])
    expect(render(host, block, layout.lines)).toHaveLength(2)
    expect(host.querySelectorAll("#trailing")).toHaveLength(1)
  })

  test.each([
    ["alpha<br><br>beta", 3, 2],
    ["<br>alpha", 2, 1],
    ["alpha<br>", 1, 1],
    ["alpha<br><br>", 2, 2],
    ["<br>", 1, 1],
    ["<br><br>", 2, 2],
    ["alpha<wbr><br><br>beta", 3, 2],
  ] as const)("preserves the visual lines and BR elements in %s", (html, count, breaks) => {
    const { host, block } = source(html)
    const metrics = createMetrics({
      font: "16px serif",
      measure: (text) => text.length * 10,
    })
    const compiled = compileBlock({
      block,
      baseFont: metrics.font,
      locale: "en",
      metricsFor: () => metrics,
    })
    if (!compiled.ok) throw new Error(compiled.reason)
    const layout = breakParagraph(compiled.items, 300)
    if (!layout.ok) throw new Error("Cannot lay out authored breaks")
    expect(layout.lines).toHaveLength(count)
    const rendered = render(host, block, layout.lines)
    expect(rendered).toHaveLength(count)
    expect(host.querySelectorAll("br")).toHaveLength(breaks)
    expect(host.textContent).toBe(html.replace(/<[^>]*>/g, ""))
    expect(
      [...host.querySelectorAll("[data-linebreak-line]")].every((node) =>
        node.hasChildNodes(),
      ),
    ).toBe(true)
  })
})

test("authored breaks retain identifiers, inline wrappers, and decorations", () => {
  const { host, block } = source(
    '<em id="wrapper">alpha<br id="authored-break" class="pause"><i data-linebreak-decoration data-linebreak-decoration-position="after" aria-hidden="true">end</i></em>beta',
  )
  const rendered = render(host, block, [line(0, 5, "forced"), line(6, 10)])!
  expect(rendered).toHaveLength(2)
  const br = host.querySelector("#authored-break")!
  expect(br.className).toBe("pause")
  expect(br.parentElement?.id).toBe("wrapper")
  expect(host.querySelectorAll("br")).toHaveLength(1)
  expect(br.parentElement?.hasAttribute("data-linebreak-fragment-end")).toBe(
    true,
  )
  expect(br.nextSibling?.textContent).toBe("end")
})

test.each([
  ['<em style="padding-inline-end:7px">alpha<br></em>beta', [57, 40]],
  [
    '<em style="padding-inline-start:3px;padding-inline-end:7px"><br></em>beta',
    [10, 40],
  ],
  [
    '<em style="padding-inline-start:3px;padding-inline-end:7px">alpha<br><br></em>beta',
    [53, 7, 40],
  ],
] as const)("charges wrapper edges to their authored break line in %s", (html, widths) => {
  const { host, block } = source(html)
  const metrics = createMetrics({
    font: "16px serif",
    measure: (text) => text.length * 10,
  })
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    edgesFor: (run) => runEdgeWidths(block, run as InlineRun),
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 300)
  if (!layout.ok) throw new Error("Cannot lay out decorated breaks")
  expect(layout.lines.map((line) => line.naturalWidth)).toEqual(widths)
  expect(render(host, block, layout.lines)).toHaveLength(widths.length)
  expect(host.querySelectorAll("br")).toHaveLength(
    (html.match(/<br>/gu) ?? []).length,
  )
})

test("empty forced slices never consume neighboring newlines", () => {
  const { block } = source("<br><br>alpha<br><br>")
  expect(trimmedSlice(block, line(1, 1, "forced"))).toEqual({
    sliceStart: 1,
    sliceEnd: 1,
  })
  expect(trimmedSlice(block, line(8, 8, "forced"))).toEqual({
    sliceStart: 8,
    sliceEnd: 8,
  })
})

test("authored WBR identifiers and classes survive at paragraph and line boundaries", () => {
  const { host, block } = source(
    '<wbr id="leading"><em>alpha<wbr id="middle" class="hint">beta</em><wbr id="trailing">',
  )
  const rendered = render(host, block, [line(0, 5, "none"), line(5, 9)])!
  for (const id of ["leading", "middle", "trailing"]) {
    expect(host.querySelectorAll(`#${id}`)).toHaveLength(1)
  }
  expect(host.querySelector("#middle")?.className).toBe("hint")
  expect(rendered[0]!.querySelector("#middle")?.parentElement?.localName).toBe(
    "em",
  )
  expect(rendered[1]!.querySelector("#middle")).toBeNull()
  expect(host.textContent).toBe("alphabeta")
})

test("nonbreaking WBR wrapper edges remain measurable at paragraph boundaries", () => {
  const { host, block } = source(
    '<em style="padding-inline-start:3px;padding-inline-end:7px"><wbr id="leading"></em>alpha<em style="padding-inline-start:2px;padding-inline-end:5px"><wbr id="trailing"></em>',
  )
  const metrics = createMetrics({
    font: "16px serif",
    measure: (text) => text.length * 10,
  })
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    edgesFor: (run) => runEdgeWidths(block, run as InlineRun),
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 300)
  if (!layout.ok) throw new Error("Cannot lay out decorated WBRs")
  expect(layout.lines.map((line) => line.naturalWidth)).toEqual([67])
  expect(render(host, block, layout.lines)).toHaveLength(1)
  expect(host.querySelectorAll("em")).toHaveLength(2)
  expect(host.querySelectorAll("wbr")).toHaveLength(2)
})

