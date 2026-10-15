import { expect, test } from "bun:test"
import { createPatternHyphenator } from "@linebreak/text/pattern-hyphenator"
import {
  englishPatterns,
  englishExceptions,
} from "@linebreak/text/english-patterns"

test("streamed markers flush the last token and reuse front-coded prefixes", () => {
  expect(createPatternHyphenator("Aa1b", "", 0, 0, true)("ab")).toEqual([1])
  const hyphenate = createPatternHyphenator("A.ab1cD2cdAxy1z.", "", 0, 0, true)
  expect(hyphenate("abc")).toEqual([2])
  expect(hyphenate("abcd")).toEqual([])
  expect(hyphenate("zabc")).toEqual([])
  expect(hyphenate("xyz")).toEqual([2])
  expect(hyphenate("xyza")).toEqual([])
})

test("empty and zero-weight marker dictionaries do not invent breaks", () => {
  expect(createPatternHyphenator("", "", 0, 0, true)("ab")).toEqual([])
  expect(createPatternHyphenator("A", "", 0, 0, true)("ab")).toEqual([])
})

test("all 26 prefix markers preserve exact patterns beside literal punctuation", () => {
  for (let shared = 0; shared < 26; shared += 1) {
    const prefix = "a".repeat(shared)
    const marker = String.fromCharCode(65 + shared)
    const hyphenate = createPatternHyphenator(
      `A${prefix}b1c${marker}d1e`,
      "",
      0,
      0,
      true,
    )
    expect(hyphenate(`${prefix}bc`)).toEqual([shared + 1])
    expect(hyphenate(`${prefix}de`)).toEqual([shared + 1])
  }
  for (const punctuation of ["@", "["]) {
    const hyphenate = createPatternHyphenator(
      `Aa1${punctuation}b`,
      "",
      0,
      0,
      true,
    )
    expect(hyphenate(`a${punctuation}b`)).toEqual([1])
    expect(hyphenate("ab")).toEqual([])
  }
})

test("streamed English construction never splits a dictionary token array", () => {
  const hyphenate = createPatternHyphenator(
    englishPatterns,
    englishExceptions,
    2,
    3,
    true,
  )
  const split = String.prototype.split
  let calls = 0
  String.prototype.split = function (separator, limit) {
    calls++
    return Reflect.apply(split, this, [separator, limit])
  }
  try {
    expect(hyphenate("representation")).toEqual([3, 5, 8, 10])
    expect(calls).toBe(0)
  } finally {
    String.prototype.split = split
  }
})
