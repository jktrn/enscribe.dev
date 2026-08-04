import { describe, expect, test } from "bun:test"
import {
  englishHyphenator,
  hyphenationCacheLimit,
  usesEnglishHyphenation,
} from "@linebreak/text/hyphenate"

describe("hyphenation offsets", () => {
  test("finds interior break points in a long word", () => {
    const offsets = englishHyphenator("beautiful", "en-US")

    expect(offsets.length).toBeGreaterThan(0)
    for (const offset of offsets) {
      expect(offset).toBeGreaterThan(0)
      expect(offset).toBeLessThan("beautiful".length)
    }
  })

  test("declines words shorter than the policy minimum", () => {
    expect(englishHyphenator("cat", "en-US")).toEqual([])
    expect(englishHyphenator("idea", "en-US")).toEqual([])
  })

  test("returns offsets into the original word, not the marked string", () => {
    const word = "typesetting"
    const offsets = englishHyphenator(word, "en-US")

    for (const offset of offsets) {
      expect(word.slice(0, offset) + word.slice(offset)).toBe(word)
    }
  })

  test("emits no soft hyphen into any consumer-visible value", () => {
    const offsets = englishHyphenator("extraordinary", "en-US")
    expect(offsets.every((offset) => Number.isInteger(offset))).toBe(true)
  })
})

describe("locale gating", () => {
  test("accepts English tags and rejects others", () => {
    expect(usesEnglishHyphenation("en")).toBe(true)
    expect(usesEnglishHyphenation("en-US")).toBe(true)
    expect(usesEnglishHyphenation("fr")).toBe(false)
    expect(usesEnglishHyphenation("th")).toBe(false)
  })

  test("a malformed tag is rejected rather than throwing", () => {
    expect(usesEnglishHyphenation("not a locale")).toBe(false)
  })

  test("the hyphenator declines a word under a non-English locale", () => {
    expect(englishHyphenator("beautiful", "en-US").length).toBeGreaterThan(0)
    expect(englishHyphenator("beautiful", "fr")).toEqual([])
    expect(englishHyphenator("beautiful", "not a locale")).toEqual([])
  })
})

describe("hyphenation cache", () => {
  test("a repeated word is hyphenated once and the result reused", () => {
    const first = englishHyphenator("extraordinary", "en-US")
    const second = englishHyphenator("extraordinary", "en-US")

    expect(first.length).toBeGreaterThan(0)
    expect(second).toBe(first)
  })

  test("a word with no break points is remembered too", () => {
    const first = englishHyphenator("bought", "en-US")
    const second = englishHyphenator("bought", "en-US")

    expect(first).toEqual([])
    expect(second).toBe(first)
  })

  test("the key carries the locale, so one locale cannot answer another", () => {
    const american = englishHyphenator("typesetting", "en-US")
    const british = englishHyphenator("typesetting", "en-GB")

    expect(british).toEqual(american)
    expect(british).not.toBe(american)
    expect(englishHyphenator("typesetting", "fr-FR")).toEqual([])
    expect(englishHyphenator("typesetting", "en-US")).toBe(american)
  })

  test("the cache is bounded and stays correct once the bound is reached", () => {
    const before = englishHyphenator("hyphenation", "en-US")
    expect(before.length).toBeGreaterThan(0)
    expect(englishHyphenator("hyphenation", "en-US")).toBe(before)

    for (let index = 0; index <= hyphenationCacheLimit; index += 1) {
      englishHyphenator(`zzzz${index.toString(36)}`, "en-US")
    }

    const after = englishHyphenator("hyphenation", "en-US")
    expect(after).not.toBe(before)
    expect(after).toEqual(before)
  })
})
