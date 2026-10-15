import { describe, expect, test } from "bun:test"
import { compileBlock, type CompileContext } from "@linebreak/layout/compile"
import type { CompiledRun } from "@linebreak/layout/block"
import { compileRuns, createMetrics } from "@linebreak/text"
import type { Item } from "@linebreak/layout/items"
import { AFFINE } from "./support/measure"

const metrics = createMetrics({ measure: (text) => text.length * 10, font: "16px serif" })
const textRun = (text: string, start = 0): CompiledRun => ({ kind: "text", text, start, end: start + text.length, hyphenates: true })
const breakRun = (start: number, forced: boolean): CompiledRun => ({ kind: "break", start, end: start + Number(forced), forced })
const context = (text: string, runs: CompiledRun[], extra: Partial<CompileContext> = {}): CompileContext => ({
  block: { text, runs, breakRestrictions: [] },
  metricsFor: () => metrics,
  baseFont: metrics.font,
  locale: "en",
  ...extra,
})

const itemsOf = (compiled: ReturnType<typeof compileBlock>): Item[] => {
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.items
}

describe("compiler boundary contracts", () => {
  test("optional breaks separate content while forced breaks preserve empty lines", () => {
    const forced = itemsOf(compileBlock(context("alpha\nbeta", [textRun("alpha"), breakRun(5, true), textRun("beta", 6)])))
    expect(forced.filter((item) => item.kind === "penalty" && item.penalty <= -10000)).toHaveLength(2)
    const optional = itemsOf(compileBlock(context("alphabeta", [textRun("alpha"), breakRun(5, false), textRun("beta", 5)])))
    expect(optional.some((item) => item.kind === "penalty" && item.penalty === 0 && item.source?.start === 5)).toBe(true)
    const edged = itemsOf(compileBlock(context("\nalpha\n", [breakRun(0, true), textRun("alpha", 1), breakRun(6, true)])))
    expect(edged.filter((item) => item.kind === "penalty" && item.penalty <= -10000)).toHaveLength(2)
    expect(itemsOf(compileBlock(context("\n", [breakRun(0, true)])))).toHaveLength(3)
    expect(compileBlock(context("", [breakRun(0, false)]))).toEqual({ ok: false, reason: "empty" })
  })

  test("an atom without a width measurer is declined instead of silently measuring zero", () => {
    const atom: CompiledRun = { kind: "atom", start: 0, end: 1 }
    expect(compileBlock(context("\ufffc", [atom]))).toEqual({ ok: false, reason: "unmeasurable" })
    const items = itemsOf(compileBlock(context("\ufffc", [atom], { atomWidth: () => 35 })))
    expect(items[0]).toMatchObject({ kind: "box", width: 35 })
  })

  test("multiple runs with the same calibrated scale retain expansion", () => {
    const compiled = compileBlock(context("alpha beta", [textRun("alpha "), textRun("beta", 6)], { scaleFor: () => AFFINE }))
    expect(compiled.ok && compiled.scale).toBe(AFFINE)
    expect(compiled.ok && compiled.expansion).not.toBeNull()
  })

  test("a trailing edge can be pending before any text box exists", () => {
    const anchor: CompiledRun = { kind: "anchor", start: 0, end: 0, affinity: "previous" }
    const compiled = compileBlock(context("alpha", [anchor, textRun("alpha")], {
      edgesFor: (run) => run.kind === "anchor" ? { leading: 4, trailing: 3 } : { leading: 0, trailing: 0 },
    }))
    expect(itemsOf(compiled)[0]).toMatchObject({ kind: "box", width: 57 })
  })

  test("nowrap restrictions reject code, discretionary, and authored soft-hyphen opportunities", () => {
    for (const text of ["alphaBetaGamma", "alpha\u00adbeta"]) {
      for (const code of [true, false]) {
        const compiled = compileRuns([{ text }], metrics, { code, hyphenate: () => [2], nowrap: [{ start: 1, end: text.length }] })
        expect(itemsOf(compiled).filter((item) => item.kind === "discretionary")).toEqual([])
      }
    }
  })

  test("a leading zero-width break and forbidden word boundary preserve all source offsets", () => {
    const leading = itemsOf(compileRuns([{ text: "\u200balpha" }], metrics))
    expect(leading[0]?.source?.start).toBe(0)
    const text = "alpha\u200bbeta"
    const restricted = itemsOf(compileRuns([{ text }], metrics, { nowrap: [{ start: 1, end: text.length }] }))
    expect(restricted.filter((item) => item.kind === "penalty" && item.penalty === 0)).toEqual([])
    expect(restricted.at(-1)?.source?.end).toBe(text.length)
  })
})


