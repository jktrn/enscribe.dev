import { expect, test } from "bun:test"
import {
  box,
  glue,
  penalty,
  prepareParagraph,
  breakParagraphOnce,
  type Item,
} from "@linebreak/layout"
import { PrefixSum } from "@linebreak/layout/numeric/prefix"
import { rangeDifference, rangeSum } from "@linebreak/layout/numeric/range"
import { newSum, type NumericDiagnostics } from "@linebreak/layout/numeric/sum"

const query = (
  values: readonly number[],
  start: number,
  extras: boolean,
  diagnostics: NumericDiagnostics = {
    compensatedRangeEvaluations: 0,
    exactRangeEvaluations: 0,
  },
) => {
  const prefix = new PrefixSum(values.length)
  values.forEach((value, index) => {
    prefix.add(value)
    prefix.save(index + 1)
  })
  const correction = prefix.correction((index) => [values[index]!])
  const state = newSum(diagnostics)
  const evaluate = extras ? rangeSum : rangeDifference
  const value = evaluate(
    state,
    correction,
    start,
    values.length,
    prefix.values[start]!,
    prefix.values[values.length]!,
  )
  return { value, diagnostics }
}

test("certified differences avoid compensation and exact recovery for independently lossless operands", () => {
  for (const [values, start, expected] of [
    [[1, 2, 4], 1, 6],
    [[1e16, 1, 2], 1, 3],
    [[1e16, 1, 2], 2, 2],
  ] as const) {
    const result = query(values, start, false)
    expect(result.value).toBe(expected)
    expect(result.diagnostics.compensatedRangeEvaluations).toBe(0)
    expect(result.diagnostics.exactRangeEvaluations).toBe(0)
  }
})

test("numeric work collection can begin with omitted optional counters", () => {
  const diagnostics: NumericDiagnostics = {}
  query([1, 2 ** 100, 2 ** 47], 1, false, diagnostics)
  query([1e100, 1, 1e-100, -1e100], 0, false, diagnostics)
  expect(diagnostics).toEqual({
    compensatedRangeEvaluations: 1,
    exactRangeEvaluations: 1,
  })
})

test("the numeric work report separates compensation from exact recovery", () => {
  const compensated = query([1, 2 ** 100, 2 ** 47], 1, false)
  expect(compensated.value).toBe(2 ** 100)
  expect(compensated.diagnostics.compensatedRangeEvaluations).toBe(1)
  expect(compensated.diagnostics.exactRangeEvaluations).toBe(0)
  for (const extras of [false, true]) {
    const exact = query(
      [2 ** 100, 1, -(2 ** 100), 2 ** 46, -(2 ** -50)],
      2,
      extras,
    )
    expect(exact.value).toBe(-(2 ** 100))
    expect(exact.diagnostics.exactRangeEvaluations).toBe(1)
  }
  const wide = query([1e100, 1, 1e-100, -1e100], 0, false)
  expect(wide.value).toBe(1)
  expect(wide.diagnostics.compensatedRangeEvaluations).toBe(0)
  expect(wide.diagnostics.exactRangeEvaluations).toBe(1)
})

test("ordinary exact lines do not invoke integer recovery and diagnostics reset on each solve", () => {
  const diagnostics = {
    evaluatedLines: 0,
    peakActiveNodes: 0,
    compensatedRangeEvaluations: 99,
    exactRangeEvaluations: 99,
  }
  const items: Item[] = [box(9), penalty(-10000), box(10), penalty(-10000)]
  const prepared = prepareParagraph(items)
  const options = { tolerance: 0, indent: 1, diagnostics }
  expect(prepared.breakParagraphOnce(10, options).ok).toBe(true)
  expect(diagnostics.compensatedRangeEvaluations).toBeGreaterThan(0)
  expect(diagnostics.exactRangeEvaluations).toBe(0)
  const first = { ...diagnostics }
  expect(prepared.breakParagraphOnce(10, options).ok).toBe(true)
  expect(diagnostics).toEqual(first)

  const cancelling = [
    box(1e100),
    box(1),
    box(1e-100),
    box(-1e100),
    penalty(-10000),
  ]
  expect(
    breakParagraphOnce(cancelling, 1, { tolerance: 0, diagnostics }).ok,
  ).toBe(true)
  expect(diagnostics.exactRangeEvaluations).toBeGreaterThan(0)
})

test("ratios beyond the proved integer cube bounds require no cubic badness work", () => {
  for (const [tolerance, ratio] of [
    [100, 2],
    [800, 3],
    [2700, 4],
    [6400, 5],
    [9999, 6],
  ]) {
    const diagnostics = {
      evaluatedLines: 0,
      evaluatedBadness: 0,
      peakActiveNodes: 0,
    }
    const items = [box(1), penalty(10000), glue(0, 1, 0), penalty(-10000)]
    expect(
      breakParagraphOnce(items, 1 + ratio!, {
        tolerance: tolerance!,
        diagnostics,
      }).ok,
    ).toBe(false)
    expect(diagnostics.evaluatedLines).toBeGreaterThan(0)
    expect(diagnostics.evaluatedBadness).toBe(0)
  }
})

test("search measures only the needed capacity direction before final line validation", () => {
  const items = [
    box(1),
    penalty(10000),
    ...[1e100, 1, 1e-100, -1e100].map((value) => glue(0, value, value)),
    penalty(-10000),
  ]
  for (const [target, expectedRanges] of [
    [0.5, 3],
    [1, 2],
    [2, 3],
  ] as const) {
    const diagnostics = {
      evaluatedLines: 0,
      peakActiveNodes: 0,
      exactRangeEvaluations: 0,
    }
    const result = breakParagraphOnce(items, target, {
      tolerance: 100,
      diagnostics,
    })
    expect(
      result.ok && result.lines.map((line) => [line.stretch, line.shrink]),
    ).toEqual([[1, 1]])
    // A single final line validates both pools. Search adds at most the one
    // directional pool it needs; exact fit needs no capacity computation.
    expect(diagnostics.exactRangeEvaluations).toBe(expectedRanges)
  }
})

test("ordinary integer geometry uses direct differences instead of checked accumulation", () => {
  const diagnostics = {
    evaluatedLines: 0,
    peakActiveNodes: 0,
    compensatedRangeEvaluations: 0,
    exactRangeEvaluations: 0,
  }
  const items = [box(10), penalty(-10000), box(10), penalty(-10000)]
  expect(breakParagraphOnce(items, 10, { tolerance: 0, diagnostics }).ok).toBe(
    true,
  )
  expect(diagnostics.compensatedRangeEvaluations).toBe(0)
  expect(diagnostics.exactRangeEvaluations).toBe(0)
})
