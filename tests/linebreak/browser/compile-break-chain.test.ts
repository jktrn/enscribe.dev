import { afterEach, expect, test } from "vitest"
import { type InlineRun, runEdgeWidths } from "@linebreak/dom/extract"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraph, breakParagraphOnce } from "@linebreak/layout/breaker"
import { createMetrics } from "@linebreak/text/segments"
import { extract } from "./support/extraction"

const metrics = createMetrics({
  font: "16px serif",
  measure: (text) => text.length * 10,
})
afterEach(() => document.body.replaceChildren())

test.each([
  false,
  true,
])("every authored choice remains feasible with SPACE before, between, or after a break chain (nowrap=%s)", (nowrap) => {
  for (const count of [2, 3, 4]) {
    const total = (count * (count + 1)) / 2
    for (let space = 0; space <= count; space += 1) {
      const opportunities = Array.from(
        { length: count },
        (_, index) =>
          `${space === index ? " " : ""}<i style="padding-inline-start:${index + 1}px"><wbr id="w${index}"></i>`,
      ).join("")
      const body = `alpha${opportunities}${space === count ? " " : ""}beta`
      const block = extract(nowrap ? `<span data-nowrap>${body}</span>` : body)
      const compiled = compileBlock({
        block,
        locale: "en",
        baseFont: metrics.font,
        metricsFor: () => metrics,
        edgesFor: (run: InlineRun) => runEdgeWidths(block, run),
      })
      if (!compiled.ok) throw new Error(compiled.reason)
      expect(block.text).toBe("alpha beta")
      expect(compiled.breakRuns?.size).toBe(count)
      for (let choice = 0; choice < count; choice += 1) {
        const prefix = ((choice + 1) * (choice + 2)) / 2
        const layout = breakParagraphOnce(compiled.items, 50 + prefix, {
          tolerance: 1,
          force: false,
        })
        expect(
          layout.ok,
          JSON.stringify({ nowrap, count, space, choice }),
        ).toBe(true)
        if (!layout.ok) throw new Error("missing feasible choice")
        expect(
          layout.lines.map((line) => [line.naturalWidth, line.spaceCount]),
        ).toEqual([
          [50 + prefix, 0],
          [40 + total - prefix, 0],
        ])
        const selected = compiled.breakRuns!.get(layout.lines[0]!.end)!
        const run = block.runs[selected]!
        if (run.kind !== "break") throw new Error("missing authored choice")
        expect(run.sourceElement.id).toBe(`w${choice}`)
        expect(layout.lines[0]!.sourceEnd).toBe(space <= choice ? 6 : 5)
      }
      const wide = breakParagraph(compiled.items, 300)
      if (!wide.ok) throw new Error("unbreakable wide paragraph")
      expect(wide.lines.map((line) => line.naturalWidth)).toEqual([100 + total])
    }
  }
})
