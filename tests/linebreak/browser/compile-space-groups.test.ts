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
const scale = {
  steps: [
    { pct: 99, ratio: 0.99 },
    { pct: 101, ratio: 1.01 },
  ],
}
const opportunity = (id: string, width: number) =>
  `<i style="padding-inline-start:${width}px"><wbr id="${id}"></i>`
const compile = (html: string) => {
  const block = extract(html)
  const result = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    edgesFor: (run: InlineRun) => runEdgeWidths(block, run),
    protrude: true,
    track: 0.2,
    scaleFor: () => scale,
  })
  if (!result.ok || !result.hangs || !result.tracking || !result.expansion)
    throw new Error("unmeasurable")
  return { block, result }
}
const solve = (compiled: ReturnType<typeof compile>, width: number) => {
  const { result } = compiled
  const layout = breakParagraph(result.items, width, { hangs: result.hangs! })
  if (!layout.ok) throw new Error("unbreakable")
  return layout.lines
}

afterEach(() => document.body.replaceChildren())

test.each([
  false,
  true,
])("only the selected continuation decoration blocks a following opening quote (nowrap=%s)", (nowrap) => {
  const body = `alpha ${opportunity("first", 4)}${opportunity("second", 6)}“beta`
  const compiled = compile(nowrap ? `<span data-nowrap>${body}</span>` : body)
  const first = solve(compiled, 54)
  const second = solve(compiled, 60)
  expect(first.map((line) => [line.naturalWidth, line.hangStart])).toEqual([
    [54, 0],
    [56, 0],
  ])
  expect(second[1]!.hangStart).toBeGreaterThan(0)
  expect(second[1]!.naturalWidth + second[1]!.hangStart).toBe(50)
  expect(
    solve(compiled, 300).map((line) => [line.naturalWidth, line.hangStart]),
  ).toEqual([[120, 0]])
})

test.each([
  false,
  true,
])("later decoration insertion preserves endpoint identities and feature credit indices (nowrap=%s)", (nowrap) => {
  const body = `alpha ${opportunity("first", 0)}${opportunity("second", 10)}beta`
  const compiled = compile(nowrap ? `<span data-nowrap>${body}</span>` : body)
  for (const [width, id, expected] of [
    [50, "first", [50, 50]],
    [60, "second", [60, 40]],
  ] as const) {
    const lines = solve(compiled, width)
    expect(lines.map((line) => line.naturalWidth)).toEqual(expected)
    const runIndex = compiled.result.breakRuns!.get(lines[0]!.end)!
    const run = compiled.block.runs[runIndex]!
    if (run.kind !== "break") throw new Error("missing authored break")
    expect(run.sourceElement.id).toBe(id)
  }
  const glyph = compiled.result.items.findIndex(
    (item) =>
      item.kind === "box" && item.source?.start === 6 && item.source.end === 10,
  )
  expect(glyph).toBeGreaterThan(0)
  expect(flexBetween(compiled.result.tracking!, glyph, glyph + 1)).toEqual({
    stretch: 8,
    shrink: 8,
  })
  const expansion = flexBetween(compiled.result.expansion!, glyph, glyph + 1)
  expect(expansion.stretch).toBeCloseTo(0.4, 12)
  expect(expansion.shrink).toBeCloseTo(0.4, 12)
  expect(solve(compiled, 300)[0]!.naturalWidth).toBe(110)
})

test.each([
  false,
  true,
])("the middle choice in a longer chain keeps its own quote-padding barrier (nowrap=%s)", (nowrap) => {
  const body = `alpha ${opportunity("first", 4)}${opportunity("second", 6)}${opportunity("third", 8)}“beta`
  const compiled = compile(nowrap ? `<span data-nowrap>${body}</span>` : body)
  const lines = solve(compiled, 60)
  expect(lines.map((line) => [line.naturalWidth, line.hangStart])).toEqual([
    [60, 0],
    [58, 0],
  ])
  const selected = compiled.result.breakRuns!.get(lines[0]!.end)!
  const run = compiled.block.runs[selected]!
  if (run.kind !== "break") throw new Error("missing authored break")
  expect(run.sourceElement.id).toBe("second")
})

test("separate source-space groups retain their own earlier and later WBR identities", () => {
  const compiled = compile(
    `alpha ${opportunity("first", 4)}${opportunity("second", 6)}beta<br>alpha ${opportunity("third", 0)}${opportunity("fourth", 10)}beta`,
  )
  expect(
    solve(compiled, 54).map((line) => [line.naturalWidth, line.breakKind]),
  ).toEqual([
    [54, "space"],
    [46, "forced"],
    [50, "space"],
    [50, "end"],
  ])
  const ids = [...compiled.result.breakRuns!.values()].map((index) => {
    const run = compiled.block.runs[index]!
    if (run.kind !== "break") throw new Error("missing authored break")
    return run.sourceElement.id
  })
  expect(ids).toEqual(["first", "second", "", "third", "fourth"])
})

test.each([
  false,
  true,
])("a zero-decoration earlier choice retains punctuation at the line end (nowrap=%s)", (nowrap) => {
  const body = `alpha. ${opportunity("first", 0)}${opportunity("second", 6)}beta`
  const compiled = compile(nowrap ? `<span data-nowrap>${body}</span>` : body)
  const first = solve(compiled, 53)
  const second = solve(compiled, 66)
  expect(first.map((line) => [line.naturalWidth, line.hangEnd])).toEqual([
    [53, 7],
    [46, 0],
  ])
  expect(second.map((line) => [line.naturalWidth, line.hangEnd])).toEqual([
    [66, 0],
    [40, 0],
  ])
})

test("a sequence without any decoration box retains its earlier end-hang credit", () => {
  const compiled = compile(
    `alpha. ${opportunity("first", 0)}${opportunity("second", 0)}beta`,
  )
  expect(
    solve(compiled, 53).map((line) => [line.naturalWidth, line.hangEnd]),
  ).toEqual([
    [53, 7],
    [40, 0],
  ])
})

test("a middle choice whose signed margins cancel recovers its end punctuation", () => {
  const compiled = compile(
    `alpha. <i style="margin-inline-start:-4px"><wbr id="first"></i><i style="margin-inline-start:4px"><wbr id="second"></i>${opportunity("third", 6)}beta`,
  )
  const lines = solve(compiled, 53)
  expect(lines.map((line) => [line.naturalWidth, line.hangEnd])).toEqual([
    [53, 7],
    [46, 0],
  ])
  const selected = compiled.result.breakRuns!.get(lines[0]!.end)!
  const run = compiled.block.runs[selected]!
  if (run.kind !== "break") throw new Error("missing authored break")
  expect(run.sourceElement.id).toBe("second")
})
