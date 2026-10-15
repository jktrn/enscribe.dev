import { describe, expect, test } from "bun:test"
import { breakParagraph, breakParagraphOnce } from "@linebreak/layout/breaker"
import {
  box,
  discretionary,
  glue,
  lineBreak,
  paragraphEnd,
  penalty,
} from "@linebreak/layout/items"

describe("boundary geometry and source ranges", () => {
  test("integer rejection bounds preserve feasibility through the full badness range", () => {
    for (const tolerance of [100, 800, 2700, 6400, 9000, 10000]) {
      for (const ratio of [1, 2, 3, 4, 4.5, 5]) {
        const result = breakParagraphOnce(
          [box(0), glue(0, 1, 0), penalty(-10000)],
          ratio,
          { tolerance },
        )
        expect(result.ok).toBe(Math.min(10000, 100 * ratio ** 3) <= tolerance)
      }
    }
  })

  test("tolerance uses the same cubic badness as scoring at floating-point boundaries", () => {
    for (const tolerance of [1, 5, 25, 50, 75, 150, 250, 500]) {
      const ratio = Math.cbrt(tolerance / 100)
      for (const natural of [0, 1]) {
        const width = natural + ratio
        const actualRatio = width - natural
        const expected = 100 * Math.abs(actualRatio) ** 3 <= tolerance
        const result = breakParagraphOnce(
          [box(natural), glue(0, 1, 0), penalty(-10000)],
          width,
          { tolerance },
        )
        expect(result.ok).toBe(expected)
      }
    }
  })

  test("an empty optional fragment cannot buy a phantom line with a negative penalty", () => {
    const items = [
      discretionary({ penalty: -100, breakOffset: 0 }),
      box(10),
      ...paragraphEnd(),
    ]
    const result = breakParagraphOnce(items, 10, { tolerance: 100 })
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      10,
    ])
  })
  test("the final floor includes its exact boundary", () => {
    const result = breakParagraphOnce([box(5), ...paragraphEnd()], 10, {
      tolerance: 100,
      lastLineMinWidth: 0.5,
      strictEnding: true,
    })
    expect(result.ok).toBe(true)
  })

  test("an interior breakpoint without metadata inherits preceding content, never later content", () => {
    const result = breakParagraphOnce(
      [
        box(10, { start: 0, end: 1 }),
        penalty(0),
        box(10, { start: 1, end: 2 }),
        ...paragraphEnd(2),
      ],
      10,
      { tolerance: 100 },
    )
    expect(
      result.ok &&
        result.lines.map((line) => [line.sourceStart, line.sourceEnd]),
    ).toEqual([
      [0, 1],
      [1, 2],
    ])
  })

  test("unsourced trailing penalties do not erase the last known source endpoint", () => {
    const result = breakParagraphOnce(
      [box(10, { start: 5, end: 8 }), penalty(10000), penalty(-10000)],
      10,
      { tolerance: 100 },
    )
    expect(
      result.ok &&
        result.lines.map((line) => [line.sourceStart, line.sourceEnd]),
    ).toEqual([[5, 8]])
  })

  test("explicit breakpoint metadata takes precedence over a preceding box endpoint", () => {
    const items = [
      box(10, { start: 0, end: 1 }),
      penalty(-10000, { source: { start: 2, end: 4 } }),
      box(10, { start: 4, end: 5 }),
      ...paragraphEnd(5),
    ]
    const result = breakParagraphOnce(items, 10, { tolerance: 100 })
    expect(
      result.ok &&
        result.lines.map((line) => [line.sourceStart, line.sourceEnd]),
    ).toEqual([
      [0, 2],
      [4, 5],
    ])
  })

  test("a taken penalty before discarded word glue still produces a word-space break", () => {
    const result = breakParagraphOnce(
      [box(10), penalty(0), glue(3, 1, 1), box(10), ...paragraphEnd()],
      10,
      { tolerance: 100 },
    )
    expect(result.ok && result.lines.map((line) => line.breakKind)).toEqual([
      "space",
      "end",
    ])
  })

  test("word glue after a mandatory break cannot mark an earlier optional break as a space", () => {
    const items = [
      box(10),
      penalty(-100),
      penalty(-10000),
      glue(3, 1, 1),
      box(10),
      ...paragraphEnd(),
    ]
    const result = breakParagraphOnce(items, 10, { tolerance: 100 })
    expect(result.ok && result.lines.map((line) => line.breakKind)).toEqual([
      "none",
      "forced",
      "end",
    ])
  })

  test("glue retained inside a line does not change the following penalty's break kind", () => {
    const result = breakParagraphOnce(
      [box(5), glue(5, 1, 1), penalty(-100), box(10), ...paragraphEnd()],
      10,
      { tolerance: 100 },
    )
    expect(result.ok && result.lines.map((line) => line.breakKind)).toEqual([
      "none",
      "end",
    ])
  })

  test("a post-break fragment immediately before a forced endpoint is visible material", () => {
    const result = breakParagraphOnce(
      [
        discretionary({
          preWidth: 10,
          postWidth: 10,
          noBreakWidth: 25,
          breakOffset: 1,
        }),
        penalty(-10000),
      ],
      10,
      { tolerance: 100 },
    )
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      10, 10,
    ])
  })

  test("indentation belongs to the first forced line, including an otherwise blank line", () => {
    const result = breakParagraphOnce([penalty(-10000), penalty(-10000)], 10, {
      tolerance: 100,
      indent: 10,
    })
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      10, 0,
    ])
  })

  test("nonzero fragments whose widths cancel are not blank lines", () => {
    expect(
      breakParagraphOnce([penalty(-10000, { width: 5 })], 10, {
        tolerance: 100,
        indent: -5,
      }),
    ).toEqual({ ok: false, reason: "infeasible" })
    const hangs = {
      start: Float64Array.from([0, 0]),
      end: Float64Array.from([10]),
    }
    expect(
      breakParagraphOnce([penalty(-10000, { width: 10 })], 10, {
        tolerance: 100,
        hangs,
      }),
    ).toEqual({ ok: false, reason: "infeasible" })
  })

  test("a visible fragment equal to the indent does not disappear", () => {
    const result = breakParagraphOnce([penalty(-10000, { width: 5 })], 10, {
      tolerance: 100,
      indent: 5,
    })
    expect(result.ok && result.lines[0]?.naturalWidth).toBe(10)
  })

  test("signed discretionary fragments remain material at otherwise empty breakpoints", () => {
    const negativePre = [
      discretionary({
        preWidth: -5,
        postWidth: 10,
        noBreakWidth: 25,
        breakOffset: 1,
      }),
      penalty(-10000),
    ]
    const before = breakParagraphOnce(negativePre, 10, {
      tolerance: 100,
      emergencyStretch: 100,
    })
    expect(before.ok && before.lines.map((line) => line.naturalWidth)).toEqual([
      -5, 10,
    ])
    const negativePost = [
      discretionary({
        preWidth: 10,
        postWidth: -5,
        noBreakWidth: 25,
        breakOffset: 1,
      }),
      penalty(-100),
      box(10),
      ...paragraphEnd(),
    ]
    const after = breakParagraphOnce(negativePost, 10, {
      tolerance: 100,
      emergencyStretch: 100,
    })
    expect(after.ok && after.lines.map((line) => line.naturalWidth)).toEqual([
      10, -5, 10,
    ])
  })
})

