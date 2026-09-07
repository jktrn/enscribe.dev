import { expect, test } from "bun:test"
import {
  box,
  breakParagraph,
  breakParagraphOnce,
  glue,
  paragraphEnd,
  penalty,
  prepareParagraph,
  type Item,
  type LayoutDiagnostics,
} from "@linebreak/layout"
import { enumerateOptima } from "../../../packages/linebreak/benchmarks/solver-optimality"
import {
  scoreBreaks,
  solverFixture,
} from "../../../packages/linebreak/benchmarks/solver-data"

const pinned = (natural: number, stretch: number, shrink = stretch): Item[] => [
  box(natural),
  penalty(10000),
  glue(0, stretch, shrink),
  penalty(-10000),
]

test("continuous scoring remains the default and prepared paragraphs can select either objective", () => {
  const items = pinned(100, 100)
  const prepared = prepareParagraph(items)
  const ordinary = prepared.breakParagraphOnce(150, { tolerance: 100 })
  expect(ordinary).toEqual(
    breakParagraphOnce(items, 150, {
      tolerance: 100,
      policy: { scoring: "continuous" },
    }),
  )
  expect(ordinary.ok && ordinary.demerits).toBe(506.25)
  const integer = prepared.breakParagraphOnce(150, {
    tolerance: 100,
    policy: { scoring: "integer" },
  })
  expect(integer.ok && integer.demerits).toBe(484)
  expect(
    prepared.breakParagraph(150, { policy: { scoring: "integer" } }),
  ).toEqual(breakParagraph(items, 150, { policy: { scoring: "integer" } }))
})

for (const [delta, value] of [
  [-297, 100],
  [-148.5, 12],
  [0, 0],
  [29.7, 0],
  [148.5, 12],
  [150, 13],
  [296, 99],
  [297, 100],
  [297.3, 100],
  [594, 800],
  [891, 2698],
  [1188, 6396],
  [1290, 8189],
  [1291, 10000],
] as const) {
  test(`integer scoring prices adjustment ${delta}/297 with badness ${value}`, () => {
    const options = {
      tolerance: value,
      policy: { scoring: "integer", linePenalty: 0, adjDemerits: 0 },
    } as const
    const actual = breakParagraphOnce(pinned(1000, 297), 1000 + delta, options)
    expect(actual.ok && actual.demerits).toBe(value * value)
    expect(
      breakParagraphOnce(pinned(1000, 297), 1000 + delta, {
        ...options,
        tolerance: value - 1,
      }).ok,
    ).toBe(false)
  })
}

test("integer tolerance retains the plateau beyond ratio one in every pass", () => {
  const items = pinned(100, 100)
  expect(breakParagraphOnce(items, 200.1, { tolerance: 100 }).ok).toBe(false)
  const policy = {
    scoring: "integer",
    pretolerance: 100,
    tolerance: 100,
  } as const
  const once = breakParagraphOnce(items, 200.1, { tolerance: 100, policy })
  expect(once.ok && once.demerits).toBe(22100)
  if (!once.ok) throw new Error("The integer plateau must remain feasible")
  expect(breakParagraph(items, 200.1, { policy })).toEqual({
    ...once,
    pass: "pretolerance",
  })
  expect(
    breakParagraph(items, 200.1, { policy: { ...policy, pretolerance: -1 } }),
  ).toEqual(once)
  expect(
    breakParagraph(items, 200.1, {
      policy: { ...policy, pretolerance: -1, tolerance: 12 },
      emergencyStretch: 100.2,
    }),
  ).toMatchObject({ ok: true, pass: "emergency", demerits: 484 })
})

test("integer fitness uses the badness plateau at half shrink", () => {
  const items = [...pinned(150, 100), ...pinned(0, 100)]
  const free = breakParagraphOnce(items, 100, {
    tolerance: 100,
    policy: { scoring: "integer", adjDemerits: 0 },
  })
  const charged = breakParagraphOnce(items, 100, {
    tolerance: 100,
    policy: { scoring: "integer" },
  })
  expect(free.ok && free.demerits).toBe(12584)
  expect(charged.ok && charged.demerits).toBe(22584)
})

test("integer scoring handles rigid underfull and empty forced lines", () => {
  const options = { tolerance: 10000, policy: { scoring: "integer" } } as const
  expect(breakParagraphOnce(pinned(100, 0), 200, options)).toMatchObject({
    ok: true,
    demerits: 100010000,
  })
  expect(breakParagraphOnce([penalty(-10000)], 100, options)).toMatchObject({
    ok: true,
    demerits: 100,
  })
  expect(
    breakParagraphOnce(pinned(100, 100), 100, { ...options, tolerance: -1 }).ok,
  ).toBe(false)
})

