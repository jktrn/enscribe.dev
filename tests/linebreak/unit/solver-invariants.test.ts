import { describe, expect, test } from "bun:test"
import { breakParagraphOnce } from "@linebreak/layout/breaker"
import {
  box,
  glue,
  type Item,
  lineBreak,
  paragraphEnd,
  penalty,
} from "@linebreak/layout/items"

const sample = (seed: number) => {
  const items: Item[] = []
  for (let index = 0; index < 12; index += 1) {
    if (index > 0) items.push(glue(2, 1, 1))
    items.push(box(3 + ((seed * (index + 7) + index * index) % 19)))
  }
  return [...items, ...paragraphEnd()]
}

const scale = (item: Item, factor: number): Item => {
  if (item.kind === "discretionary")
    return {
      ...item,
      preWidth: item.preWidth * factor,
      postWidth: item.postWidth * factor,
      noBreakWidth: item.noBreakWidth * factor,
    }
  if (item.kind === "glue")
    return {
      ...item,
      width: item.width * factor,
      stretch: item.stretch * factor,
      shrink: item.shrink * factor,
    }
  return { ...item, width: item.width * factor }
}

describe("properties independent of a reference implementation", () => {
  test("relaxing tolerance cannot lose feasibility or increase the optimum cost", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const items = sample(seed)
      let minimum = Number.POSITIVE_INFINITY
      for (const tolerance of [0, 50, 100, 200, 10000]) {
        const result = breakParagraphOnce(items, 30 + (seed % 31), {
          tolerance,
        })
        if (!result.ok) {
          expect(minimum).toBe(Number.POSITIVE_INFINITY)
          continue
        }
        expect(result.demerits).toBeLessThanOrEqual(minimum)
        minimum = result.demerits
      }
    }
  })

  test("changing the unit of every geometric quantity preserves the route and cost", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const items = sample(seed)
      const width = 30 + (seed % 31)
      const original = breakParagraphOnce(items, width, { tolerance: 10000 })
      expect(original.ok).toBe(true)
      if (!original.ok) return
      for (const factor of [0.125, 2, 1024]) {
        const scaled = breakParagraphOnce(
          items.map((item) => scale(item, factor)),
          width * factor,
          { tolerance: 10000 },
        )
        expect(scaled.ok).toBe(true)
        if (!scaled.ok) return
        expect(scaled.demerits).toBe(original.demerits)
        expect(scaled.lines.map((line) => line.end)).toEqual(
          original.lines.map((line) => line.end),
        )
      }
    }
  })

  test("splitting boxes with forbidden breaks preserves line geometry and optimal cost", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const items = sample(seed)
      const split = items.flatMap<Item>((item) =>
        item.kind === "box"
          ? [box(item.width / 2), penalty(10000), box(item.width / 2)]
          : [item],
      )
      const original = breakParagraphOnce(items, 30 + (seed % 31), {
        tolerance: 10000,
      })
      const divided = breakParagraphOnce(split, 30 + (seed % 31), {
        tolerance: 10000,
      })
      expect(original.ok && divided.ok).toBe(true)
      if (!original.ok || !divided.ok) return
      expect(divided.demerits).toBe(original.demerits)
      expect(divided.lines.map((line) => line.naturalWidth)).toEqual(
        original.lines.map((line) => line.naturalWidth),
      )
    }
  })
})

