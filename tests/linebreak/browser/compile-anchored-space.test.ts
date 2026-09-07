import { afterEach, expect, test } from "vitest"
import { type InlineRun, runEdgeWidths } from "@linebreak/dom/extract"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraph } from "@linebreak/layout/breaker"
import { flexBetween } from "@linebreak/layout/flex"
import { createMetrics } from "@linebreak/text/segments"
import { extract } from "./support/extraction"

const metrics = createMetrics({
  font: "16px serif",
  measure: (text) => text.length * 10,
})
afterEach(() => document.body.replaceChildren())

test("a whitespace-only wrapper cannot reopen a nowrap boundary after an atom", () => {
  const block = extract('<span data-nowrap><img><i id="gap"> </i>beta</span>')
  expect(block.runs.some((run) => run.kind === "anchor")).toBe(true)
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    atomWidth: () => 50,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 60)
  if (!layout.ok) throw new Error("unbreakable")
  expect(layout.lines.map((line) => line.naturalWidth)).toEqual([100])
})

test("a wrapping whitespace-only wrapper can separate an atom inside nowrap", () => {
  const block = extract(
    '<span data-nowrap><img><i data-wrap id="gap"> </i>beta</span>',
  )
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    atomWidth: () => 50,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 60)
  if (!layout.ok) throw new Error("unbreakable")
  expect(
    layout.lines.map((line) => [line.breakKind, line.naturalWidth]),
  ).toEqual([
    ["space", 50],
    ["end", 40],
  ])
})

test("a later suppressed SHY does not close the boundary before its nowrap run", () => {
  const block = extract("<img><span data-nowrap>a\u00adb</span>")
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    atomWidth: () => 50,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 60)
  if (!layout.ok) throw new Error("unbreakable")
  expect(
    layout.lines.map((line) => [line.breakKind, line.naturalWidth]),
  ).toEqual([
    ["none", 50],
    ["end", 20],
  ])
})

test("an interior suppressed SHY leaves following wrapping space available", () => {
  const block = extract("<span data-nowrap>alpha\u00ad</span> beta")
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 60)
  if (!layout.ok) throw new Error("unbreakable")
  expect(
    layout.lines.map((line) => [line.breakKind, line.naturalWidth]),
  ).toEqual([
    ["space", 50],
    ["end", 40],
  ])
})

test("a chosen WBR discards a following space even inside a nowrap span", () => {
  const block = extract("<span data-nowrap>alpha<wbr> beta</span>")
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 60)
  if (!layout.ok) throw new Error("unbreakable")
  expect(
    layout.lines.map((line) => [line.sourceEnd, line.naturalWidth]),
  ).toEqual([
    [5, 50],
    [10, 40],
  ])
})

test.each([
  { tag: "br", widths: [6, 40] },
  { tag: "wbr", widths: [46] },
])("pending whitespace-wrapper padding stays positive at a leading $tag", ({
  tag,
  widths,
}) => {
  const block = extract(
    `<i style="padding-inline-start:3px;padding-inline-end:3px"> </i><${tag}>beta`,
  )
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    edgesFor: (run: InlineRun) => runEdgeWidths(block, run),
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 60)
  if (!layout.ok) throw new Error("unbreakable")
  expect(layout.lines.map((line) => line.naturalWidth)).toEqual(widths)
})

test("a WBR exception to nowrap does not enable a following soft hyphen", () => {
  const block = extract("<span data-nowrap>alpha<wbr>\u00adalpha</span>")
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 60)
  if (!layout.ok) throw new Error("unbreakable")
  expect(
    layout.lines.map((line) => [line.breakKind, line.naturalWidth]),
  ).toEqual([
    ["none", 50],
    ["end", 50],
  ])
})

