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

/**
 * Proportions matter here. A line only has real adjustment range when it holds
 * many words; a fixture with wide words and few spaces makes almost every
 * breakpoint infeasible — correct Knuth-Plass behavior, but useless for testing
 * anything else. These widths approximate prose at a comfortable measure.
 *
 * The optimizer is a general Knuth-Plass implementation and handles shrinkable
 * glue. CSS justification cannot compress spaces, so the renderer supplies the
 * shrink a tight line needs as a negative word-spacing and lets justification
 * fill the remainder; that arrangement is asserted under "shipped policy".
 */
const SPACE = 10
const WORD = 25
const MEASURE = 400
const TEX_SHRINK = 1 / 3

const source = { start: 0, end: 0 }

const box = (width: number): Item => ({ kind: "box", width, source })

/**
 * Glue standing for a real space character, so its source spans one character.
 * A zero-length span marks glue with no text behind it — the paragraph's
 * finishing glue — which the renderer cannot hang word-spacing on.
 */
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
    // The second glue follows glue, not a box.
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
    // items[1] is the forbidden penalty, items[2] the infinite glue.
    expect(breakPenalty(items, 2)).toBeNull()
  })
})

describe("feasibility", () => {
  test("a box wider than the measure cannot be broken to fit", () => {
    expect(breakParagraph([box(5000), ...finish()], MEASURE).ok).toBe(false)
  })

  test("an interior line with no stretchable glue is infinitely bad", () => {
    // Adjacent boxes cannot be separated and neither part could stretch.
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
    // Infinite finishing stretch absorbs the slack, so the ratio is ~0 no
    // matter how little text the line holds. This is why the cost function
    // needs no special case for the final line.
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
    // The squaring in (1 + badness)^2 minimises the maximum, so the cost of the
    // wide word is spread rather than dumped on a single line.
    expect(Math.max(...interior)).toBeLessThanOrEqual(policy.fit.tolerance)
  })
})

describe("discretionaries", () => {
  test("a taken discretionary marks the line for a hyphen", () => {
    // A word too wide to fit whole at the end of the line, whose halves fit.
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
    // Whole-word width differs from pre + post, as kerning makes it. The line
    // must report the whole-word width, never the sum of the halves.
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
    // A break inside an identifier wraps without adding a character. Marking
    // the line for a hyphen would both show one the author never wrote and make
    // the rendered line wider than the width the optimizer fitted — wide enough
    // that the browser wraps it and the paragraph falls back.
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
    // TeX's alpha exists because two hyphenated lines in a row read badly. Two
    // lines that wrapped inside an identifier do not.
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

    // The continuation line carries only the post-break half.
    expect(result.lines[1]?.naturalWidth).toBe(100)
  })
})

