import { describe, expect, test } from "bun:test"
import { breakParagraph } from "@linebreak/layout/breaker"
import { texDefaults } from "@linebreak/layout/policy"
import { CHARACTER, compile } from "./support/measure"

const URL_SENTENCE =
  "See https://example.com/a/very/long/path/that/keeps/going for details."

const WORD_SENTENCE = "The word Antidisestablishmentarianism does not fit."

const solve = (text: string, measure: number) => {
  const result = breakParagraph(compile([text]), measure, {
    policy: texDefaults,
  })
  if (!result.ok) throw new Error(`declined: ${result.reason}`)
  return result
}

const textOf = (text: string, measure: number) =>
  solve(text, measure).lines.map((line) =>
    text.slice(line.sourceStart, line.sourceEnd),
  )

describe("a token wider than the measure takes a line of its own", () => {
  test("a long URL does not drag the words before it outside the measure", () => {
    expect(textOf(URL_SENTENCE, 32 * CHARACTER)).toEqual([
      "See",
      "https://example.com/a/very/long/path/that/keeps/going",
      "for details.",
    ])
  })

  test("a long word does not drag the words before it outside the measure", () => {
    expect(textOf(WORD_SENTENCE, 12 * CHARACTER)).toEqual([
      "The word",
      "Antidisestablishmentarianism",
      "does not",
      "fit.",
    ])
  })

  test("only the unbreakable token overflows, and only by its own excess", () => {
    for (const [text, measure] of [
      [URL_SENTENCE, 32 * CHARACTER],
      [WORD_SENTENCE, 12 * CHARACTER],
    ] as const) {
      const overfull = solve(text, measure).lines.filter(
        (line) => line.naturalWidth > measure,
      )
      expect(overfull).toHaveLength(1)
      expect(overfull[0]?.spaceCount).toBe(0)
    }
  })
})

describe("the forced rescue ranks candidates by overflow", () => {
  test("a lone over-wide box beats a line that holds a space and overflows more", () => {
    const measure = 12 * CHARACTER
    const lines = solve(WORD_SENTENCE, measure).lines
    const overfull = lines.find((line) => line.naturalWidth > measure)

    expect(overfull?.naturalWidth).toBe(28 * CHARACTER)
    expect(overfull?.naturalWidth ?? 0).toBeLessThan(37 * CHARACTER)
  })

  test("the paragraph is only rescued once every rung above has declined", () => {
    expect(solve(WORD_SENTENCE, 12 * CHARACTER).pass).toBe("forced")
    expect(solve(URL_SENTENCE, 32 * CHARACTER).pass).toBe("forced")
  })
})
