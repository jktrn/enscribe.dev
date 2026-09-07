import { expect, test } from "bun:test"
import { breakParagraphOnce, prepareParagraph } from "@linebreak/layout"
import { compileRuns, createMetrics } from "@linebreak/text"

const metrics = createMetrics({
  measure: (text) => text.replace(/[\u200b\u00ad]/gu, "").length * 10,
})

for (const scoring of ["continuous", "integer"] as const) {
  for (const split of [false, true]) {
    test(`a selected zero-width break consumes its marker and discards following spaces (${scoring}, split=${split})`, () => {
      for (const markers of ["\u200b", "\u200b\u200b"]) {
        const text = `alpha${markers} beta`
        const runs = split
          ? [{ text: "alpha" }, ...[...markers].map((text) => ({ text })), { text: " beta" }]
          : [{ text }]
        const compiled = compileRuns(runs, metrics)
        if (!compiled.ok) throw new Error(compiled.reason)
        const options = { tolerance: 1, policy: { scoring } }
        const fresh = breakParagraphOnce(compiled.items, 50, options)
        const prepared = prepareParagraph(compiled.items).breakParagraphOnce(50, options)
        expect(prepared).toEqual(fresh)
        if (!fresh.ok) throw new Error("Expected two feasible lines")
        expect(fresh.lines.map((line) => line.naturalWidth)).toEqual([50, 40])
        expect(fresh.lines.map((line) => line.spaceCount)).toEqual([0, 0])
        expect(fresh.lines[0]?.sourceEnd).toBe(5 + markers.length)
        expect(fresh.lines[0]?.breakKind).toBe("space")
        expect(fresh.lines[1]?.sourceStart).toBe(5 + markers.length)
        expect(fresh.lines[1]?.sourceEnd).toBe(text.length)
      }
    })
  }

  test(`a break before the preceding space retains the later marker and space (${scoring})`, () => {
    const compiled = compileRuns([{ text: "alpha \u200b beta" }], metrics)
    if (!compiled.ok) throw new Error(compiled.reason)
    for (const [width, natural, end] of [[50, [50, 50], 5], [60, [60, 40], 7]] as const) {
      const result = breakParagraphOnce(compiled.items, width, { tolerance: 1, policy: { scoring } })
      if (!result.ok) throw new Error("Expected a feasible space boundary")
      expect(result.lines.map((line) => line.naturalWidth)).toEqual([...natural])
      expect(result.lines[0]?.sourceEnd).toBe(end)
    }
  })

  test(`paragraph-edge markers preserve source without buying an empty line (${scoring})`, () => {
    for (const text of ["\u200balpha", "\u200b\u200balpha", "alpha\u200b", "alph\u00adbetaa\u200b\u200b"]) {
      const compiled = compileRuns([{ text }], metrics)
      if (!compiled.ok) throw new Error(compiled.reason)
      const result = breakParagraphOnce(compiled.items, 50, { tolerance: 1, policy: { scoring } })
      if (!result.ok) throw new Error("Expected a feasible paragraph")
      expect(result.lines.map((line) => line.naturalWidth), JSON.stringify(text)).toEqual(text.includes("betaa") ? [50, 50] : [50])
      expect(result.lines[0]?.sourceStart).toBe(0)
      expect(result.lines.at(-1)?.sourceEnd).toBe(text.length)
    }
  })
}
