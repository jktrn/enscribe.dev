import { describe, expect, test } from "bun:test"
import { breakParagraph, breakParagraphOnce } from "@linebreak/layout/breaker"
import { type Item } from "@linebreak/layout/items"
import { defaultGlue, texDefaults } from "@linebreak/layout/policy"
import {
  SPACE,
  MEASURE,
  source,
  box,
  glue,
  finish,
  paragraph,
  evenWords,
  glueBetween,
  strictPass,
} from "./support/breaker-fixtures"

describe("tolerance is expressed as badness, like TeX", () => {
  test("the published defaults are plain.tex's", () => {
    expect(texDefaults.pretolerance).toBe(100)
    expect(texDefaults.tolerance).toBe(200)
  })

  test("a tight tolerance bounds both stretching and shrinking badness", () => {
    const result = breakParagraphOnce(evenWords(30), MEASURE, {
      tolerance: 100 * 0.05 ** 3,
    })
    expect(result.ok).toBe(false)
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

  test("setting the emergency stretch to zero removes that rung entirely", () => {
    const result = breakParagraph(unbreakable(), MEASURE, {
      emergencyStretch: 0,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pass).toBe("forced")
  })

  test("a larger emergency stretch buys looser lines at a lower reported cost", () => {
    const loosest = (stretch: number) => {
      const result = breakParagraph(unbreakable(), MEASURE, {
        emergencyStretch: stretch,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return Number.NaN
      expect(result.pass).toBe("emergency")
      return Math.max(...result.lines.map((l) => Math.abs(l.adjustmentRatio)))
    }
    expect(loosest(SPACE * 14)).toBeLessThan(loosest(SPACE * 4))
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

  test("a negative tolerance excludes the shrink boundary too", () => {
    const result = breakParagraphOnce(atShrinkLimit(), SHRINK_TARGET, {
      tolerance: -1,
    })
    expect(result.ok).toBe(false)
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
