import { expect, test } from "bun:test"
import { breakParagraphOnce } from "@linebreak/layout"
import { compileRuns, compileText, createMetrics } from "@linebreak/text"

const metrics = createMetrics({
  measure: (text) => text.replace(/[\u2060\uFEFF\u200B]/gu, "").length * 10,
})

for (const joiner of ["\u2060", "\uFEFF"]) {
  for (const spaces of [" ", "  "]) {
    for (const split of [false, true]) {
      test(`ZW followed by ${spaces.length} spaces keeps a feasible WJ boundary (${joiner.codePointAt(0)}, split=${split})`, () => {
        const text = `ab\u200B${spaces}${joiner}cd`
        const compiled = split
          ? compileRuns([{ text: "ab\u200B" }, { text: spaces }, { text: `${joiner}cd` }], metrics)
          : compileText(text, metrics)
        if (!compiled.ok) throw new Error(compiled.reason)
        const plan = breakParagraphOnce(compiled.items, 20, { tolerance: 0 })
        expect(plan.ok).toBe(true)
        if (!plan.ok) return
        expect(plan.lines.map((line) => line.naturalWidth)).toEqual([20, 20])
        expect(plan.lines.map((line) => line.spaceCount)).toEqual([0, 0])
        expect(plan.lines[0]?.sourceStart).toBe(0)
        expect(plan.lines[0]?.sourceEnd).toBe(3)
        expect(plan.lines[1]?.sourceEnd).toBe(text.length)
      })
    }
  }
}
