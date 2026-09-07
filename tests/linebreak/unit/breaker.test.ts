import { describe, expect, test } from "bun:test"
import { breakParagraph } from "@linebreak/layout/breaker"
import {
  breakPenalty,
  isFlaggedBreak,
  type Item,
  lineBreak,
} from "@linebreak/layout/items"
import { INFINITE_PENALTY } from "@linebreak/layout/policy"
import {
  WORD,
  MEASURE,
  source,
  box,
  glue,
  finish,
  paragraph,
  evenWords,
  wordsWithPenaltyAt,
  strictPass,
  discretionary,
} from "./support/breaker-fixtures"

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
