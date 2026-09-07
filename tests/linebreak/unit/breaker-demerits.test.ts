import { describe, expect, test } from "bun:test"
import { breakParagraph, breakParagraphOnce } from "@linebreak/layout/breaker"
import { type Item } from "@linebreak/layout/items"
import {
  INFINITE_BADNESS,
  INFINITE_PENALTY,
  texDefaults,
} from "@linebreak/layout/policy"
import {
  WORD,
  MEASURE,
  source,
  box,
  glue,
  finish,
  paragraph,
  evenWords,
  discretionary,
} from "./support/breaker-fixtures"

describe("demerits follow TeX82, not the 1981 paper", () => {
  const withPenalty = (penalty: number): Item[] => {
    const items: Item[] = []
    for (let index = 0; index < 24; index += 1) {
      if (index > 0) items.push(glue())
      items.push(box(WORD))
      if (index === 10) {
        items.push({
          kind: "penalty",
          width: 0,
          penalty,
          flagged: false,
          source,
        })
      }
    }
    return [...items, ...finish()]
  }

  const pinnedPenalty = (penalty: number): Item[] => [
    box(195),
    glue(),
    box(195),
    { kind: "penalty", width: 0, penalty, flagged: false, source },
    glue(),
    box(390),
    ...finish(),
  ]

  test("a positive penalty costs exactly p^2, not 2(l+b)p + p^2", () => {
    const free = breakParagraphOnce(pinnedPenalty(0), MEASURE, {
      tolerance: texDefaults.pretolerance,
    })
    const costly = breakParagraphOnce(pinnedPenalty(50), MEASURE, {
      tolerance: texDefaults.pretolerance,
    })
    expect(free.ok && costly.ok).toBe(true)
    if (!free.ok || !costly.ok) return

    expect(free.lines).toHaveLength(2)
    expect(free.demerits).toBeCloseTo(200, 6)
    expect(costly.demerits).toBeCloseTo(2_700, 6)
  })

  test("total demerits are reported and rise with a penalised break", () => {
    const free = breakParagraph(withPenalty(0), MEASURE)
    const costly = breakParagraph(withPenalty(50), MEASURE)
    expect(free.ok && costly.ok).toBe(true)
    if (!free.ok || !costly.ok) return
    expect(costly.demerits).toBeGreaterThanOrEqual(free.demerits)
  })

  test("a negative penalty pulls the break to its point", () => {
    const neutral = breakParagraph(withPenalty(0), MEASURE)
    const attractive = breakParagraph(withPenalty(-950), MEASURE)
    expect(neutral.ok && attractive.ok).toBe(true)
    if (!neutral.ok || !attractive.ok) return
    expect(attractive.lines[0]?.end).not.toBe(neutral.lines[0]?.end)
  })
})

describe("hyphen demerits", () => {
  const hyphenated = (count: number): Item[] => {
    const items: Item[] = []
    for (let index = 0; index < count; index += 1) {
      if (index > 0) items.push(glue())
      items.push(box(WORD))
      items.push(discretionary({ preWidth: 5, postWidth: 0, noBreakWidth: 0 }))
      items.push(box(WORD))
    }
    return [...items, ...finish()]
  }

  test("consecutive hyphenated lines are discouraged", () => {
    const relaxed = breakParagraph(hyphenated(20), MEASURE, {
      policy: { doubleHyphenDemerits: 0 },
    })
    const strict = breakParagraph(hyphenated(20), MEASURE, {
      policy: { doubleHyphenDemerits: 1_000_000 },
    })
    expect(relaxed.ok && strict.ok).toBe(true)
    if (!relaxed.ok || !strict.ok) return

    const runs = (lines: readonly { breakKind: string }[]) => {
      let pairs = 0
      for (let i = 1; i < lines.length; i += 1) {
        if (
          lines[i - 1]?.breakKind === "hyphen" &&
          lines[i]?.breakKind === "hyphen"
        ) {
          pairs += 1
        }
      }
      return pairs
    }
    expect(runs(strict.lines)).toBeLessThanOrEqual(runs(relaxed.lines))
  })

  test("finalHyphenDemerits is a real knob, so it must change something", () => {
    expect(texDefaults.finalHyphenDemerits).toBe(5_000)
    const cheap = breakParagraph(hyphenated(12), MEASURE, {
      policy: { finalHyphenDemerits: 0 },
    })
    const dear = breakParagraph(hyphenated(12), MEASURE, {
      policy: { finalHyphenDemerits: 10_000_000 },
    })
    expect(cheap.ok && dear.ok).toBe(true)
    if (!cheap.ok || !dear.ok) return
    const penultimate = (r: typeof cheap) =>
      r.ok ? r.lines.at(-2)?.breakKind : undefined
    if (penultimate(cheap) === "hyphen") {
      expect(penultimate(dear)).not.toBe("hyphen")
    }
  })
})

