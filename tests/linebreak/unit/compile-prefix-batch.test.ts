import { expect, test } from "bun:test"
import { compileText, createMetrics } from "@linebreak/text"

test("fragment widths are warmed together without changing compiled items or hyphenator calls", () => {
  const metrics = createMetrics({ measure: text => text.length * 7 })
  const batches: string[][] = []
  const reads: string[] = []
  const warmed = new Set<string>()
  const words: string[] = []
  const hyphenate = (word: string) => {
    words.push(word)
    return word.length > 5 ? [2, 4] : []
  }
  const input = "reproducible measurements remain intact"
  const expected = compileText(input, metrics, { hyphenate })
  const expectedWords = words.splice(0)
  const actual = compileText(input, {
    ...metrics,
    warmRuns(texts) {
      batches.push([...texts])
      for (const text of texts) warmed.add(text)
    },
    measureRun(text) {
      reads.push(text)
      expect(warmed.has(text)).toBe(true)
      return metrics.measureRun(text)
    },
  }, { hyphenate })
  expect(actual).toEqual(expected)
  expect(words).toEqual(expectedWords)
  expect(batches).toEqual([["re", "repr"], ["me", "meas"], ["re", "rema"], ["in", "inta"]])
  expect(reads).toHaveLength(8)
})
