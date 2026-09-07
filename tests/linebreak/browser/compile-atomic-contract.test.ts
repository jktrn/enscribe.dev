import { afterEach, expect, test, vi } from "vitest"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraph } from "@linebreak/layout/breaker"
import { createMetrics } from "@linebreak/text/segments"
import type { CompiledBlock } from "@linebreak/layout/block"

const metrics = createMetrics({
  font: "16px serif",
  measure: (text) => text.length * 10,
})
afterEach(() => vi.restoreAllMocks())

test("custom non-text segment classifications retain a legal boundary after an atom", () => {
  const classified = createMetrics({
    font: metrics.font,
    measure: (text) => text.length * 10,
    segment: (text) => [{ kind: "other", text, start: 0, end: text.length }],
  })
  const compiled = compileBlock({
    block: {
      text: "\ufffcbeta",
      runs: [
        { kind: "atom", start: 0, end: 1 },
        { kind: "text", text: "beta", start: 1, end: 5, hyphenates: false },
      ],
      breakRestrictions: [],
    },
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => classified,
    atomWidth: () => 50,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const result = breakParagraph(compiled.items, 50)
  if (!result.ok) throw new Error("unbreakable")
  expect(
    result.lines.map((line) => [line.sourceEnd, line.naturalWidth]),
  ).toEqual([
    [1, 50],
    [5, 40],
  ])
})

test("atomic boundary context does not materialize an entire paragraph prefix", () => {
  const prefix = "alpha".repeat(200)
  const block: CompiledBlock = {
    text: `${prefix}\ufffcbeta`,
    runs: [
      {
        kind: "text",
        text: prefix,
        start: 0,
        end: prefix.length,
        hyphenates: false,
      },
      { kind: "atom", start: prefix.length, end: prefix.length + 1 },
      {
        kind: "text",
        text: "beta",
        start: prefix.length + 1,
        end: prefix.length + 5,
        hyphenates: false,
      },
    ],
    breakRestrictions: [],
  }
  const from = vi.spyOn(Array, "from")
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
    atomWidth: () => 50,
  })
  const materialized = from.mock.calls.flatMap(([value]) =>
    typeof value === "string" ? [value.length] : [],
  )
  from.mockRestore()
  expect(compiled.ok).toBe(true)
  expect(materialized.every((length) => length <= 2)).toBe(true)
})