describe("authored breaks", () => {
  /** Words, then a `<br>`, then more words. */
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
    // Three words on a 400px measure is nowhere near full. Without the break
    // the optimizer would happily carry on.
    const result = breakParagraph(withBreak(3, 20), MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines.length).toBeGreaterThan(1)
    expect(result.lines[0]?.breakKind).toBe("forced")
    expect(result.lines[0]?.naturalWidth).toBeLessThan(MEASURE / 2)
  })

  test("a forced break costs a short line nothing", () => {
    // Infinite fill absorbs the slack, so the line is not merely tolerated —
    // it is free, exactly as the paragraph's own last line is. Three words on a
    // 400px measure would otherwise be ruinously loose.
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
    // A trailing `<br>` describes a line holding nothing, which a renderer that
    // makes one element per line cannot express. `compileBlock` drops such a
    // break before it reaches here; reaching here anyway, the optimizer refuses
    // to propose the line rather than emitting `end <= start`.
    const trailing: Item[] = [
      ...Array.from({ length: 12 }, (_, index) =>
        index > 0 ? [glue(), box(WORD)] : [box(WORD)],
      ).flat(),
      ...forcedBreak(0, 1),
      ...finish(),
    ]
    const result = breakParagraph(trailing, MEASURE, { force: true })

    // Declining is the correct outcome, and asserting it is what makes this
    // test fail if the empty-line guard is ever removed — without the guard the
    // same fixture returns ok with a line whose end precedes its start.
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
    // The break opportunity the segmenter finds after an authored hyphen —
    // "apartment-|style". Rejoining the lines with a space there would put a
    // character in the reader's copy that the author never wrote.
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
    // The line that ends at the inserted penalty is the one under test. It must
    // say it consumed nothing: a "hyphen" here draws a hyphen the author never
    // wrote, and a "space" puts one into the reader's clipboard.
    const atPenalty = result.lines.find((line) => line.end === 23)
    expect(atPenalty).toBeDefined()
    expect(atPenalty?.breakKind).toBe("none")
    expect(result.lines.some((line) => line.breakKind === "space")).toBe(true)
  })

  test("a break just before a space still reports the space it ate", () => {
    // Breaking at a zero-width penalty discards the glue after it, so that
    // space is gone from the rendered text as surely as if the break had landed
    // on it. Reporting "none" here is what makes the clipboard run two words
    // together — a `<wbr>` immediately before a space is the reachable case.
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
    // A paragraph ends at a forced break like any other; nothing follows it
    // in the DOM, so nothing is rejoined there.
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
        // A candidate break sitting one word short of where the optimizer
        // would otherwise land.
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
    // With -p^2 subtracted the attractive point wins; if the penalty were added
    // linearly instead, both layouts would agree.
    expect(attractive.lines[0]?.end).not.toBe(neutral.lines[0]?.end)
  })
})

describe("tolerance", () => {
  test("bounds looseness only — a tight line is limited by r >= -1, not by tolerance", () => {
    // Words that pack tightly produce negative ratios. However small the
    // tolerance, those lines stay feasible; this is TeX's rule, not an
    // oversight.
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
    // Wide words leave every line needing to stretch, so a low tolerance has
    // nothing feasible to choose.
    const items = paragraph(Array.from({ length: 9 }, () => 90))

    const strict = breakParagraph(items, MEASURE, { tolerance: 0.5 })
    const relaxed = breakParagraphWithFallback(items, MEASURE)

    expect(strict.ok).toBe(false)
    expect(relaxed.ok).toBe(true)
  })
})

describe("the final pass", () => {
  // Words too wide to fit the measure however they are grouped. Without
  // forcing, every active node is retired and the paragraph is abandoned.
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
    // The renderer makes an overfull line fit with negative word-spacing, so a
    // forced line is only renderable if it says how many spaces to spread that
    // across.
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
    // CSS justification only stretches, so a line set tighter than natural is
    // produced by authoring a negative word-spacing sized to make it fit, after
    // which justification fills the remainder. Removing shrink instead was
    // measurably worse: 41 more lines on one article, average stretch 77%
    // higher, and rivers where there had been none.
    expect(policy.glue.shrink).toBeGreaterThan(0)
  })

  test("the last line does not count the finishing glue as a space", () => {
    // The renderer divides a line's overflow by this count to size the negative
    // word-spacing. Counting the finishing glue — which has no space character
    // behind it — spreads the shrink one space too thin, and the last line of
    // every tight paragraph ends up wide enough to wrap.
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
    // Exactly one glue item in range is the terminator's, and it is not a space.
    expect(glueItems).toBeGreaterThan(0)
    expect(last.spaceCount).toBe(glueItems - 1)
  })

  test("a tight line reports the space count needed to distribute its shrink", () => {
    const result = breakParagraph(evenWords(40), MEASURE)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.lines.slice(0, -1)) {
      if (line.adjustmentRatio >= 0) continue
      // Without a space to absorb it, a shrink has nowhere to go.
      expect(line.spaceCount).toBeGreaterThan(0)
    }
  })

  test("hyphenation is off by default", () => {
    // A break inside a word puts a line boundary there, and the browser reports
    // that boundary as a newline, so the rendered text would stop matching the
    // authored text. Callers opt in.
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
