import { describe, expect, test } from "bun:test"
import { breakParagraph, breakParagraphOnce } from "@linebreak/layout/breaker"
import {
  breakPenalty,
  type Discretionary,
  isFlaggedBreak,
  type Item,
  lineBreak,
  paragraphEnd,
} from "@linebreak/layout/items"
import {
  defaultGlue,
  INFINITE_BADNESS,
  INFINITE_PENALTY,
  texDefaults,
} from "@linebreak/layout/policy"

const SPACE = 10
const WORD = 25
const MEASURE = 400

const source = { start: 0, end: 0 }

const box = (width: number): Item => ({ kind: "box", width, source })

const glue = (shrinkRatio = defaultGlue.shrink): Item => ({
  kind: "glue",
  width: SPACE,
  stretch: SPACE * defaultGlue.stretch,
  shrink: SPACE * shrinkRatio,
  source: { start: 0, end: 1 },
})

const finish = () => paragraphEnd(0)

const paragraph = (widths: number[]): Item[] => {
  const items: Item[] = []
  for (const [index, width] of widths.entries()) {
    if (index > 0) items.push(glue())
    items.push(box(width))
  }
  return [...items, ...finish()]
}

const evenWords = (count: number) =>
  paragraph(Array.from({ length: count }, () => WORD))

const wordsWithPenaltyAt = (count: number, at: number): Item[] => {
  const items: Item[] = []
  for (let index = 0; index < count; index += 1) {
    if (index > 0) items.push(glue())
    items.push(box(WORD))
    if (index !== at) continue
    items.push({
      kind: "penalty",
      width: 0,
      penalty: 0,
      flagged: false,
      source,
    })
    items.push(box(WORD))
  }
  return items
}

const glueBetween = (items: readonly Item[], from: number, to: number) => {
  let count = 0
  for (let index = from; index < to; index += 1) {
    if (items[index]?.kind === "glue") count += 1
  }
  return count
}

const strictPass = (items: readonly Item[], measure = MEASURE, force = false) =>
  breakParagraphOnce(items, measure, {
    tolerance: texDefaults.pretolerance,
    force,
  })

const discretionary = (
  overrides: Partial<Discretionary> = {},
): Discretionary => ({
  kind: "discretionary",
  preWidth: 43,
  postWidth: 50,
  noBreakWidth: 90,
  penalty: texDefaults.hyphenPenalty,
  hyphen: true,
  source,
  breakOffset: 0,
  ...overrides,
})

describe("breakpoint legality", () => {
  test("glue is breakable only after something that occupies space", () => {
    const items: Item[] = [box(10), glue(), glue(), box(10), ...finish()]
    expect(breakPenalty(items, 1)).toBe(0)
    expect(breakPenalty(items, 2)).toBeNull()
  })

  test("a box is never a breakpoint", () => {
    expect(breakPenalty([box(10), ...finish()], 0)).toBeNull()
  })

  test("a forbidden penalty is not a breakpoint", () => {
    const forbidden: Item = {
      kind: "penalty",
      width: 0,
      penalty: INFINITE_PENALTY,
      flagged: false,
      source,
    }
    expect(breakPenalty([box(10), forbidden, ...finish()], 1)).toBeNull()
  })

  test("the paragraph end forbids breaking at its finishing glue", () => {
    expect(breakPenalty([box(10), ...finish()], 2)).toBeNull()
  })
})

describe("feasibility", () => {
  test("a box wider than the measure cannot be broken to fit", () => {
    expect(strictPass([box(5000), ...finish()]).ok).toBe(false)
  })

  test("an interior line with no stretchable glue is infinitely bad", () => {
    expect(strictPass([box(350), box(350), ...finish()]).ok).toBe(false)
  })

  test("an empty item list reports why", () => {
    const result = breakParagraph([], MEASURE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe("empty")
  })

  test("ordinary prose breaks successfully", () => {
    expect(strictPass(evenWords(40)).ok).toBe(true)
  })

  test("no interior line falls outside the feasible band", () => {
    const result = strictPass(evenWords(40))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines.slice(0, -1)) {
      expect(line.adjustmentRatio).toBeGreaterThanOrEqual(-1)
      expect(line.adjustmentRatio).toBeLessThanOrEqual(1)
    }
  })
})

