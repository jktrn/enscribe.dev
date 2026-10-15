import { describe, expect, test } from "bun:test"
import {
  breakParagraph,
  breakParagraphOnce,
  type PassOptions,
} from "@linebreak/layout/breaker"
import {
  box,
  discretionary,
  glue,
  type Item,
  lineBreak,
  paragraphEnd,
  penalty,
} from "@linebreak/layout/items"
import { buildHangs } from "@linebreak/layout/protrusion"
import { exhaustiveLayout } from "./support/exhaustive-layout"

const compare = (items: Item[], width: number, options: PassOptions) => {
  for (const scoring of ["continuous", "integer"] as const)
    compareScoring(items, width, {
      ...options,
      policy: { ...options.policy, scoring },
    })
}

const compareScoring = (items: Item[], width: number, options: PassOptions) => {
  const expected = exhaustiveLayout({ items, width, options })
  const actual = breakParagraphOnce(items, width, options)
  expect(actual.ok, JSON.stringify({ items, width, options })).toBe(
    expected !== null,
  )
  if (!actual.ok || !expected) return
  const scale = Math.max(1, Math.abs(expected.cost))
  expect(Math.abs(actual.demerits - expected.cost) / scale).toBeLessThan(1e-10)
  expect(actual.lines.at(-1)?.end).toBe(items.length - 1)
}

const random = (seed: number) => (limit: number) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0
  return (seed >>> 0) % limit
}

const sample = (pick: (limit: number) => number, mode: number) => {
  const items: Item[] = [box(1 + pick(20))]
  const count = 2 + pick(5)
  for (let index = 0; index < count; index += 1) {
    const kind = pick(mode === 0 ? 1 : 4)
    if (kind === 0)
      items.push(glue(pick(6), 1 + pick(15), pick(9) - (mode === 4 ? 5 : 0)))
    if (kind === 1)
      items.push(
        penalty(pick(3) === 0 ? -10000 : pick(81) - 40, {
          width: pick(12),
          flagged: pick(2) === 1,
        }),
      )
    if (kind === 2)
      items.push(
        discretionary({
          preWidth: pick(15) - (mode === 4 ? 5 : 0),
          postWidth: pick(6) - (mode === 4 ? 3 : 0),
          noBreakWidth: pick(6),
          penalty: pick(81) - 40,
          hyphen: pick(2) === 1,
          breakOffset: index,
        }),
      )
    if (kind === 3)
      items.push(
        penalty(10000),
        glue(pick(6), pick(15), pick(9) - (mode === 4 ? 5 : 0)),
      )
    items.push(box(pick(25) - (mode === 0 ? 0 : 3)))
  }
  return [...items, ...paragraphEnd()]
}

describe("minimum demerits against exhaustive paths", () => {
  for (const mode of [0, 1, 2, 3, 4]) {
    test(`2000 deterministic paragraphs, family ${mode}`, () => {
      const pick = random(1981 + mode)
      for (let index = 0; index < 2000; index += 1) {
        const items = sample(pick, mode)
        const options: PassOptions = {
          tolerance: [0, 100, 200, 10000][pick(4)]!,
          indent: pick(10) - 3,
          emergencyStretch: pick(4),
          policy: { adjDemerits: [-100, 0, 100, 10000][pick(4)]! },
        }
        if (mode === 3) {
          compare(items, 10 + pick(50), {
            ...options,
            lastLineMinWidth: [0, 0.3, 0.75, 1.2][pick(4)],
            strictEnding: pick(2) === 1,
            policy: {
              ...options.policy,
              linePenalty: [-10000, -10, 0, 10][pick(4)],
            },
          })
        } else if (mode === 2) {
          const start = Float64Array.from({ length: items.length + 1 }, () =>
            pick(4),
          )
          const end = Float64Array.from({ length: items.length }, () => pick(6))
          const stretch = Float64Array.from(
            { length: items.length + 1 },
            (_, at) => at * 2,
          )
          const shrink = Float64Array.from(
            { length: items.length + 1 },
            (_, at) => at,
          )
          compare(items, 10 + pick(50), {
            ...options,
            hangs: { start, end },
            flex: { stretch, shrink },
          })
        } else compare(items, 10 + pick(50), options)
      }
    })
  }
})

