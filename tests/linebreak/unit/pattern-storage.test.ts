import { expect, test } from "bun:test"
import { createPatternHyphenator } from "@linebreak/text/pattern-hyphenator"

test("pattern states preserve offsets beyond the 16-bit index boundary", () => {
  const prefix = "a".repeat(65_536)
  const hyphenate = createPatternHyphenator(`0${prefix}1a`, "", 0, 0)
  expect(hyphenate(prefix + "a")).toEqual([65_536])
  expect(hyphenate(prefix)).toEqual([])
})

test("missing alphabet symbols reset matching without crossing unrelated text", () => {
  const hyphenate = createPatternHyphenator("0a1b", "", 0, 0)
  for (const separator of ["\u0000", "0", "é", "😀", "\uD800", "\uDC00"]) {
    expect(hyphenate(`a${separator}b`)).toEqual([])
    expect(hyphenate(`${separator}ab`)).toEqual([separator.length + 1])
  }
})

test("an empty pattern dictionary has no break opportunities", () => {
  const hyphenate = createPatternHyphenator("", "", 0, 0)
  expect(hyphenate("arbitrary")).toEqual([])
  expect(hyphenate("😀")).toEqual([])
  expect(hyphenate("")).toEqual([])
})

for (const markerEncoding of [false, true])
  test(`${markerEncoding ? "marker" : "generic"} patterns match supplementary characters at UTF-16 offsets`, () => {
    const hyphenate = createPatternHyphenator(
      `${markerEncoding ? "A" : "0"}😀1b`,
      "",
      0,
      0,
      markerEncoding,
    )
    expect(hyphenate("😀b")).toEqual([2])
    expect(hyphenate("ab😀b")).toEqual([4])
    expect(hyphenate("😁b")).toEqual([])
    expect(hyphenate("\uD83Db")).toEqual([])
    expect(hyphenate("\uDE00b")).toEqual([])

    const before = createPatternHyphenator(
      `${markerEncoding ? "A" : "0"}a1😀b`,
      "",
      0,
      0,
      markerEncoding,
    )
    expect(before("a😀b")).toEqual([1])
    expect(before("xa😀b")).toEqual([2])
    expect(before("a😁b")).toEqual([])
  })
