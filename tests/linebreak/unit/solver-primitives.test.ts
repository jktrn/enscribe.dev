import { expect, test } from "bun:test"
import { breakPenalty, discretionary, glue } from "@linebreak/layout/items"
import { endHang, hyphenHang, startHang } from "@linebreak/layout/protrusion"

test("a leading glue and an absent item are not legal breakpoints", () => {
  expect(breakPenalty([glue(4, 2, 1)], 0)).toBeNull()
  expect(breakPenalty([], 0)).toBeNull()
  expect(breakPenalty([glue(4, 2, 1)], 2)).toBeNull()
})

test("a discretionary fragment does not draw a hyphen unless requested", () => {
  expect(discretionary({ breakOffset: 1 }).hyphen).toBe(false)
})

test("empty text and an undrawn hyphen cannot consume a margin credit", () => {
  let measurements = 0
  const advance = () => {
    measurements += 1
    return 10
  }
  expect(startHang("", advance)).toBe(0)
  expect(endHang("", advance)).toBe(0)
  expect(hyphenHang(0)).toBe(0)
  expect(measurements).toBe(0)
})
