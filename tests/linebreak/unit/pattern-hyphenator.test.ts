import { describe, expect, test } from "bun:test"
import { createPatternHyphenator } from "@linebreak/text/pattern-hyphenator"
import { englishHyphenator } from "@linebreak/text/hyphenate"
import {
  englishExceptions,
  englishPatterns,
} from "@linebreak/text/english-patterns"

describe("Liang pattern matching", () => {
  test("every decimal weight is parsed, including explicit zero and nine", () => {
    for (let weight = 0; weight <= 9; weight += 1) {
      expect(createPatternHyphenator(`0a${weight}b`, "", 0, 0)("ab")).toEqual(
        weight % 2 === 1 ? [1] : [],
      )
    }
    expect(createPatternHyphenator("0a0b1c", "", 0, 0)("abc")).toEqual([2])
  })

  test("odd maxima permit breaks and overlapping even weights suppress them", () => {
    expect(createPatternHyphenator("0a1b", "", 0, 0)("ab")).toEqual([1])
    expect(createPatternHyphenator("0a1b 02bc", "", 0, 0)("abc")).toEqual([])
    expect(createPatternHyphenator("0a2b 03bc", "", 0, 0)("abc")).toEqual([1])
  })

  test("front-coded prefixes and boundary dots recover exact word patterns", () => {
    const hyphenate = createPatternHyphenator("0.ab1c 32cd 0xy1z.", "", 0, 0)
    expect(hyphenate("abc")).toEqual([2])
    expect(hyphenate("abcd")).toEqual([])
    expect(hyphenate("zabc")).toEqual([])
    expect(hyphenate("xyz")).toEqual([2])
    expect(hyphenate("xyza")).toEqual([])
  })

  test("minima are inclusive and preserve explicit no-break exceptions", () => {
    const hyphenate = createPatternHyphenator("0a1b", "ab-cd-ef-g", 2, 3)
    expect(hyphenate("abcdefg")).toEqual([2, 4])
    expect(createPatternHyphenator("0a1b", "ab", 0, 0)("ab")).toEqual([])
    expect(hyphenate("no-pattern")).toEqual([])
  })

  test("case changes preserve offsets, and expanding case mappings decline", () => {
    const hyphenate = createPatternHyphenator("0a1b", "", 0, 0)
    expect(hyphenate("AB")).toEqual([1])
    expect(hyphenate("İab")).toEqual([])
    expect(hyphenate("😀ab")).toEqual([3])
  })
})

describe("the complete English dictionary", () => {
  test("preserves the 4938 extended patterns and primary exception spelling", () => {
    expect(englishPatterns.match(/[A-Z]/gu)).toHaveLength(4938)
    for (const definition of englishExceptions.split(" ")) {
      const parts = definition.split("-")
      const word = parts.join("")
      let offset = 0
      const expected = parts
        .slice(0, -1)
        .map((part) => (offset += part.length))
        .filter((point) => point >= 2 && point <= word.length - 3)
      expect(englishHyphenator(word, "en-US")).toEqual(expected)
      expect(englishHyphenator(word.toUpperCase(), "en-US")).toEqual(expected)
    }
  })

  test("exposes correct source offsets and enforces the American minima", () => {
    expect(englishHyphenator("associate", "en-US")).toEqual([2, 4])
    expect(englishHyphenator("declination", "en-US")).toEqual([3, 5, 7])
    expect(englishHyphenator("philanthropic", "en-US")).toEqual([4, 6])
    for (const word of [
      "academy",
      "beautiful",
      "democrat",
      "extraordinary",
      "reformation",
    ]) {
      const points = englishHyphenator(word, "en-US")
      expect(
        points.every((point) => point >= 2 && point <= word.length - 3),
      ).toBe(true)
    }
  })
})

test("single-letter states resolve known transitions without repeated root searches", () => {
  const hyphenate = createPatternHyphenator("0a1 0b1", "", 0, 0)
  hyphenate("ab")
  const word = "ab".repeat(32)
  const original = Map.prototype.get
  let numericLookups = 0
  let observed: readonly number[] = []
  Map.prototype.get = function (key) {
    if (typeof key === "number") numericLookups += 1
    return original.call(this, key)
  }
  try {
    observed = hyphenate(word)
  } finally {
    Map.prototype.get = original
  }
  expect(observed).toHaveLength(word.length)
  expect(numericLookups).toBeLessThanOrEqual(word.length + 3)
})