describe("pass selection and unsuccessful inputs", () => {
  test("equal-cost paths to one fitness class keep the first discovered route", () => {
    const items = [
      box(10),
      penalty(0),
      box(0),
      penalty(0),
      box(10),
      ...paragraphEnd(),
    ]
    const result = breakParagraphOnce(items, 10, {
      tolerance: 0,
      policy: { linePenalty: 0, adjDemerits: 0 },
    })
    expect(result.ok && result.lines.map((line) => line.end)).toEqual([1, 7])
  })

  test("equal-cost final fitness classes use their stable class order", () => {
    const items = [
      box(10),
      glue(0, 10, 0),
      penalty(-200),
      box(-10),
      penalty(-200),
      box(10),
      glue(0, 10, 0),
      penalty(-10000),
    ]
    const result = breakParagraphOnce(items, 10, {
      tolerance: 100,
      policy: { adjDemerits: 0 },
    })
    expect(result.ok && result.lines.map((line) => line.end)).toEqual([4, 7])
    expect(result.ok && result.demerits).toBe(-27800)
  })
  test("a mandatory interior break cannot disguise an unterminated suffix", () => {
    expect(
      breakParagraphOnce([box(10), ...lineBreak(), box(10)], 10, {
        tolerance: 100,
      }),
    ).toEqual({ ok: false, reason: "infeasible" })
    expect(breakParagraphOnce([box(10)], 10, { tolerance: 100 })).toEqual({
      ok: false,
      reason: "infeasible",
    })
  })

  test("empty input and invalid target widths have explicit failure reasons", () => {
    expect(breakParagraphOnce([], 10, { tolerance: 100 })).toEqual({
      ok: false,
      reason: "empty",
    })
    for (const width of [0, -1, Infinity, NaN])
      expect(
        breakParagraphOnce([box(1), ...paragraphEnd()], width, {
          tolerance: 100,
        }),
      ).toEqual({ ok: false, reason: "infeasible" })
  })

  test("one invalid line cannot hide behind another valid line", () => {
    const result = breakParagraphOnce(
      [box(10), ...lineBreak(), box(10), glue(0, Infinity, 0), penalty(-10000)],
      10,
      { tolerance: 100 },
    )
    expect(result).toEqual({ ok: false, reason: "infeasible" })
  })

  test("an invalid optional margin cannot displace a valid complete route", () => {
    const items = [box(10), penalty(-5000), box(10), ...paragraphEnd()]
    const hangs = {
      start: new Float64Array(items.length + 1),
      end: Float64Array.from(items, (_, at) => (at === 1 ? Infinity : 0)),
    }
    const result = breakParagraphOnce(items, 20, {
      tolerance: 10000,
      hangs,
      policy: { linePenalty: -10000, adjDemerits: 0 },
    })
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      20,
    ])
  })

  test("zero pretolerance admits an exact paragraph before a disabled ordinary pass", () => {
    const result = breakParagraph([box(10), ...paragraphEnd()], 10, {
      policy: { pretolerance: 0, tolerance: -1 },
    })
    expect(result.ok && result.pass).toBe("pretolerance")
  })

  test("automatic emergency elasticity uses ordinary spaces and excludes terminal fill", () => {
    const items = [
      box(10),
      glue(2, 0, 0),
      box(10),
      penalty(0),
      box(25),
      ...paragraphEnd(),
    ]
    const options = { policy: { pretolerance: 0, tolerance: 100 } }
    const automatic = breakParagraph(items, 25, {
      ...options,
      emergencyStretch: "auto",
    })
    expect(automatic.ok && automatic.pass).toBe("emergency")
    expect(automatic).toEqual(breakParagraph(items, 25, options))
    expect(automatic).toEqual(
      breakParagraph(items, 25, { ...options, emergencyStretch: 24 }),
    )
  })

  test("automatic emergency elasticity is zero without ordinary spaces, including custom glyph flexibility", () => {
    const items = [box(5), penalty(-10000)]
    const options = {
      policy: { pretolerance: -1, tolerance: -1 },
      flex: {
        stretch: Float64Array.from([0, 5, 5]),
        shrink: Float64Array.from([0, 0, 0]),
      },
    }
    const automatic = breakParagraph(items, 10, options)
    expect(automatic).toEqual(
      breakParagraph(items, 10, { ...options, emergencyStretch: 0 }),
    )
    expect(automatic.ok && automatic.lines[0]?.adjustmentRatio).toBe(1)
  })
})