describe("the last line is free", () => {
  test("a short final line costs nothing", () => {
    const result = strictPass(evenWords(23))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Math.abs(result.lines.at(-1)?.adjustmentRatio ?? 1)).toBeLessThan(
      0.001,
    )
  })
})

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

describe("discretionaries", () => {
  test("a taken discretionary marks the line for a hyphen", () => {
    const items: Item[] = [
      ...Array.from({ length: 9 }, () => [box(WORD), glue()]).flat(),
      discretionary({ preWidth: 90, postWidth: 100, noBreakWidth: 185 }),
      ...finish(),
    ]
    const result = strictPass(items)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines[0]?.breakKind).toBe("hyphen")
  })

  test("an untaken discretionary contributes its whole-word width", () => {
    const whole = discretionary({
      preWidth: 60,
      postWidth: 50,
      noBreakWidth: 103,
    })
    const result = strictPass([whole, ...finish()])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]?.naturalWidth).toBe(103)
    expect(result.lines[0]?.breakKind).not.toBe("hyphen")
  })

  test("a code break marks no hyphen, because it draws none", () => {
    const items: Item[] = [
      ...Array.from({ length: 11 }, () => [box(WORD), glue()]).flat(),
      discretionary({
        preWidth: 0,
        postWidth: 100,
        noBreakWidth: 185,
        penalty: 0,
        hyphen: false,
      }),
      ...finish(),
    ]
    const result = strictPass(items)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]?.breakKind).not.toBe("hyphen")
  })

  test("only a hyphenating break counts as flagged", () => {
    expect(isFlaggedBreak(discretionary({ hyphen: true }))).toBe(true)
    expect(isFlaggedBreak(discretionary({ hyphen: false, preWidth: 0 }))).toBe(
      false,
    )
  })

  test("a broken discretionary charges pre to one line and post to the next", () => {
    const items: Item[] = [
      ...Array.from({ length: 9 }, () => [box(WORD), glue()]).flat(),
      discretionary({ preWidth: 90, postWidth: 100, noBreakWidth: 185 }),
      ...finish(),
    ]
    const result = strictPass(items)
    expect(result.ok).toBe(true)
    if (!result.ok || result.lines.length < 2) return
    expect(result.lines[1]?.naturalWidth).toBe(100)
  })
})

describe("authored breaks", () => {
  const words = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      index > 0 ? [glue(), box(WORD)] : [box(WORD)],
    ).flat()

  const withBreak = (before: number, after: number): Item[] => [
    ...words(before),
    ...lineBreak(0, 1),
    ...words(after),
    ...finish(),
  ]

  test("a forced break ends its line however short the line is", () => {
    const result = strictPass(withBreak(3, 20))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines.length).toBeGreaterThan(1)
    expect(result.lines[0]?.breakKind).toBe("forced")
    expect(result.lines[0]?.naturalWidth).toBeLessThan(MEASURE / 2)
  })

  test("a forced break costs a short line nothing", () => {
    const result = strictPass(withBreak(3, 20))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Math.abs(result.lines[0]?.adjustmentRatio ?? 1)).toBeLessThan(0.01)
  })

  test("the line after a forced break starts at the following text", () => {
    const result = strictPass(withBreak(3, 20))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [first, second] = result.lines
    expect(second).toBeDefined()
    expect(second?.start).toBeGreaterThan(first?.end ?? 0)
  })

  test("two adjacent forced breaks produce a blank line, not a failure", () => {
    const items: Item[] = [
      ...words(6),
      ...lineBreak(0, 1),
      ...lineBreak(1, 2),
      ...words(6),
      ...finish(),
    ]
    const result = breakParagraph(items, MEASURE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines.length).toBeGreaterThanOrEqual(3)
    expect(result.lines.some((line) => line.start === line.end)).toBe(true)
  })

  test("every line covers a non-negative span", () => {
    const result = strictPass(withBreak(3, 20))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines) {
      expect(line.end).toBeGreaterThanOrEqual(line.start)
      expect(line.sourceEnd).toBeGreaterThanOrEqual(line.sourceStart)
    }
  })
})