test.each([
  "alpha <wbr>beta",
  "alpha <wbr><wbr>beta",
  'alpha<i style="padding-inline-start:2px;padding-inline-end:2px"> </i><wbr><b style="padding-inline-start:3px;padding-inline-end:3px"> </b>beta',
  'alpha<i style="padding-inline-start:2px;padding-inline-end:2px"> </i><wbr><b style="padding-inline-start:3px;padding-inline-end:3px"> </b><wbr>beta',
])("a chosen WBR trims preceding space width and elasticity: %s", (html) => {
  const block = extract(html)
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    edgesFor: (run: InlineRun) => runEdgeWidths(block, run),
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const padded = html.includes("padding")
  const layout = breakParagraph(compiled.items, padded ? 54 : 60)
  if (!layout.ok) throw new Error("unbreakable")
  expect(
    layout.lines.map((line) => [
      line.breakKind,
      line.naturalWidth,
      line.sourceStart,
      line.sourceEnd,
      line.spaceCount,
    ]),
  ).toEqual([
    ["space", padded ? 54 : 50, 0, 6, 0],
    ["end", padded ? 46 : 40, 6, 10, 0],
  ])
  const wide = breakParagraph(compiled.items, 300)
  if (!wide.ok) throw new Error("unbreakable")
  expect(wide.lines).toHaveLength(1)
  expect(wide.lines[0]?.naturalWidth).toBe(padded ? 110 : 100)
  const spaces = compiled.items
    .filter((item) => item.kind === "glue")
    .filter((item) => item.width !== 0)
  expect(spaces).toMatchObject([
    { kind: "glue", width: 10, stretch: 5, source: { start: 5, end: 6 } },
  ])
  expect(spaces[0]?.shrink).toBeCloseTo(10 / 3, 12)
})

test("a forced break ends trailing-space ownership before a later WBR", () => {
  const block = extract("alpha <wbr><br><wbr>beta")
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 60)
  if (!layout.ok) throw new Error("unbreakable")
  expect(layout.lines.map((line) => line.naturalWidth)).toEqual([50, 40])
  expect(layout.lines.map((line) => line.breakKind)).toEqual(["forced", "end"])
})

test.each([
  false,
  true,
])("WBR-only wrappers keep their own edges at either chosen space endpoint (nowrap=%s)", (nowrap) => {
  const body =
    'alpha <i style="padding-inline-start:2px;padding-inline-end:2px"><wbr></i><b style="padding-inline-start:3px;padding-inline-end:3px"><wbr></b>beta'
  const block = extract(nowrap ? `<span data-nowrap>${body}</span>` : body)
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    edgesFor: (run: InlineRun) => runEdgeWidths(block, run),
    protrude: true,
    track: 0.2,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const first = breakParagraph(compiled.items, 54)
  const narrow = breakParagraph(compiled.items, 60)
  const wide = breakParagraph(compiled.items, 300)
  if (!first.ok || !narrow.ok || !wide.ok) throw new Error("unbreakable")
  expect(
    first.lines.map((line) => [line.naturalWidth, line.spaceCount]),
  ).toEqual([
    [54, 0],
    [46, 0],
  ])
  expect(
    narrow.lines.map((line) => [line.naturalWidth, line.sourceEnd]),
  ).toEqual([
    [60, 6],
    [40, 10],
  ])
  expect(wide.lines.map((line) => line.naturalWidth)).toEqual([110])
  // Decoration boxes receive neither letter-tracking capacity nor glyph hangs.
  const fixed = compiled.items.flatMap((item, index) =>
    item.kind === "box" && item.source?.start === item.source?.end
      ? [index]
      : [],
  )
  expect(
    fixed.reduce(
      (width, index) =>
        width +
        (
          compiled.items[index] as Extract<
            (typeof compiled.items)[number],
            { kind: "box" }
          >
        ).width,
      0,
    ),
  ).toBe(10)
  if (!compiled.tracking) throw new Error("expected tracking")
  for (const index of fixed) {
    expect(compiled.hangs?.start[index]).toBe(0)
    expect(compiled.hangs?.end[index]).toBe(0)
    expect(flexBetween(compiled.tracking, index, index + 1)).toEqual({
      stretch: 0,
      shrink: 0,
    })
  }
})
