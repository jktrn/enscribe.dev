import { expect, test } from "bun:test"
import { codeBreakOffsets } from "@linebreak/text/code-breaks"
import { breakAllowedAt } from "@linebreak/text/source"
import { calibrateStretch } from "@linebreak/text/stretch"

test.each([
  ["3.14", []],
  ["ns::item", [4]],
  ["a//b", [3]],
  ["a\\\\b", [3]],
  ["a&&b", [3]],
  ["a-b", [2]],
  ["a_+b", [2, 3]],
  ["ABcd", [1]],
  ["a2b", [1, 2]],
  ["a b", []],
  ["a. b", []],
] as [
  string,
  number[],
][])("code boundaries in %s preserve lexical groups", (text, expected) => {
  expect([...codeBreakOffsets(text).keys()].sort((a, b) => a - b)).toEqual(
    expected,
  )
})

test("nowrap binary search handles before, inside, between, and after disjoint intervals", () => {
  const restrictions = [
    { start: 5, end: 10 },
    { start: 20, end: 30 },
    { start: 40, end: 50 },
  ]
  for (let offset = 0; offset <= 60; offset++) {
    const expected = !restrictions.some(
      (range) => offset >= range.start && offset < range.end,
    )
    expect(breakAllowedAt(restrictions, offset)).toBe(expected)
  }
})

test("invalid width-axis responses reject a font even when its default advance is valid", () => {
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
    expect(
      calibrateStretch(0.02, (pct) => (pct === 100 ? 100 : invalid)),
    ).toBeNull()
  }
})
