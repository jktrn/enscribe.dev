import { afterEach, expect, test } from "vitest"
import {
  extractBlock,
  runEdgeWidths,
  type InlineRun,
} from "@linebreak/dom/extract"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraph } from "@linebreak/layout/breaker"
import { renderLines } from "@linebreak/dom/render"
import { createMetrics } from "@linebreak/text/segments"
import { breakAllowedAt } from "@linebreak/text/source"
import neighbours from "../fixtures/unicode-atomic-neighbours.json"

const metrics = createMetrics({
  font: "16px serif",
  measure: (text) => Array.from(text).length * 10,
})
afterEach(() => document.body.replaceChildren())

const compile = (html: string) => {
  const host = document.createElement("p")
  host.innerHTML = html
  document.body.append(host)
  const read = (element: Element) =>
    new Proxy(getComputedStyle(element), {
      get(style, property) {
        if (property === "whiteSpaceCollapse") return "collapse"
        if (property === "textWrapMode")
          return element
            .closest("[data-nowrap],[data-wrap]")
            ?.hasAttribute("data-nowrap")
            ? "nowrap"
            : "wrap"
        if (property === "display") return style.display || "inline"
        return Reflect.get(style, property)
      },
    })
  const extracted = extractBlock(host, read)
  if (!extracted.ok) throw new Error(extracted.reason)
  const block = extracted.block
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    atomWidth: (run) =>
      Number((run as InlineRun).sourceElement.getAttribute("width")),
    edgesFor: (run) => runEdgeWidths(block, run as InlineRun),
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const optional = compiled.items
    .filter((item) => item.kind === "penalty" && item.penalty === 0)
    .map((item) => item.source!.start)
  return { host, block, items: compiled.items, optional }
}

const compose = (html: string) => {
  const compiled = compile(html)
  const layout = breakParagraph(compiled.items, 70)
  if (!layout.ok) throw new Error("No atom layout")
  const rendered = renderLines(
    compiled.host,
    compiled.block,
    { lines: layout.lines, target: 70, fits: null, letterfit: null },
    [],
  )
  expect(rendered).not.toBeNull()
  return { ...compiled, lines: layout.lines }
}

test("atomic boxes permit both adjacent boundaries without losing source offsets", () => {
  const { optional, lines, host } = compose(
    'alpha<img width="50" id="atom">beta',
  )
  expect(optional).toEqual([5, 6])
  expect(
    lines.map((line) => [line.sourceStart, line.sourceEnd, line.naturalWidth]),
  ).toEqual([
    [0, 5, 50],
    [5, 6, 50],
    [6, 10, 40],
  ])
  expect(host.querySelectorAll("#atom")).toHaveLength(1)
  expect(host.textContent).toBe("alphabeta")
})

test("adjacent atoms and a zero-width atom do not introduce blank lines", () => {
  expect(compose('<img width="50"><img width="50">').lines).toHaveLength(2)
  expect(compose('alpha<img width="0" id="zero">beta').lines).toHaveLength(2)
})

test("authored glue and WBR remain the only opportunities at their own boundaries", () => {
  expect(compile('alpha <img width="50"> beta').optional).toEqual([])
  expect(compile('alpha<wbr><img width="50"><wbr>beta').optional).toEqual([
    5, 6,
  ])
  const edged = compose(
    'alpha<img width="50"><i style="padding-inline-end:7px"> </i>beta',
  )
  expect(edged.lines.map((line) => line.naturalWidth)).toEqual([50, 57, 40])
})

test("a disappearing space uses its own wrapping box after an atom", () => {
  const built = compose(
    '<span data-nowrap><img width="50"><em data-wrap> beta</em></span>',
  )
  expect(built.lines.map((line) => line.naturalWidth)).toEqual([50, 40])
  expect(built.host.textContent).toBe(" beta")
})

test("an earlier atomic restriction and later authored nowrap interval remain ordered", () => {
  const { block, optional } = compile(
    '<span data-nowrap><em data-wrap>alpha</em><img width="50"></span> beta <span data-nowrap>gamma delta</span>',
  )
  expect(block.breakRestrictions).toEqual([
    { start: 5, end: 6 },
    { start: 13, end: 23 },
  ])
  expect(optional).toEqual([])
  expect(breakAllowedAt(block.breakRestrictions, 5)).toBe(false)
  expect(breakAllowedAt(block.breakRestrictions, 6)).toBe(true)
  expect(breakAllowedAt(block.breakRestrictions, 17)).toBe(false)
})

test.each([
  ['<span data-nowrap>alpha<img width="50"><em data-wrap>beta</em></span>', []],
  [
    '<span data-nowrap><em data-wrap>alpha</em><img width="50"></span>beta',
    [6],
  ],
  [
    '<span data-wrap><em data-nowrap>alpha</em><img width="50">beta</span>',
    [5, 6],
  ],
  ['alpha<span data-nowrap><img width="50"></span>beta', [5, 6]],
] as const)("the nearest common ancestor controls atomic wrapping: %s", (html, expected) => {
  expect(compile(html).optional).toEqual(expected)
})

test("every Unicode 17 GL, WJ and ZWJ neighbour blocks atom breaks except CSS NBSP", () => {
  for (const row of neighbours.rows) {
    for (let code = row.start; code <= row.end; code += 1) {
      const char = String.fromCodePoint(code)
      const before = compile(`a${char}<img width="50">b`)
      const after = compile(`a<img width="50">${char}b`)
      expect(
        before.optional.includes(1 + char.length),
        `before U+${code.toString(16)}`,
      ).toBe(code === 0xa0)
      expect(after.optional.includes(2), `after U+${code.toString(16)}`).toBe(
        code === 0xa0,
      )
    }
  }
})