describe("bounded solver work", () => {
  const words = (count: number) => {
    const items: Item[] = []
    for (let index = 0; index < count; index += 1) {
      if (index > 0) items.push(glue(3, 2, 1))
      items.push(box(10))
    }
    return items
  }

  test("fixed-width monotone paragraphs retain bounded active state as they grow", () => {
    for (const count of [128, 512, 2048]) {
      const items = [...words(count), ...paragraphEnd()]
      const diagnostics = { evaluatedLines: 0, peakActiveNodes: 0 }
      const result = breakParagraphOnce(items, 40, {
        tolerance: 200,
        diagnostics,
      })
      expect(result.ok).toBe(true)
      // Four fitness classes and at most four 10-unit boxes fit the measure.
      expect(diagnostics.peakActiveNodes).toBeLessThanOrEqual(16)
      expect(diagnostics.evaluatedLines).toBeLessThanOrEqual(16 * items.length)
      expect(diagnostics.evaluatedLines).toBeGreaterThan(0)
      expect(breakParagraphOnce(items, 40, { tolerance: 200 })).toEqual(result)
    }
  })

  test("width decreases beyond a mandatory break cannot prevent pruning before it", () => {
    const items = [
      ...words(512),
      ...lineBreak(),
      box(-1e6),
      penalty(0),
      box(1e6 + 10),
      ...paragraphEnd(),
    ]
    const diagnostics = { evaluatedLines: 0, peakActiveNodes: 0 }
    expect(
      breakParagraphOnce(items, 40, { tolerance: 200, diagnostics }).ok,
    ).toBe(true)
    expect(diagnostics.peakActiveNodes).toBeLessThanOrEqual(16)
    expect(diagnostics.evaluatedLines).toBeLessThanOrEqual(16 * items.length)
  })

  test("distant underfull candidates avoid most cubic evaluations in long regular paragraphs", () => {
    for (const count of [128, 512, 2048]) {
      const items = [...words(count), ...paragraphEnd()]
      const diagnostics = {
        evaluatedLines: 0,
        evaluatedBadness: 0,
        peakActiveNodes: 0,
      }
      const result = breakParagraphOnce(items, 160, {
        tolerance: 200,
        diagnostics,
      })
      expect(result.ok).toBe(true)
      expect(diagnostics.evaluatedBadness).toBeGreaterThan(
        result.ok ? result.lines.length : 0,
      )
      expect(diagnostics.evaluatedBadness).toBeLessThan(
        diagnostics.evaluatedLines / 2,
      )
      expect(breakParagraphOnce(items, 160, { tolerance: 200 })).toEqual(result)
    }
  })

  test("an exact tolerance ceiling skips cubic work for lines requiring more than full stretch", () => {
    for (const count of [128, 512, 2048]) {
      const items = [...words(count), ...paragraphEnd()]
      const diagnostics = {
        evaluatedLines: 0,
        evaluatedBadness: 0,
        peakActiveNodes: 0,
      }
      expect(
        breakParagraphOnce(items, 160, { tolerance: 100, diagnostics }).ok,
      ).toBe(true)
      // Ordinary candidates need 11–13 words to fall between ratios −1 and 1;
      // earlier boundaries can be rejected without computing their cubes.
      expect(diagnostics.evaluatedBadness).toBeGreaterThan(0)
      expect(diagnostics.evaluatedBadness).toBeLessThan(
        diagnostics.evaluatedLines / 4,
      )
    }
  })

  test("a remote extreme magnitude cannot relax the rounding bound before a mandatory break", () => {
    const prefix = [...words(512), ...lineBreak()]
    const items = [...prefix, box(1e308), penalty(-10000)]
    const diagnostics = { evaluatedLines: 0, peakActiveNodes: 0 }
    expect(
      breakParagraphOnce(items, 40, { tolerance: 200, diagnostics }).ok,
    ).toBe(false)
    expect(diagnostics.peakActiveNodes).toBeLessThanOrEqual(16)
    expect(diagnostics.evaluatedLines).toBeLessThanOrEqual(16 * items.length)
  })

  test("diagnostics describe each call independently", () => {
    const diagnostics = { evaluatedLines: 999, peakActiveNodes: 999 }
    const items = [box(10), ...paragraphEnd()]
    breakParagraphOnce(items, 40, { tolerance: 200, diagnostics })
    const first = { ...diagnostics }
    breakParagraphOnce(items, 40, { tolerance: 200, diagnostics })
    expect(diagnostics).toEqual(first)
    expect(diagnostics.evaluatedLines).toBeGreaterThan(0)
    expect(diagnostics.peakActiveNodes).toBeLessThan(999)
  })

  test("rejected input clears prior work rather than reporting a previous paragraph", () => {
    const cases = [
      { items: [], width: 10, attempts: 0 },
      { items: [box(10)], width: 10, attempts: 1 },
      { items: [box(10), ...paragraphEnd()], width: 0, attempts: 0 },
    ]
    for (const entry of cases) {
      const diagnostics = {
        evaluatedLines: 999,
        evaluatedBadness: 999,
        peakActiveNodes: 999,
        processedBreakpoints: 999,
        pruningChecks: 999,
        compensatedRangeEvaluations: 999,
        exactRangeEvaluations: 999,
        attemptedPasses: 999,
      }
      expect(
        breakParagraphOnce(entry.items, entry.width, {
          tolerance: 100,
          diagnostics,
        }).ok,
      ).toBe(false)
      expect(diagnostics).toEqual({
        evaluatedLines: 0,
        evaluatedBadness: 0,
        peakActiveNodes: 0,
        processedBreakpoints: 0,
        pruningChecks: 0,
        compensatedRangeEvaluations: 0,
        exactRangeEvaluations: 0,
        attemptedPasses: entry.attempts,
      })
    }
  })

  test("a provably infeasible prefix stops search before an arbitrarily long suffix", () => {
    for (const count of [128, 512, 2048]) {
      const items = [box(100), penalty(0), ...words(count), ...paragraphEnd()]
      const diagnostics = {
        evaluatedLines: 0,
        peakActiveNodes: 0,
        processedBreakpoints: 0,
      }
      expect(
        breakParagraphOnce(items, 40, { tolerance: 200, diagnostics }),
      ).toEqual({ ok: false, reason: "infeasible" })
      // Positive-width later material cannot repair an already unshrinkable prefix.
      expect(diagnostics.processedBreakpoints).toBeLessThanOrEqual(1)
      expect(diagnostics.processedBreakpoints).toBeGreaterThan(0)
      expect(diagnostics.evaluatedLines).toBeLessThanOrEqual(1)
      expect(diagnostics.peakActiveNodes).toBeGreaterThanOrEqual(1)
    }
  })

  test("work diagnostics reflect the increasing alternatives of a loose unbroken paragraph", () => {
    for (const count of [8, 16, 32]) {
      const items = [...words(count), ...paragraphEnd()]
      const diagnostics = {
        evaluatedLines: 0,
        peakActiveNodes: 0,
        processedBreakpoints: 0,
      }
      const result = breakParagraphOnce(items, count * 20, {
        tolerance: 10000,
        diagnostics,
      })
      expect(result.ok).toBe(true)
      // Every word boundary is reachable, while the initial unbroken route stays active.
      expect(diagnostics.processedBreakpoints).toBeGreaterThanOrEqual(count)
      expect(diagnostics.peakActiveNodes).toBeGreaterThanOrEqual(count)
      expect(diagnostics.evaluatedLines).toBeGreaterThan(
        diagnostics.processedBreakpoints,
      )
    }
  })
})
