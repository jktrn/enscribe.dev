import { describe, expect, test } from "bun:test"
import {
  box,
  breakParagraph,
  breakParagraphOnce,
  discretionary,
  glue,
  paragraphEnd,
  penalty,
  prepareParagraph,
  type Item,
} from "@linebreak/layout"
import { exhaustiveLayout } from "./support/exhaustive-layout"

describe("prepared paragraphs", () => {
  test("the same geometry solves independently at different measures and policies", () => {
    const items = [
      box(8),
      glue(2, 5, 2),
      box(8),
      glue(2, 5, 2),
      box(8),
      ...paragraphEnd(),
    ]
    const prepared = prepareParagraph(items)
    expect(prepared.itemCount).toBe(items.length)
    expect(Object.isFrozen(prepared)).toBe(true)
    for (const measure of [6, 10, 18, 24, 40]) {
      for (const tolerance of [0, 100, 10000]) {
        const options = { tolerance, policy: { adjDemerits: 0 } }
        const result = prepared.breakParagraphOnce(measure, options)
        const oracle = exhaustiveLayout({ items, width: measure, options })
        expect(result.ok).toBe(oracle !== null)
        if (result.ok && oracle)
          expect(result.demerits).toBeCloseTo(oracle.cost, 6)
        expect(result).toEqual(breakParagraphOnce(items, measure, options))
      }
      expect(prepared.breakParagraph(measure)).toEqual(
        breakParagraph(items, measure),
      )
      const layout = {
        policy: { pretolerance: -1, tolerance: 0 },
        emergencyStretch: 3,
        lastLineMinWidth: 0.8,
        indent: 2,
      }
      expect(prepared.breakParagraph(measure, layout)).toEqual(
        breakParagraph(items, measure, layout),
      )
    }
  })

  test("the prepared snapshot owns every item, source offset, margin and elasticity value", () => {
    const source = { start: 0, end: 1 }
    const first = { ...box(6, source) }
    const space = { ...glue(2, 5, 2, { start: 1, end: 2 }) }
    const fragment = {
      ...discretionary({
        preWidth: 2,
        postWidth: 1,
        noBreakWidth: 0,
        breakOffset: 2,
        source: { start: 2, end: 2 },
      }),
    }
    const opportunity = { ...penalty(-30, { width: 1 }) }
    const items: Item[] = [
      first,
      space,
      fragment,
      opportunity,
      box(6),
      ...paragraphEnd(3),
    ]
    const hangs = {
      start: Float64Array.from(items, () => 1),
      end: Float64Array.from(items, () => 1),
    }
    const flex = {
      stretch: Float64Array.from(
        { length: items.length + 1 },
        (_, at) => at * 2,
      ),
      shrink: Float64Array.from({ length: items.length + 1 }, (_, at) => at),
    }
    const prepared = prepareParagraph(items, { hangs, flex })
    const original = prepared.breakParagraphOnce(12, { tolerance: 100 })
    expect(original.ok).toBe(true)
    expect(original).toEqual(
      breakParagraphOnce(items, 12, { tolerance: 100, hangs, flex }),
    )
    first.width = 600
    source.start = 99
    source.end = 100
    space.width = 200
    space.stretch = 500
    fragment.preWidth = 200
    fragment.breakOffset = 100
    opportunity.penalty = 9999
    hangs.start.fill(100)
    hangs.end.fill(100)
    flex.stretch.fill(0)
    flex.shrink.fill(0)
    items.splice(0, items.length, box(900), ...paragraphEnd())
    expect(prepared.breakParagraphOnce(12, { tolerance: 100 })).toEqual(
      original,
    )
    expect(prepared.itemCount).toBe(8)
  })

  test("exact fallback prefixes remain independent of later caller mutations", () => {
    const fragments = [1e100, 1, 1e-100, -1e100].map((width) => ({
      ...box(width),
    }))
    const items: Item[] = [...fragments, ...paragraphEnd()]
    const prepared = prepareParagraph(items)
    const original = prepared.breakParagraphOnce(1, { tolerance: 0 })
    expect(original.ok).toBe(true)
    if (original.ok) expect(original.lines[0]?.naturalWidth).toBe(1)
    for (const fragment of fragments) fragment.width = 900
    items.splice(0, items.length, box(5), ...paragraphEnd())
    expect(prepared.breakParagraphOnce(1, { tolerance: 0 })).toEqual(original)
  })

  test("empty and unterminated snapshots preserve explicit failure results", () => {
    expect(
      prepareParagraph([]).breakParagraphOnce(10, { tolerance: 100 }),
    ).toEqual({ ok: false, reason: "empty" })
    expect(prepareParagraph([box(10)]).breakParagraph(10)).toEqual({
      ok: false,
      reason: "infeasible",
    })
  })

  test("both solve methods reject geometry overrides, including explicit undefined", () => {
    const prepared = prepareParagraph([box(10), ...paragraphEnd()])
    for (const options of [
      { tolerance: 100, flex: undefined },
      { tolerance: 100, hangs: undefined },
    ]) {
      expect(() => prepared.breakParagraphOnce(10, options)).toThrow(
        "Prepared paragraph geometry cannot be overridden.",
      )
      expect(() => prepared.breakParagraph(10, options)).toThrow(
        "Prepared paragraph geometry cannot be overridden.",
      )
    }
    const geometry = {
      tolerance: 100,
      flex: { stretch: new Float64Array(4), shrink: new Float64Array(4) },
    }
    const untypedCall = () => {
      // @ts-expect-error JavaScript consumers can attempt an override that TypeScript rejects.
      return prepared.breakParagraphOnce(10, geometry)
    }
    expect(untypedCall).toThrow(TypeError)
  })

  test("each solve reports its own work without retaining an old diagnostic object", () => {
    const prepared = prepareParagraph([box(10), ...paragraphEnd()])
    const diagnostics = { evaluatedLines: 0, peakActiveNodes: 0 }
    const first = prepared.breakParagraphOnce(20, {
      tolerance: 100,
      diagnostics,
    })
    const saved = { ...diagnostics }
    prepared.breakParagraphOnce(5, { tolerance: 100 })
    expect(diagnostics).toEqual(saved)
    expect(prepared.breakParagraphOnce(20, { tolerance: 100 })).toEqual(first)
  })
})
