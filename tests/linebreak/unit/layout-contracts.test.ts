import { expect, test } from "bun:test"
import {
  box,
  breakPenalty,
  discretionary,
  drawsHyphen,
  glue,
  isFlaggedBreak,
  isParagraphEnd,
  isRenderedSpace,
  lineBreak,
  penalty,
} from "@linebreak/layout/items"
import { flexBetween } from "@linebreak/layout/flex"
import { endHang, startHang } from "@linebreak/layout/protrusion"

test("default penalty flags differ from explicit flagged penalties", () => {
  expect(penalty(50)).toEqual({
    kind: "penalty",
    width: 0,
    penalty: 50,
    flagged: false,
    source: undefined,
  })
  expect(isFlaggedBreak(penalty(50, { flagged: true }))).toBe(true)
})

test("glue after either a box or a discretionary offers a legal break", () => {
  const space = glue(5, 2, 1)
  expect(breakPenalty([box(10), space], 1)).toBe(0)
  expect(breakPenalty([discretionary({ breakOffset: 1 }), space], 1)).toBe(0)
  expect(breakPenalty([penalty(0), space], 1)).toBeNull()
})

test("optional item predicates treat absent items as absent content", () => {
  expect(drawsHyphen(undefined)).toBe(false)
  expect(drawsHyphen(box(0))).toBe(false)
  expect(drawsHyphen(discretionary({ breakOffset: 0, hyphen: true }))).toBe(
    true,
  )
  expect(isFlaggedBreak(undefined)).toBe(false)
  expect(isRenderedSpace(undefined)).toBe(false)
  expect(isParagraphEnd([], -1)).toBe(false)
  expect(
    isParagraphEnd([discretionary({ breakOffset: 0, penalty: -10000 })], 0),
  ).toBe(false)
})

test("an authored forced break keeps its source boundary on all three primitives", () => {
  expect(lineBreak(5, 8)).toEqual([
    {
      kind: "penalty",
      width: 0,
      penalty: 10000,
      flagged: false,
      source: { start: 5, end: 5 },
    },
    {
      kind: "glue",
      width: 0,
      stretch: 100000,
      shrink: 0,
      source: { start: 5, end: 5 },
    },
    {
      kind: "penalty",
      width: 0,
      penalty: -10000,
      flagged: false,
      source: { start: 5, end: 8 },
    },
  ])
})

test("a later line receives only its own share of cumulative flexibility", () => {
  const flex = {
    stretch: Float64Array.from([0, 3, 7, 13]),
    shrink: Float64Array.from([0, 2, 5, 11]),
  }
  expect(flexBetween(flex, 1, 3)).toEqual({ stretch: 10, shrink: 9 })
  expect(flexBetween(flex, 2, 2)).toEqual({ stretch: 0, shrink: 0 })
})

test("characters without protrusion credits never require a glyph measurement", () => {
  let calls = 0
  const advance = () => {
    calls += 1
    return 9
  }
  expect(startHang("🦄", advance)).toBe(0)
  expect(endHang("🦄", advance)).toBe(0)
  expect(calls).toBe(0)
})
