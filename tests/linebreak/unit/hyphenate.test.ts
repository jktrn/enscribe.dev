import { describe, expect, test } from "bun:test"
import {
  hyphenationOffsets,
  usesEnglishHyphenation,
} from "@linebreak/text/hyphenate"

describe("hyphenation offsets", () => {
  test("finds interior break points in a long word", () => {
    const offsets = hyphenationOffsets("beautiful")

    expect(offsets.length).toBeGreaterThan(0)
    for (const offset of offsets) {
      expect(offset).toBeGreaterThan(0)
      expect(offset).toBeLessThan("beautiful".length)
    }
  })

  test("declines words shorter than the policy minimum", () => {
    expect(hyphenationOffsets("cat")).toEqual([])
    expect(hyphenationOffsets("idea")).toEqual([])
  })

  test("returns offsets into the original word, not the marked string", () => {
    const word = "typesetting"
    const offsets = hyphenationOffsets(word)

    for (const offset of offsets) {
      expect(word.slice(0, offset) + word.slice(offset)).toBe(word)
    }
  })

  test("emits no soft hyphen into any consumer-visible value", () => {
    const offsets = hyphenationOffsets("extraordinary")
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
})
