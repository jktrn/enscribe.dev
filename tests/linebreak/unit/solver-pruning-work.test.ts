import { expect, test } from "bun:test"
import { budgetFlex } from "@linebreak/layout/flex"
import {
  box,
  glue,
  penalty,
  paragraphEnd,
  breakParagraphOnce,
  type LayoutDiagnostics,
} from "@linebreak/layout"

test("underfull and exactly shrinkable candidates need no future feasibility bound", () => {
  const diagnostics: LayoutDiagnostics = {
    evaluatedLines: 0,
    peakActiveNodes: 0,
  }
  const result = breakParagraphOnce(
    [box(6), glue(0, 0, 2), box(6), penalty(0), box(10), penalty(-10000)],
    10,
    { tolerance: 100, diagnostics },
  )
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    12, 10,
  ])
  expect(diagnostics.evaluatedLines).toBeGreaterThan(0)
  expect(diagnostics.pruningChecks).toBe(0)
})

test("a proved overfull prefix needs one bound regardless of the discarded suffix length", () => {
  const diagnostics: LayoutDiagnostics = {
    evaluatedLines: 0,
    peakActiveNodes: 0,
    pruningChecks: 999,
  }
  for (const count of [128, 512, 2048]) {
    const suffix = Array.from({ length: count }, () => [
      box(10),
      glue(1, 1, 0),
    ]).flat()
    const items = [box(100), penalty(0), ...suffix, ...paragraphEnd()]
    expect(
      breakParagraphOnce(items, 10, { tolerance: 100, diagnostics }).ok,
    ).toBe(false)
    expect(diagnostics.pruningChecks).toBe(1)
  }
})

test("wide corrections retain linear pruning work after a bounded mandatory prefix", () => {
  for (const count of [32, 128, 512]) {
    const items = [
      box(1e12),
      box(1e-5),
      box(1e-100),
      penalty(-10000),
      ...Array.from({ length: count }, () => [box(10), glue(1, 1, 0)]).flat(),
      ...paragraphEnd(),
    ]
    const flex = budgetFlex(items, 0.125, 0.125, new Set())
    const diagnostics: LayoutDiagnostics = {
      evaluatedLines: 0,
      peakActiveNodes: 0,
    }
    const result = breakParagraphOnce(items, 10, {
      tolerance: 100,
      force: true,
      flex,
      diagnostics,
    })
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(
        result.lines.slice(1, -1).every((line) => line.naturalWidth === 10),
      ).toBe(true)
    expect(diagnostics.exactRangeEvaluations).toBeGreaterThan(0)
    // Every ordinary continuation is already provably too wide after one
    // extra word. Exact recovery must not discard the finite approximate
    // prefixes that establish this bound for the rest of the paragraph.
    expect(diagnostics.evaluatedLines).toBeLessThanOrEqual(3 * count + 8)
    expect(diagnostics.peakActiveNodes).toBeLessThanOrEqual(4)
  }
})
