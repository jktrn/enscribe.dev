import { expect, test } from "bun:test"
import { breakParagraphOnce } from "@linebreak/layout/breaker"
import {
  box,
  discretionary,
  glue,
  paragraphEnd,
  penalty,
} from "@linebreak/layout/items"

test("rescue retains finite geometry when underfull adjustment itself overflows", () => {
  const result = breakParagraphOnce(
    [box(0.5), penalty(10000), glue(0, Number.MIN_VALUE, 0), penalty(-10000)],
    1,
    { tolerance: 10000, force: true },
  )
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.lines[0]?.naturalWidth).toBe(0.5)
  expect(Number.isFinite(result.lines[0]?.adjustmentRatio)).toBe(true)
})

test("discarded leading penalties cannot buy an empty line", () => {
  const result = breakParagraphOnce(
    [penalty(-100), box(10), ...paragraphEnd()],
    10,
    { tolerance: 100 },
  )
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    10,
  ])
  expect(result.ok && result.demerits).toBe(100)
})

test("indentation cannot revive a discarded leading penalty", () => {
  const result = breakParagraphOnce(
    [penalty(-100), box(10), ...paragraphEnd()],
    10,
    { tolerance: 100, indent: 10 },
  )
  expect(result).toEqual({ ok: false, reason: "infeasible" })
})

test("an initial discretionary can end a line containing only its indentation", () => {
  const result = breakParagraphOnce(
    [
      discretionary({ breakOffset: 0, penalty: -100 }),
      box(10),
      ...paragraphEnd(),
    ],
    10,
    { tolerance: 100, indent: 10 },
  )
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    10, 10,
  ])
  expect(result.ok && result.demerits).toBe(-9800)
})

test("a forced discretionary does not invent an authored hard-break marker", () => {
  const result = breakParagraphOnce(
    [box(10), discretionary({ breakOffset: 3, penalty: -10000 })],
    10,
    { tolerance: 100 },
  )
  expect(result.ok && result.lines.map((line) => line.breakKind)).toEqual([
    "none",
  ])
})

test("a fully shrinkable line outranks a much looser forced fallback", () => {
  const items = [box(10), penalty(0), box(5), glue(0, 0, 5), penalty(-10000)]
  const result = breakParagraphOnce(items, 10, { tolerance: 0, force: true })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    15,
  ])
  expect(result.ok && result.lines[0]?.adjustmentRatio).toBe(-1)
})

test("rescue compares finite excess without overflowing an unrelated addition", () => {
  const items = [box(-3e307), penalty(0), box(1.5e308), penalty(-10000)]
  const result = breakParagraphOnce(items, 1e308, {
    tolerance: 10000,
    force: true,
  })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    1.2e308,
  ])
  expect(result.ok && result.demerits).toBe(0)
})

test("a later break cannot replace a better adjusted rescue with a much looser line", () => {
  const items = [
    box(100),
    penalty(0),
    box(-50),
    glue(0, 25, 0),
    penalty(-10000),
  ]
  const result = breakParagraphOnce(items, 100, { tolerance: 100, force: true })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    50,
  ])
})

test("an unreachable final floor keeps the latest equally acceptable fallback break", () => {
  const items = [
    box(5),
    penalty(10000),
    glue(0, 5, 0),
    penalty(0),
    box(5),
    penalty(10000),
    glue(0, 5, 0),
    penalty(-10000),
  ]
  const result = breakParagraphOnce(items, 10, {
    tolerance: 100,
    force: true,
    strictEnding: true,
    lastLineMinWidth: 2,
  })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    5, 5,
  ])
})

test("equal-overflow rescues at the same breakpoint retain the cheaper preceding route", () => {
  const items = [
    box(2),
    penalty(0),
    box(3),
    penalty(0),
    box(2),
    glue(2, 0, 4),
    box(5),
    penalty(0),
    box(14),
    penalty(-10000),
  ]
  const result = breakParagraphOnce(items, 9, { tolerance: 10000, force: true })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    5, 9, 14,
  ])
  expect(result.ok && result.demerits).toBe(100020100)
})

test("equal rescue costs preserve the first candidate's deterministic route", () => {
  const items = [
    box(7),
    penalty(0),
    box(2),
    glue(3, 0, 0),
    box(3),
    penalty(0, { width: 1 }),
    box(14),
    penalty(-10000),
  ]
  const result = breakParagraphOnce(items, 9, {
    tolerance: 10000,
    force: true,
    policy: { adjDemerits: 0 },
  })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    7, 9, 14,
  ])
  expect(result.ok && result.demerits).toBe(100000100)
})

test("an empty post fragment cannot buy an optional blank line after a hard break", () => {
  const items = [
    box(10),
    discretionary({ penalty: -10000, breakOffset: 1 }),
    discretionary({ penalty: -100, breakOffset: 1 }),
    box(10),
    ...paragraphEnd(),
  ]
  const result = breakParagraphOnce(items, 10, { tolerance: 0 })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    10, 10,
  ])
  expect(result.ok && result.demerits).toBe(200)
})

test("initial indentation does not authorize a later optional blank line", () => {
  const items = [
    box(9),
    penalty(-10000),
    discretionary({ penalty: -100, breakOffset: 1 }),
    box(10),
    ...paragraphEnd(),
  ]
  const result = breakParagraphOnce(items, 10, { tolerance: 0, indent: 1 })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    10, 10,
  ])
  expect(result.ok && result.demerits).toBe(200)
})

test("initial indentation remains physical width on a mandatory empty endpoint", () => {
  const result = breakParagraphOnce([penalty(-10000)], 7, {
    tolerance: 0,
    indent: 7,
  })
  expect(result.ok && result.lines.map((line) => line.naturalWidth)).toEqual([
    7,
  ])
})

// The fallback must shrink an overfull line; a positive ratio expands it further.
test.each(["continuous", "integer"] as const)(
  "%s rescue cannot expand an overfull line with no shrink capacity",
  (scoring) => {
    const result = breakParagraphOnce([box(14), penalty(-10000)], 9, {
      tolerance: 0,
      force: true,
      policy: { scoring },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]?.naturalWidth).toBe(14)
    expect(result.lines[0]?.shrink).toBe(0)
    expect(result.lines[0]?.adjustmentRatio).toBe(-1)
  },
)