test("nonpositive stretch receives saturated badness in either scoring mode", () => {
  for (const scoring of ["continuous", "integer"] as const) {
    for (const stretch of [-100, 0]) {
      const result = breakParagraphOnce(pinned(100, stretch), 200, {
        tolerance: 10000,
        policy: { scoring, linePenalty: 0, adjDemerits: 0 },
      })
      expect(result).toMatchObject({ ok: true, demerits: 100_000_000 })
    }
  }
})

for (const [tolerance, ratio] of [
  [99, 1.5],
  [799, 2.5],
  [2697, 3.5],
  [6395, 4.5],
  [9999, 5.5],
] as const) {
  test(`integer scoring rejects distant ratio ${ratio} without pricing it`, () => {
    const diagnostics: LayoutDiagnostics = {
      evaluatedLines: 0,
      peakActiveNodes: 0,
    }
    const result = breakParagraphOnce(pinned(100, 100), 100 + 100 * ratio, {
      tolerance,
      policy: { scoring: "integer" },
      diagnostics,
    })
    expect(result.ok).toBe(false)
    expect(diagnostics.evaluatedLines).toBe(1)
    expect(diagnostics.evaluatedBadness).toBe(0)
  })
}

test("integer scoring rescales finite geometry whose intermediate products overflow", () => {
  for (const [items, width, emergencyStretch] of [
    [pinned(1e307, 1e307), 1.5e307, 0],
    [pinned(-1e308, 1e308), 1e308, 1e308],
    [pinned(1, 1e308), 100, 1e308],
  ] as const) {
    const result = breakParagraphOnce(items, width, {
      tolerance: 10000,
      emergencyStretch,
      policy: { scoring: "integer", linePenalty: 0, adjDemerits: 0 },
    })
    expect(result.ok).toBe(true)
    expect(result.ok && Number.isFinite(result.demerits)).toBe(true)
    expect(result.ok && result.demerits).toBe(
      width === 1e308 ? 10000 : width === 100 ? 0 : 144,
    )
  }
})

for (const seed of [230, 707]) {
  test(`both scoring modes attain their different exhaustive optima (${seed})`, () => {
    const { linebreak: items } = solverFixture(18, seed, "elastic")
    const optima = enumerateOptima(items, 180, 800)
    expect(optima.complete).toBe(true)
    for (const scoring of ["continuous", "integer"] as const) {
      const expected = optima.optima[scoring]
      const actual = breakParagraphOnce(items, 180, {
        tolerance: 800,
        policy: { scoring },
      })
      expect(actual.ok).toBe(true)
      if (!actual.ok || !expected)
        throw new Error("The conflicting optima must be feasible")
      expect(actual.lines.map((line) => line.end)).toEqual([...expected.breaks])
      expect(actual.demerits).toBeCloseTo(
        scoring === "integer"
          ? expected.score.integerDemerits
          : expected.score.demerits,
        7,
      )
    }
  })
}

test("integer minimum agrees with independent complete enumeration across 288 fixed fixtures", () => {
  for (const corpus of [
    "original",
    "elastic",
    "forced",
    "discretionary",
  ] as const) {
    for (const words of [6, 8, 10]) {
      for (const width of [80, 120, 180]) {
        for (let seed = 0; seed < 8; seed += 1) {
          const { linebreak: items } = solverFixture(words, seed, corpus)
          const expected = enumerateOptima(items, width, 800)
          expect(expected.complete).toBe(true)
          const actual = breakParagraphOnce(items, width, {
            tolerance: 800,
            policy: { scoring: "integer" },
          })
          expect(actual.ok).toBe(expected.optima.integer !== null)
          if (!actual.ok) continue
          const measured = scoreBreaks(
            items,
            actual.lines.map((line) => line.end),
            width,
            800,
          )
          expect(measured.integerInfeasibleLines).toBe(0)
          expect(measured.integerDemerits).toBe(
            expected.optima.integer!.score.integerDemerits,
          )
          expect(actual.demerits).toBe(measured.integerDemerits)
        }
      }
    }
  }
})

test("forced fallback remains finite under integer scoring", () => {
  const result = breakParagraph([box(1000), ...paragraphEnd()], 100, {
    policy: { scoring: "integer" },
    emergencyStretch: 0,
  })
  expect(result).toMatchObject({ ok: true, pass: "forced", demerits: 0 })
})
