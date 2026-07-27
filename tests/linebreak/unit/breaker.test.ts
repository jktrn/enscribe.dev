import { describe, expect, test } from "bun:test"
import {
  breakParagraph,
  breakParagraphWithFallback,
} from "@linebreak/layout/breaker"
import {
  breakPenalty,
  type Discretionary,
  forcedBreak,
  isFlaggedBreak,
  type Item,
  paragraphTerminator,
} from "@linebreak/layout/items"
import { FORBIDDEN_PENALTY, policy } from "@linebreak/policy"

const SPACE = 10
const WORD = 25
const MEASURE = 400
const TEX_SHRINK = 1 / 3

const source = { start: 0, end: 0 }

const box = (width: number): Item => ({ kind: "box", width, source })

const glue = (shrinkRatio = TEX_SHRINK): Item => ({
  kind: "glue",
  width: SPACE,
  stretch: SPACE * policy.glue.stretch,
  shrink: SPACE * shrinkRatio,
  source: { start: 0, end: 1 },
})

const finish = () => paragraphTerminator(0)

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

const discretionary = (
  overrides: Partial<Discretionary> = {},
): Discretionary => ({
  kind: "discretionary",
  preWidth: 43,
  postWidth: 50,
  noBreakWidth: 90,
  penalty: policy.penalty.hyphen,
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
      penalty: FORBIDDEN_PENALTY,
      flagged: false,
      source,
    }
    expect(breakPenalty([box(10), forbidden, ...finish()], 1)).toBeNull()
  })

  test("the terminator forbids breaking at its finishing glue", () => {
    const items = [box(10), ...finish()]

    expect(breakPenalty(items, 2)).toBeNull()
  })
})

describe("feasibility", () => {
  test("a box wider than the measure cannot be broken to fit", () => {
    expect(breakParagraph([box(5000), ...finish()], MEASURE).ok).toBe(false)
  })

  test("an interior line with no stretchable glue is infinitely bad", () => {
    expect(breakParagraph([box(350), box(350), ...finish()], MEASURE).ok).toBe(
      false,
    )
  })

  test("ordinary prose breaks successfully", () => {
    expect(breakParagraph(evenWords(40), MEASURE).ok).toBe(true)
  })

  test("no interior line falls outside the feasible band", () => {
    const result = breakParagraph(evenWords(40), MEASURE)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    for (const line of result.lines.slice(0, -1)) {
      expect(line.adjustmentRatio).toBeGreaterThanOrEqual(-1)
      expect(line.adjustmentRatio).toBeLessThanOrEqual(policy.fit.tolerance)
    }
  })
})

describe("the last line is free", () => {
  test("a short final line costs nothing", () => {
    const result = breakParagraph(evenWords(23), MEASURE)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const last = result.lines.at(-1)
    expect(last).toBeDefined()

    expect(Math.abs(last?.adjustmentRatio ?? 1)).toBeLessThan(0.001)
  })
})