test("optional breaks at paragraph edges are discarded, while atoms count as content", () => {
  const anchor: CompiledRun = { kind: "anchor", start: 0, end: 0, affinity: "next" }
  const atom: CompiledRun = { kind: "atom", start: 0, end: 1 }
  const items = itemsOf(compileBlock(context("\ufffcbeta", [anchor, breakRun(0, false), atom, breakRun(1, false), textRun("beta", 1), breakRun(5, false)], { atomWidth: () => 35 })))
  expect(items.filter((item) => item.kind === "penalty" && item.penalty === 0)).toEqual([
    { kind: "penalty", width: 0, penalty: 0, flagged: false, source: { start: 1, end: 1 } },
  ])
  const spaceOnly = itemsOf(compileBlock(context(" alpha", [textRun(" "), breakRun(1, false), textRun("alpha", 1)])))
  expect(spaceOnly.some((item) => item.kind === "penalty" && item.penalty === 0)).toBe(false)
})

test("unordered hyphenation cuts compile in source order with telescoping prefix widths", () => {
  const compiled = compileRuns([{ text: "x " }, { text: "abcdef" }], metrics, { hyphenate: (word) => word === "abcdef" ? [4, 2] : [] })
  const items = itemsOf(compiled)
  expect(items.filter((item) => item.kind === "box").map((item) => [item.width, item.source])).toEqual([
    [10, { start: 0, end: 1 }], [20, { start: 2, end: 4 }],
    [20, { start: 4, end: 6 }], [20, { start: 6, end: 8 }],
  ])
  expect(items.filter((item) => item.kind === "discretionary").map((item) => [item.hyphen, item.breakOffset, item.source])).toEqual([
    [true, 4, { start: 4, end: 4 }], [true, 6, { start: 6, end: 6 }],
  ])
})

test("run edges are charged once and next-affinity anchors join the following atom", () => {
  const edged = itemsOf(compileBlock(context("alpha beta", [textRun("alpha beta")], { edgesFor: () => ({ leading: 4, trailing: 7 }) })))
  expect(edged.filter((item) => item.kind === "box").map((item) => item.width)).toEqual([54, 47])
  const runs: CompiledRun[] = [textRun("alpha"), { kind: "anchor", start: 5, end: 5, affinity: "next" }, { kind: "atom", start: 5, end: 6 }]
  const joined = itemsOf(compileBlock(context("alpha\ufffc", runs, {
    atomWidth: () => 35,
    edgesFor: (run) => run.kind === "anchor" ? { leading: 4, trailing: 3 } : run.kind === "atom" ? { leading: 3, trailing: 5 } : { leading: 0, trailing: 0 },
  })))
  expect(joined.filter((item) => item.kind === "box").map((item) => item.width)).toEqual([50, 50])
  expect(compileBlock(context("alpha", [textRun("alpha")], { metricsFor: () => null }))).toEqual({ ok: false, reason: "unmeasurable" })
})

test("adjacent word segments retain authored hyphen penalties and absolute offsets", () => {
  for (const separator of ["-", "‐", "‒", "–", "—", "x"]) {
    const word = `pre${separator}fix`
    const segmented = createMetrics({
      measure: (text) => text.length * 10,
      font: metrics.font,
      segment: (text) => [
        { text: text.slice(0, 4), start: 0, end: 4, kind: "text" },
        { text: text.slice(4), start: 4, end: text.length, kind: "text" },
      ],
    })
    const items = itemsOf(compileRuns([{ text: "x " }, { text: word, metrics: segmented }], metrics, { policy: { exHyphenPenalty: 88 } }))
    expect(items.filter((item) => item.kind === "penalty" && item.source?.start === 6)).toEqual([
      { kind: "penalty", width: 0, penalty: separator === "x" ? 0 : 88, flagged: separator !== "x", source: { start: 6, end: 6 } },
    ])
  }
})

test("zero-width break segments permit only the following boundary without printing a hyphen", () => {
  const compiled = compileRuns([{ text: "a\u200bb" }], metrics)
  expect(itemsOf(compiled).filter((item) => item.kind === "penalty" && item.penalty === 0)).toEqual([
    { kind: "penalty", width: 0, penalty: 0, flagged: false, source: { start: 2, end: 2 } },
  ])
  const code = itemsOf(compileRuns([{ text: "alphaBeta.gamma" }], metrics, { code: true }))
  const discretionaries = code.filter((item) => item.kind === "discretionary")
  expect(discretionaries.length).toBeGreaterThan(0)
  expect(discretionaries.every((item) => !item.hyphen && item.preWidth === 0)).toBe(true)
})
