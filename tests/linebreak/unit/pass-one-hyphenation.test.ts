import { describe, expect, test } from "bun:test"
import { breakParagraph } from "@linebreak/layout/breaker"
import {
  box,
  discretionary,
  glue,
  type Item,
  paragraphEnd,
} from "@linebreak/layout/items"
import { defaultGlue, texDefaults } from "@linebreak/layout/policy"

const SPACE = 10
const HYPHEN = 5
const MEASURE = 400
const source = { start: 0, end: 0 }

const space = (): Item =>
  glue(SPACE, SPACE * defaultGlue.stretch, SPACE * defaultGlue.shrink, source)

const hyphenPoint = (): Item =>
  discretionary({
    preWidth: HYPHEN,
    penalty: texDefaults.hyphenPenalty,
    hyphen: true,
    breakOffset: 0,
    source,
  })

const hyphenated: Item[] = [
  box(200, source),
  space(),
  box(185, source),
  hyphenPoint(),
  box(150, source),
  ...paragraphEnd(0),
]

const unhyphenated: Item[] = [
  box(200, source),
  space(),
  box(335, source),
  ...paragraphEnd(0),
]

const layoutOf = (items: readonly Item[], pretolerance?: number) =>
  breakParagraph(
    items,
    MEASURE,
    pretolerance === undefined ? {} : { policy: { pretolerance } },
  )

describe("pass one hyphenation", () => {
  test("the pretolerance pass breaks at a discretionary", () => {
    const result = layoutOf(hyphenated)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.pass).toBe("pretolerance")
    expect(result.lines.map((line) => line.breakKind)).toEqual([
      "hyphen",
      "end",
    ])
    expect(result.lines[0]?.naturalWidth).toBe(MEASURE)
  })

  test("the same measure is infeasible without the discretionary", () => {
    const result = layoutOf(unhyphenated)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.pass).toBe("forced")
  })

  test("skipping pass one finds the same breaks one rung later", () => {
    const first = layoutOf(hyphenated)
    const skipped = layoutOf(hyphenated, -1)
    expect(first.ok).toBe(true)
    expect(skipped.ok).toBe(true)
    if (!first.ok || !skipped.ok) return

    expect(skipped.pass).toBe("tolerance")
    expect(skipped.lines.map((line) => line.end)).toEqual(
      first.lines.map((line) => line.end),
    )
    expect(skipped.lines.map((line) => line.breakKind)).toEqual(
      first.lines.map((line) => line.breakKind),
    )
  })
})