describe("squared demerits minimise the worst line", () => {
  test("a wide word mid-paragraph does not strand one very loose line", () => {
    const widths = Array.from({ length: 30 }, (_, index) =>
      index === 14 ? 150 : WORD,
    )
    const result = breakParagraph(paragraph(widths), MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const interior = result.lines
      .slice(0, -1)
      .map((line) => line.adjustmentRatio)
    expect(interior.length).toBeGreaterThan(1)

    expect(Math.max(...interior)).toBeLessThanOrEqual(policy.fit.tolerance)
  })
})

describe("discretionaries", () => {
  test("a taken discretionary marks the line for a hyphen", () => {
    const items: Item[] = [
      ...Array.from({ length: 9 }, () => [box(WORD), glue()]).flat(),
      discretionary({ preWidth: 90, postWidth: 100, noBreakWidth: 185 }),
      ...finish(),
    ]

    const result = breakParagraph(items, MEASURE)
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
    const result = breakParagraph([whole, ...finish()], MEASURE)

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

    const result = breakParagraph(items, MEASURE)
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

    const result = breakParagraph(items, MEASURE)
    expect(result.ok).toBe(true)
    if (!result.ok || result.lines.length < 2) return

    expect(result.lines[1]?.naturalWidth).toBe(100)
  })
})

describe("authored breaks", () => {
  const withBreak = (before: number, after: number): Item[] => [
    ...Array.from({ length: before }, (_, index) =>
      index > 0 ? [glue(), box(WORD)] : [box(WORD)],
    ).flat(),
    ...forcedBreak(0, 1),
    ...Array.from({ length: after }, (_, index) =>
      index > 0 ? [glue(), box(WORD)] : [box(WORD)],
    ).flat(),
    ...finish(),
  ]

  test("a forced break ends its line however short the line is", () => {
    const result = breakParagraph(withBreak(3, 20), MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines.length).toBeGreaterThan(1)
    expect(result.lines[0]?.breakKind).toBe("forced")
    expect(result.lines[0]?.naturalWidth).toBeLessThan(MEASURE / 2)
  })

  test("a forced break costs a short line nothing", () => {
    const result = breakParagraph(withBreak(3, 20), MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const ratio = Math.abs(result.lines[0]?.adjustmentRatio ?? 1)
    expect(ratio).toBeLessThan(policy.fit.tolerance / 100)
  })

  test("the line after a forced break starts at the following text", () => {
    const result = breakParagraph(withBreak(3, 20), MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [first, second] = result.lines
    expect(second).toBeDefined()
    expect(second?.start).toBeGreaterThan(first?.end ?? 0)
  })

  test("a break with nothing after it is declined, not set as an empty line", () => {
    const trailing: Item[] = [
      ...Array.from({ length: 12 }, (_, index) =>
        index > 0 ? [glue(), box(WORD)] : [box(WORD)],
      ).flat(),
      ...forcedBreak(0, 1),
      ...finish(),
    ]
    const result = breakParagraph(trailing, MEASURE, { force: true })

    expect(result.ok).toBe(false)
  })

  test("every line of a well-formed paragraph holds something", () => {
    const result = breakParagraph(withBreak(3, 20), MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines) {
      expect(line.end).toBeGreaterThan(line.start)
      expect(line.sourceEnd).toBeGreaterThanOrEqual(line.sourceStart)
    }
  })
})

describe("what a break did to the text", () => {
  test("a break at a penalty consumed no space and drew no hyphen", () => {
    const items: Item[] = []
    for (let index = 0; index < 24; index += 1) {
      if (index > 0) items.push(glue())
      items.push(box(WORD))
      if (index === 11) {
        items.push({
          kind: "penalty",
          width: 0,
          penalty: 0,
          flagged: false,
          source: { start: 0, end: 0 },
        })
        items.push(box(WORD))
      }
    }
    const result = breakParagraph([...items, ...finish()], MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const atPenalty = result.lines.find((line) => line.end === 23)
    expect(atPenalty).toBeDefined()
    expect(atPenalty?.breakKind).toBe("none")
    expect(result.lines.some((line) => line.breakKind === "space")).toBe(true)
  })

  test("a break just before a space still reports the space it ate", () => {
    const items: Item[] = []
    for (let index = 0; index < 24; index += 1) {
      if (index > 0) items.push(glue())
      items.push(box(WORD))
      if (index === 11) {
        items.push({
          kind: "penalty",
          width: 0,
          penalty: 0,
          flagged: false,
          source: { start: 0, end: 0 },
        })
      }
    }
    const result = breakParagraph([...items, ...finish()], MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines.slice(0, -1)) {
      expect(line.breakKind).toBe("space")
    }
  })

  test("an ordinary break consumed the space it fell on", () => {
    const result = breakParagraph(evenWords(40), MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines.slice(0, -1)) {
      expect(line.breakKind).toBe("space")
    }

    expect(result.lines.at(-1)?.breakKind).toBe("forced")
  })
})

describe("penalties", () => {
  test("a negative penalty pulls the break to its point", () => {
    const build = (penalty: number): Item[] => {
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

    const neutral = breakParagraph(build(0), MEASURE)
    const attractive = breakParagraph(build(-95), MEASURE)

    expect(neutral.ok).toBe(true)
    expect(attractive.ok).toBe(true)
    if (!neutral.ok || !attractive.ok) return

    expect(attractive.lines[0]?.end).not.toBe(neutral.lines[0]?.end)
  })
})

describe("tolerance", () => {
  test("bounds looseness only — a tight line is limited by r >= -1, not by tolerance", () => {
    const result = breakParagraph(evenWords(30), MEASURE, { tolerance: 0.05 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(
      result.lines
        .slice(0, -1)
        .every(({ adjustmentRatio }) => adjustmentRatio < 0),
    ).toBe(true)
  })

  test("the relaxed pass rescues a paragraph the strict pass declines", () => {
    const items = paragraph(Array.from({ length: 9 }, () => 90))

    const strict = breakParagraph(items, MEASURE, { tolerance: 0.5 })
    const relaxed = breakParagraphWithFallback(items, MEASURE)

    expect(strict.ok).toBe(false)
    expect(relaxed.ok).toBe(true)
  })
})

describe("the final pass", () => {
  const unbreakable = () =>
    paragraph(Array.from({ length: 12 }, () => MEASURE - SPACE))

  test("without forcing, an unfittable paragraph is declined", () => {
    expect(breakParagraph(unbreakable(), MEASURE).ok).toBe(false)
  })

  test("forcing breaks it anyway rather than abandoning it", () => {
    const result = breakParagraph(unbreakable(), MEASURE, { force: true })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines.length).toBeGreaterThan(1)
  })

  test("the fallback reaches the final pass on its own", () => {
    expect(breakParagraphWithFallback(unbreakable(), MEASURE).ok).toBe(true)
  })

  test("forcing still covers the paragraph in order without gaps", () => {
    const result = breakParagraph(unbreakable(), MEASURE, { force: true })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const [index, line] of result.lines.entries()) {
      expect(line.end).toBeGreaterThan(line.start)
      const next = result.lines[index + 1]
      if (next) expect(next.start).toBeGreaterThan(line.end - 1)
    }
  })

  test("forcing does not change a paragraph that was already feasible", () => {
    const plain = breakParagraph(evenWords(40), MEASURE)
    const forcing = breakParagraph(evenWords(40), MEASURE, { force: true })

    expect(plain.ok).toBe(true)
    expect(forcing.ok).toBe(true)
    if (!plain.ok || !forcing.ok) return
    expect(forcing.lines.map((line) => line.end)).toEqual(
      plain.lines.map((line) => line.end),
    )
  })

  test("a forced line reports the spaces the renderer compresses", () => {
    const items = paragraph([...Array.from({ length: 8 }, () => 120)])
    const result = breakParagraph(items, MEASURE, { force: true })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines) {
      if (line.naturalWidth <= MEASURE) continue
      expect(line.spaceCount).toBeGreaterThan(0)
    }
  })
})

describe("shipped policy", () => {
  test("glue shrinks, and the renderer supplies what CSS cannot", () => {
    expect(policy.glue.shrink).toBeGreaterThan(0)
  })

  test("the last line does not count the finishing glue as a space", () => {
    const items = evenWords(23)
    const result = breakParagraph(items, MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const last = result.lines.at(-1)
    expect(last).toBeDefined()
    if (!last) return

    let glueItems = 0
    for (let index = last.start; index < last.end; index += 1) {
      if (items[index]?.kind === "glue") glueItems += 1
    }

    expect(glueItems).toBeGreaterThan(0)
    expect(last.spaceCount).toBe(glueItems - 1)
  })

  test("a tight line reports the space count needed to distribute its shrink", () => {
    const result = breakParagraph(evenWords(40), MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines.slice(0, -1)) {
      if (line.adjustmentRatio >= 0) continue

      expect(line.spaceCount).toBeGreaterThan(0)
    }
  })

  test("hyphenation is off by default", () => {
    expect(policy.hyphenate).toBe(false)
  })
})

describe("line coverage", () => {
  test("lines partition the paragraph in order without gaps", () => {
    const result = breakParagraph(evenWords(40), MEASURE)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    for (const [index, line] of result.lines.entries()) {
      expect(line.end).toBeGreaterThan(line.start)
      const next = result.lines[index + 1]
      if (next) expect(next.start).toBeGreaterThan(line.end - 1)
    }
  })
})