describe("fitness classes", () => {
  const pinned = () => [box(30), glue(), box(30), glue(), box(390), ...finish()]
  const LOOSE_TOLERANCE = 1e9

  test("adjDemerits is charged on the first line too", () => {
    const free = breakParagraphOnce(pinned(), MEASURE, {
      tolerance: LOOSE_TOLERANCE,
      policy: { adjDemerits: 0 },
    })
    const charged = breakParagraphOnce(pinned(), MEASURE, {
      tolerance: LOOSE_TOLERANCE,
      policy: { adjDemerits: 10_000 },
    })
    expect(free.ok && charged.ok).toBe(true)
    if (!free.ok || !charged.ok) return
    expect(charged.lines).toHaveLength(2)
    expect(charged.demerits - free.demerits).toBe(20_000)
  })

  test("a very loose line lands in the outer fitness class", () => {
    const result = breakParagraphOnce(pinned(), MEASURE, {
      tolerance: LOOSE_TOLERANCE,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines[0]?.adjustmentRatio).toBeGreaterThan(1)
  })
})

describe("a negative adjDemerits is a cost, not a veto", () => {
  test("the strict pass still solves a paragraph it solves at any other sign", () => {
    for (const adjDemerits of [-10_000, 0, 10_000]) {
      const result = breakParagraphOnce(evenWords(40), MEASURE, {
        tolerance: texDefaults.pretolerance,
        policy: { adjDemerits },
      })
      expect(result.ok).toBe(true)
    }
  })

  test("the ladder still settles on pass one, not on the forced rung", () => {
    const result = breakParagraph(evenWords(40), MEASURE, {
      policy: { adjDemerits: -10_000 },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pass).toBe("pretolerance")
    for (const line of result.lines.slice(0, -1)) {
      expect(line.adjustmentRatio).toBeGreaterThanOrEqual(-1)
      expect(line.adjustmentRatio).toBeLessThanOrEqual(1)
    }
  })
})

describe("badness saturates at inf_bad", () => {
  const mustBreakShort = (): Item[] => [
    box(100),
    { kind: "penalty", width: 0, penalty: 0, flagged: false, source },
    box(390),
    ...finish(),
  ]

  const aboveInfBad = (): Item[] => [
    box(10),
    {
      kind: "penalty",
      width: 0,
      penalty: INFINITE_PENALTY,
      flagged: false,
      source,
    },
    { kind: "glue", width: 2, stretch: 1, shrink: 2 / 3, source },
    box(10),
    { kind: "penalty", width: 0, penalty: 0, flagged: false, source },
    box(390),
    ...finish(),
  ]

  test("an underfull line with nothing to stretch scores inf_bad, not infinity", () => {
    const result = breakParagraphOnce(mustBreakShort(), MEASURE, {
      tolerance: INFINITE_BADNESS,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const ratio = result.lines[0]?.adjustmentRatio ?? 0
    expect(Number.isFinite(ratio)).toBe(true)
    expect(ratio).toBeCloseTo(Math.cbrt(100), 12)
    expect(100 * ratio ** 3).toBeCloseTo(INFINITE_BADNESS, 6)
  })

  test("that line lands in the very loose class, two classes from its neighbour", () => {
    const charge = (adjDemerits: number) => {
      const result = breakParagraphOnce(mustBreakShort(), MEASURE, {
        tolerance: INFINITE_BADNESS,
        policy: { adjDemerits },
      })
      return result.ok ? result.demerits : Number.NaN
    }
    expect(charge(10_000) - charge(0)).toBe(20_000)
  })

  test("a line priced above inf_bad is still admitted on an inf_bad rung", () => {
    expect(
      breakParagraphOnce(aboveInfBad(), MEASURE, {
        tolerance: texDefaults.tolerance,
      }).ok,
    ).toBe(false)
    expect(
      breakParagraphOnce(aboveInfBad(), MEASURE, {
        tolerance: INFINITE_BADNESS,
      }).ok,
    ).toBe(true)
  })

  test("the admitted line reports its true ratio, not the saturated one", () => {
    const result = breakParagraphOnce(aboveInfBad(), MEASURE, {
      tolerance: INFINITE_BADNESS,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const line = result.lines[0]
    expect(line?.adjustmentRatio).toBe(378)
    expect(line?.adjustmentRatio).toBe(
      (MEASURE - (line?.naturalWidth ?? 0)) / (line?.stretch ?? 1),
    )
  })
})
