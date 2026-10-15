import { expect, test } from "bun:test"
import { breakParagraphOnce } from "@linebreak/layout/breaker"
import { compileText, createMetrics } from "@linebreak/text"

const metrics = createMetrics({
  font: "16px serif",
  measure: (text) => text.length * 10,
})

test("a generated hyphen's hanging width can make a strict line feasible", () => {
  const compiled = compileText("abcdef", metrics, {
    hyphenate: () => [3],
    protrude: true,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  if (!compiled.hangs) throw new Error("expected protrusion geometry")

  const result = breakParagraphOnce(compiled.items, 35, {
    tolerance: 1,
    hangs: compiled.hangs,
  })
  if (!result.ok) throw new Error(result.reason)

  expect(result.lines).toHaveLength(2)
  expect(result.lines[0]).toMatchObject({
    sourceStart: 0,
    sourceEnd: 3,
    naturalWidth: 35,
    hangEnd: 5,
    breakKind: "hyphen",
    adjustmentRatio: 0,
  })
  expect(result.lines[1]).toMatchObject({
    sourceStart: 3,
    sourceEnd: 6,
    naturalWidth: 30,
    breakKind: "end",
  })
  expect(breakParagraphOnce(compiled.items, 35, { tolerance: 1 })).toEqual({
    ok: false,
    reason: "infeasible",
  })
})