describe("what a break did to the text", () => {
  test("a break at a penalty consumed no space and drew no hyphen", () => {
    const result = strictPass([...wordsWithPenaltyAt(24, 11), ...finish()])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const atPenalty = result.lines.find((line) => line.end === 23)
    expect(atPenalty).toBeDefined()
    expect(atPenalty?.breakKind).toBe("none")
    expect(result.lines.some((line) => line.breakKind === "space")).toBe(true)
  })

  test("an ordinary break consumed the space it fell on", () => {
    const result = strictPass(evenWords(40))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines.slice(0, -1)) {
      expect(line.breakKind).toBe("space")
    }
  })

  test("the paragraph's last line reports 'end', never 'forced'", () => {
    const result = strictPass(evenWords(40))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines.at(-1)?.breakKind).toBe("end")
    expect(result.lines.slice(0, -1).some((l) => l.breakKind === "end")).toBe(
      false,
    )
  })
})

describe("tolerance is expressed as badness, like TeX", () => {
  test("the published defaults are plain.tex's", () => {
    expect(texDefaults.pretolerance).toBe(100)
    expect(texDefaults.tolerance).toBe(200)
  })

  test("a tight tolerance bounds looseness only; r >= -1 bounds tightness", () => {
    const result = breakParagraphOnce(evenWords(30), MEASURE, {
      tolerance: 100 * 0.05 ** 3,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines.slice(0, -1).every((l) => l.adjustmentRatio < 0)).toBe(
      true,
    )
  })

  test("the relaxed pass rescues a paragraph the strict pass declines", () => {
    const items = paragraph(Array.from({ length: 9 }, () => 90))
    const strict = breakParagraphOnce(items, MEASURE, {
      tolerance: 100 * 0.5 ** 3,
    })
    const laddered = breakParagraph(items, MEASURE)
    expect(strict.ok).toBe(false)
    expect(laddered.ok).toBe(true)
  })
})

describe("the fallback ladder", () => {
  const unbreakable = () =>
    paragraph(Array.from({ length: 12 }, () => MEASURE - SPACE))

  test("without forcing, an unfittable paragraph is declined", () => {
    expect(strictPass(unbreakable()).ok).toBe(false)
  })

  test("forcing breaks it anyway rather than abandoning it", () => {
    const result = strictPass(unbreakable(), MEASURE, true)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines.length).toBeGreaterThan(1)
  })

  test("emergency stretch rescues it, and reports which pass did", () => {
    const result = breakParagraph(unbreakable(), MEASURE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pass).toBe("emergency")
    expect(result.lines.length).toBeGreaterThanOrEqual(12)
  })

  test("the forced pass is what catches a paragraph nothing else can", () => {
    const result = breakParagraphOnce([box(5000), ...finish()], MEASURE, {
      tolerance: texDefaults.tolerance,
      force: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pass).toBe("forced")
  })

  test("easy prose is reported as solved on the first pass", () => {
    const result = breakParagraph(evenWords(40), MEASURE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pass).toBe("pretolerance")
  })

  test("forcing does not change a paragraph that was already feasible", () => {
    const plain = strictPass(evenWords(40))
    const forcing = strictPass(evenWords(40), MEASURE, true)
    expect(plain.ok && forcing.ok).toBe(true)
    if (!plain.ok || !forcing.ok) return
    expect(forcing.lines.map((l) => l.end)).toEqual(
      plain.lines.map((l) => l.end),
    )
  })

  test("a forced line reports the spaces the renderer compresses", () => {
    const items = paragraph(Array.from({ length: 8 }, () => 120))
    const result = strictPass(items, MEASURE, true)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines) {
      if (line.naturalWidth <= MEASURE) continue
      expect(line.spaceCount).toBeGreaterThan(0)
    }
  })
})