describe("forced containment when no feasible route remains", () => {
  test("a leading empty forced line has no margin credit when its indent is zero", () => {
    const result = breakParagraphOnce(
      [penalty(-10000), box(10), penalty(-10000)],
      10,
      {
        tolerance: 0,
        indent: 0,
        hangs: {
          start: Float64Array.of(3, 0, 0, 0),
          end: Float64Array.of(4, 0, 0),
        },
      },
    )
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      0, 10,
    ])
  })

  test("an underfull ending is preferable to a line overflowing its measure", () => {
    const result = breakParagraphOnce(
      [box(10), penalty(0), box(2), penalty(-10000)],
      10,
      { tolerance: 0, force: true },
    )
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      10, 2,
    ])
  })

  test("unavoidable overflow keeps the shortest remaining unbreakable material", () => {
    const result = breakParagraphOnce(
      [box(10), penalty(0), box(15), penalty(-10000)],
      10,
      { tolerance: 0, force: true },
    )
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      10, 15,
    ])
  })

  test("equal containment carries zero-width material on the preceding line", () => {
    const result = breakParagraphOnce(
      [box(10), penalty(0), box(0), penalty(0), box(15), penalty(-10000)],
      10,
      { tolerance: 0, force: true },
    )
    expect(result.ok && result.lines.map((line) => line.end)).toEqual([3, 5])
  })
})
