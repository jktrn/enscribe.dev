import { afterEach, expect, test } from "vitest"
import { appendLine } from "@linebreak/dom/render-content"
import { renderLines } from "@linebreak/dom/render"
import { runEdgeWidths, type InlineRun } from "@linebreak/dom/extract"
import { breakParagraph } from "@linebreak/layout/breaker"
import { compileBlock } from "@linebreak/layout/compile"
import { createMetrics } from "@linebreak/text"
import { line, render, source } from "./support/content"

afterEach(() => document.body.replaceChildren())

test.each([
  "a\ud800\udc00b",
  "a\udbff\udfffb",
  "a\ue000b",
  "a\udc00b",
  "a\udfffb",
  "a\ud800b",
  "a\udbffb",
])("tracking counts code points at UTF-16 boundaries for %s", (text) => {
  const { host, block } = source(text)
  const planned = { ...line(0, text.length), spaceCount: 0, naturalWidth: 100 }
  const rendered = renderLines(
    host,
    block,
    {
      lines: [planned],
      target: 200,
      fits: null,
      letterfit: { lines: [{ gain: 6, shrink: 0 }], inherited: 0 },
    },
    [],
  )!
  expect(rendered[0]!.style.letterSpacing).toBe("2px")
  expect(rendered[0]!.style.wordSpacing).toBe("-2px")
  expect(rendered[0]!.textContent).toBe(text)
})

test("tracking excludes actual atoms while counting authored object-replacement glyphs", () => {
  const { host, block } = source('ab\uFFFC<img width="10"><img width="10">cd')
  const planned = { ...line(0, block.text.length), spaceCount: 0 }
  const rendered = renderLines(
    host,
    block,
    {
      lines: [planned],
      target: 200,
      fits: null,
      letterfit: { lines: [{ gain: 10, shrink: 0 }], inherited: 0 },
    },
    [],
  )!
  expect(rendered[0]!.style.letterSpacing).toBe("2px")
  expect(rendered[0]!.querySelectorAll("img")).toHaveLength(2)
  expect(rendered[0]!.textContent).toBe("ab\uFFFCcd")
})

test("each tracked line counts only its own text and atoms", () => {
  const { host, block } = source('ab<img id="later" width="10"> cd')
  const rendered = renderLines(
    host,
    block,
    {
      lines: [
        { ...line(0, 2, "none"), spaceCount: 0 },
        line(2, block.text.length),
      ],
      target: 200,
      fits: null,
      letterfit: {
        lines: [
          { gain: 4, shrink: 0 },
          { gain: 4, shrink: 0 },
        ],
        inherited: 0,
      },
    },
    [],
  )!
  expect(rendered.map((span) => span.style.letterSpacing)).toEqual([
    "2px",
    "2px",
  ])
  expect(rendered[0]!.querySelector("img")).toBeNull()
  expect(rendered[1]!.querySelectorAll("#later")).toHaveLength(1)
  expect(host.textContent).toBe("ab cd")
})

test("whitespace-only wrappers at a chosen gap retain their identity and both edges", () => {
  const { host, block } = source(
    'alpha<i id="gap" style="padding-inline-start:3px;padding-inline-end:7px"> </i>beta',
  )
  const rendered = render(host, block, [line(0, 5, "space"), line(6, 10)])!
  expect(host.querySelectorAll("#gap")).toHaveLength(1)
  const gap = rendered[0]!.querySelector("#gap")!
  expect(gap).not.toBeNull()
  expect(gap.hasAttribute("data-linebreak-fragment-start")).toBe(true)
  expect(gap.hasAttribute("data-linebreak-fragment-end")).toBe(true)
  expect(host.textContent).toBe("alpha beta")
})

test("a wrapper beginning with trimmed whitespace keeps its leading edge before the break", () => {
  const { host, block } = source(
    'alpha<em id="next"><b data-linebreak-decoration aria-hidden="true">lead</b> beta</em>',
  )
  const rendered = render(host, block, [line(0, 5, "space"), line(6, 10)])!
  expect(rendered[0]!.querySelector("#next")?.textContent).toBe("lead")
  expect(rendered[1]!.querySelector("em")?.textContent).toBe("beta")
  expect(host.querySelectorAll("#next")).toHaveLength(1)
  expect(
    rendered[0]!
      .querySelector("em")
      ?.hasAttribute("data-linebreak-fragment-start"),
  ).toBe(true)
})

test("a trailing whitespace fragment retains its closing edge before the break", () => {
  const { host, block } = source(
    '<em id="before" style="padding-inline-end:7px">alpha <b data-linebreak-decoration data-linebreak-decoration-position="after" aria-hidden="true">trail</b></em>beta',
  )
  const rendered = render(host, block, [line(0, 5, "space"), line(6, 10)])!
  expect(rendered[0]!.querySelector("em")?.textContent).toBe("alphatrail")
  expect(
    rendered[0]!
      .querySelector("em")
      ?.hasAttribute("data-linebreak-fragment-end"),
  ).toBe(true)
  expect(rendered[1]!.querySelector("em")).toBeNull()
  expect(host.querySelectorAll("#before")).toHaveLength(1)
  expect(host.querySelectorAll("[data-linebreak-decoration]")).toHaveLength(1)
})

test("trimmed first-child whitespace still carries a parent's leading decoration", () => {
  const { host, block } = source(
    'alpha<em id="parent"><b data-linebreak-decoration aria-hidden="true">lead</b><i> </i>beta</em>',
  )
  const rendered = render(host, block, [line(0, 5, "space"), line(6, 10)])!
  expect(rendered[0]!.querySelector("#parent")?.textContent).toBe("lead")
  expect(rendered[1]!.querySelector("em")?.textContent).toBe("beta")
  expect(host.querySelectorAll("#parent")).toHaveLength(1)
  expect(host.querySelectorAll("[data-linebreak-decoration]")).toHaveLength(1)
})

test.each([
  "<i> </i>beta",
  " <i>beta</i>",
])("leading wrapper width survives separate child runs: %s", (children) => {
  const { block } = source(
    `alpha<em style="padding-inline-start:3px">${children}</em>`,
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
  const result = breakParagraph(compiled.items, 60)
  if (!result.ok) throw new Error("Cannot compose wrapper edges")
  expect(result.lines.map((line) => line.naturalWidth)).toEqual([53, 40])
})

test("rendering a later source interval skips earlier trailing anchors", () => {
  const { block } = source('alpha<i id="earlier"> </i>beta')
  const target = document.createElement("span")
  expect(appendLine(target, block, line(6, 10), 0)).not.toBeNull()
  expect(target.textContent).toBe("beta")
  expect(target.querySelector("#earlier")).toBeNull()
})