describe("a negative tolerance skips a pass, it does not open one", () => {
  const SHRINK_TARGET = 202

  const atShrinkLimit = (): Item[] => {
    const tight = (): Item => ({
      kind: "glue",
      width: 10,
      stretch: 5,
      shrink: 8,
      source: { start: 0, end: 1 },
    })
    return [
      box(100),
      tight(),
      box(100),
      tight(),
      box(100),
      tight(),
      box(100),
      ...finish(),
    ]
  }

  test("the ladder starts at the tolerance rung when pretolerance is negative", () => {
    const skipped = breakParagraph(atShrinkLimit(), SHRINK_TARGET, {
      policy: { pretolerance: -1 },
    })
    const rung = breakParagraphOnce(atShrinkLimit(), SHRINK_TARGET, {
      tolerance: texDefaults.tolerance,
    })
    expect(skipped.ok && rung.ok).toBe(true)
    if (!skipped.ok || !rung.ok) return

    expect(skipped.pass).not.toBe("pretolerance")
    expect(skipped.pass).toBe("tolerance")
    expect(skipped.lines).toEqual(rung.lines)
  })

  test("the same paragraph is solved on pass one when pretolerance is positive", () => {
    const result = breakParagraph(atShrinkLimit(), SHRINK_TARGET)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pass).toBe("pretolerance")
  })

  test("a negative tolerance admits nothing an ordinary paragraph offers", () => {
    expect(
      breakParagraphOnce(evenWords(40), MEASURE, { tolerance: -1 }).ok,
    ).toBe(false)
  })

  test("the band of a negative tolerance closes at -1, not at NaN", () => {
    const result = breakParagraphOnce(atShrinkLimit(), SHRINK_TARGET, {
      tolerance: -1,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines.map((line) => line.adjustmentRatio)).toEqual([-1, -1])
  })

  test("forcing a negative tolerance still reports finite geometry", () => {
    const result = breakParagraphOnce(evenWords(40), MEASURE, {
      tolerance: -1,
      force: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines) {
      expect(Number.isFinite(line.adjustmentRatio)).toBe(true)
      expect(Number.isFinite(line.naturalWidth)).toBe(true)
    }
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

describe("shipped policy", () => {
  test("interword glue uses Computer Modern's elasticity", () => {
    expect(defaultGlue.stretch).toBeCloseTo(1 / 2)
    expect(defaultGlue.shrink).toBeCloseTo(1 / 3)
  })

  test("the last line does not count the finishing glue as a space", () => {
    const items = evenWords(23)
    const result = strictPass(items)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const last = result.lines.at(-1)
    if (!last) return

    const glueItems = glueBetween(items, last.start, last.end)
    expect(glueItems).toBeGreaterThan(0)
    expect(last.spaceCount).toBe(glueItems - 1)
  })

  test("a tight line reports the space count needed to distribute its shrink", () => {
    const result = strictPass(evenWords(40))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines.slice(0, -1)) {
      if (line.adjustmentRatio >= 0) continue
      expect(line.spaceCount).toBeGreaterThan(0)
    }
  })
})

describe("line coverage", () => {
  test("lines partition the paragraph in order without gaps", () => {
    const result = strictPass(evenWords(40))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const [index, line] of result.lines.entries()) {
      expect(line.end).toBeGreaterThan(line.start)
      const next = result.lines[index + 1]
      if (next) expect(next.start).toBeGreaterThan(line.end - 1)
    }
  })

  test("solving the same items twice at one measure is stable", () => {
    const items = evenWords(40)
    const a = breakParagraph(items, MEASURE)
    const b = breakParagraph(items, MEASURE)
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(b.lines.map((l) => l.end)).toEqual(a.lines.map((l) => l.end))
  })
})
