import { afterEach, expect, test } from "vitest"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraphOnce } from "@linebreak/layout/breaker"
import { createMetrics } from "@linebreak/text/segments"
import { extract } from "./support/extraction"

afterEach(() => document.body.replaceChildren())

test("an unchosen authored break retains its following space for justification", () => {
  const block = extract("<span data-nowrap>alpha<wbr> beta</span> gamma")
  const metrics = createMetrics({
    font: "16px serif",
    measure: (text) => text.length * 10,
  })
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
  })
  if (!compiled.ok) throw new Error(compiled.reason)

  // The authored WBR remains unchosen. The gap before beta still participates
  // in native word spacing, so this 2px contraction is a legal two-line fit.
  const layout = breakParagraphOnce(compiled.items, 98, { tolerance: 100 })
  if (!layout.ok) throw new Error(layout.reason)
  expect(layout.lines.map((line) => [line.sourceStart, line.sourceEnd])).toEqual([
    [0, 10],
    [11, 16],
  ])
  const line = layout.lines[0]!
  expect(line.naturalWidth).toBe(100)
  expect(line.spaceCount).toBe(1)
  expect(line.stretch).toBe(5)
  expect(line.shrink).toBeCloseTo(10 / 3, 12)
  expect(line.adjustmentRatio).toBeCloseTo(-0.6, 12)
})