describe("counterexamples recorded before the audit", () => {
  test("an oversized optional fragment cannot destroy an exact unbroken line", () => {
    const items = [
      box(9),
      discretionary({ preWidth: 5, breakOffset: 1 }),
      box(1),
      ...paragraphEnd(),
    ]
    const result = breakParagraph(items, 10)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pass).toBe("pretolerance")
    expect(result.lines.map((line) => line.naturalWidth)).toEqual([10])
    compare(items, 10, { tolerance: 100 })
  })

  test("negative widths cannot invalidate a later feasible line", () => {
    compare([box(15), penalty(0), box(-5), ...paragraphEnd()], 10, {
      tolerance: 100,
    })
  })

  test("a rounding-shifted pruning bound cannot discard an exactly fitting future line", () => {
    const items = [
      box(1e16),
      glue(0, 0, 1e16),
      penalty(-10000),
      box(0),
      penalty(0, { width: 4 }),
      penalty(-10000, { width: 2 }),
    ]
    const start = new Float64Array(items.length + 1)
    start[3] = 1
    const options = {
      tolerance: 100,
      hangs: { start, end: new Float64Array(items.length) },
    }
    const result = breakParagraphOnce(items, 1, options)
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      1e16, 1,
    ])
    compare(items, 1, options)
  })

  test("overflow in a reassociated bound cannot hide finite extreme geometry", () => {
    const items = [
      box(1e308),
      glue(0, 0, 1e308),
      penalty(-10000),
      box(0),
      penalty(0, { width: 1.5e308 }),
      penalty(-10000, { width: 1e308 }),
    ]
    const result = breakParagraphOnce(items, 1e308, { tolerance: 100 })
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      1e308, 1e308,
    ])
  })

  test("future large shrink participates in the current pruning error bound", () => {
    const items = [
      box(10),
      penalty(0),
      box(1e16 - 8),
      glue(0, 0, 1e16),
      penalty(-10000),
    ]
    const result = breakParagraphOnce(items, 1, { tolerance: 100 })
    expect(
      result.ok && result.lines.map((line) => line.adjustmentRatio),
    ).toEqual([-1])
    compare(items, 1, { tolerance: 100 })
  })

  test("subnormal widths retain a later exactly fitting fragment", () => {
    const unit = Number.MIN_VALUE
    const items = [
      box(16 * unit),
      glue(0, 0, 16 * unit),
      penalty(-10000),
      box(0),
      penalty(0, { width: 4 * unit }),
      penalty(-10000, { width: unit }),
    ]
    const result = breakParagraphOnce(items, unit, { tolerance: 100 })
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      16 * unit,
      unit,
    ])
    compare(items, unit, { tolerance: 100 })
  })

  test("safe pruning preserves exact trailing fragments across floating-point scales", () => {
    for (const exponent of [5, 20, 53, 100, 500, 1020]) {
      for (const leading of [-3, -1, 0, 1, 3]) {
        for (const trailing of [0.25, 1, 2, 4, 8]) {
          const target = leading + trailing
          if (target <= 0) continue
          const prefix = 2 ** exponent
          const items = [
            box(prefix),
            glue(0, 0, prefix),
            penalty(-10000),
            box(0),
            penalty(0, { width: trailing + 20 }),
            penalty(-10000, { width: trailing }),
          ]
          const start = new Float64Array(items.length + 1)
          start[3] = -leading
          const result = breakParagraphOnce(items, target, {
            tolerance: 100,
            hangs: { start, end: new Float64Array(items.length) },
          })
          expect(
            result.ok && result.lines.map((line) => line.naturalWidth),
          ).toEqual([prefix, target])
        }
      }
    }
  })

  test("a disabled ending floor cannot penalize a negative natural width", () => {
    const result = breakParagraphOnce([box(-5), ...paragraphEnd()], 10, {
      tolerance: 100,
    })
    expect(result.ok && result.demerits).toBeCloseTo(100, 6)
  })

  test("a strict ending floor does not constrain an interior negative-width line", () => {
    compare(
      [
        box(16),
        penalty(-10000, { width: 3 }),
        box(-3),
        glue(1, 5, 5),
        box(15),
        ...paragraphEnd(),
      ],
      19,
      {
        tolerance: 10000,
        indent: -3,
        emergencyStretch: 1,
        lastLineMinWidth: 0.75,
        strictEnding: true,
        policy: { adjDemerits: -100, linePenalty: -10000 },
      },
    )
  })

  test("blank forced lines do not protrude neighboring glyphs", () => {
    const items = [
      box(10),
      ...lineBreak(),
      ...lineBreak(),
      box(10),
      ...paragraphEnd(),
    ]
    const hangs = buildHangs(items, new Map([[7, 2]]), new Map([[0, 1]]))
    const result = breakParagraphOnce(items, 10, { tolerance: 100, hangs })
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      9, 0, 8,
    ])
    expect(result.ok && result.lines[1]?.hangStart).toBe(0)
    expect(result.ok && result.lines[1]?.hangEnd).toBe(0)
    compare(items, 10, { tolerance: 100, hangs })
  })

  test("a standalone discretionary can split its own visible fragments", () => {
    const items = [
      discretionary({
        preWidth: 10,
        postWidth: 10,
        noBreakWidth: 25,
        breakOffset: 1,
      }),
      ...paragraphEnd(),
    ]
    const result = breakParagraphOnce(items, 10, { tolerance: 100 })
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      10, 10,
    ])
    compare(items, 10, { tolerance: 100 })
  })

  test("discardable glue after an empty post-break fragment is omitted", () => {
    const items = [
      box(10),
      discretionary({ preWidth: 0, breakOffset: 1, penalty: -100 }),
      glue(3, 1, 1),
      box(10),
      ...paragraphEnd(),
    ]
    const result = breakParagraphOnce(items, 10, { tolerance: 100 })
    expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
      10, 10,
    ])
    compare(items, 10, { tolerance: 100 })
  })

  test("negative tolerance cannot admit a line at the shrink boundary", () => {
    const items = [box(100), glue(10, 5, 8), box(100), ...paragraphEnd()]
    expect(breakParagraphOnce(items, 202, { tolerance: -1 }).ok).toBe(false)
    expect(breakParagraphOnce(items, 202, { tolerance: 0 }).ok).toBe(false)
    expect(breakParagraphOnce(items, 202, { tolerance: 100 }).ok).toBe(true)
  })

  test("an empty final line still pays final hyphen demerits", () => {
    const items = [
      box(10),
      penalty(-10000, { flagged: true }),
      ...paragraphEnd(),
    ]
    const result = breakParagraphOnce(items, 10, { tolerance: 100 })
    expect(result.ok && result.demerits).toBe(5200)
    compare(items, 10, { tolerance: 100 })
  })

  test("mutable arrays are measured again on the next public call", () => {
    const items = [box(5), ...paragraphEnd()]
    expect(breakParagraphOnce(items, 10, { tolerance: 100 }).ok).toBe(true)
    items[0] = box(15)
    expect(breakParagraphOnce(items, 10, { tolerance: 100 }).ok).toBe(false)
  })

  test("an unterminated stream never returns a successful partial paragraph", () => {
    expect(
      breakParagraphOnce([box(10), glue(2, 1, 1), box(5)], 10, {
        tolerance: 100,
      }).ok,
    ).toBe(false)
  })

  test("low-level items without source ranges have zero source offsets", () => {
    const result = breakParagraphOnce([box(10), penalty(-10000)], 10, {
      tolerance: 100,
    })
    expect(
      result.ok &&
        result.lines.map((line) => [line.sourceStart, line.sourceEnd]),
    ).toEqual([[0, 0]])
  })

  test("badness is capped before a negative line penalty is added", () => {
    compare(
      [box(1), glue(1, 1, 1), box(1), penalty(0), box(100), ...paragraphEnd()],
      100,
      { tolerance: 10000, policy: { linePenalty: -10000 } },
    )
  })

  test("nonfinite geometry and nonpositive measures cannot become successful layouts", () => {
    for (const width of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(breakParagraph([box(width), ...paragraphEnd()], 10).ok).toBe(false)
      expect(breakParagraph([box(5), ...paragraphEnd()], width).ok).toBe(false)
    }
    for (const width of [0, -1]) {
      expect(breakParagraph([box(5), ...paragraphEnd()], width).ok).toBe(false)
    }
  })

  test("finite policies whose accumulated costs overflow cannot report an infinite optimum", () => {
    const items = [box(1), penalty(0), box(10), ...paragraphEnd()]
    expect(
      breakParagraphOnce(items, 10, {
        tolerance: 10000,
        policy: { adjDemerits: 1e308 },
      }).ok,
    ).toBe(false)
  })
})
