import { expect, test } from "bun:test"
import { box, glue, discretionary, paragraphEnd, breakParagraph, breakParagraphOnce, prepareParagraph, type Item } from "@linebreak/layout"
import { compileStreamedGeneralOnce } from "@linebreak/layout/breaker/streamed-general"

for (const scoring of ["continuous", "integer"] as const) {
  test(`${scoring} preserves mixed-space rounding through strict and rescue passes`, () => {
    const items: Item[] = Array.from({ length: 32 }, (_, index) => [
      box((index % 7 + 1) * 3.25),
      discretionary({ breakOffset: 0, preWidth: 7, penalty: 50, hyphen: true }),
      box((index % 5 + 1) * 1.75),
      glue(5, 2.5, [1.133331298828125, 2.890467325846354, 1 / 7][index % 3]!),
    ]).flat()
    items.pop()
    items.push(...paragraphEnd())
    const certificate = compileStreamedGeneralOnce(items)
    expect(certificate).not.toBeNull()
    expect(Number.isNaN(certificate!.unit)).toBe(true)
    expect(certificate!.shrinkHasLow).toBe(true)
    const prepared = prepareParagraph(items)
    for (const width of [20, 60, 240]) for (const tolerance of [0, 100, 800]) {
      const options = { tolerance, policy: { scoring, tolerance } }
      const strict = breakParagraphOnce(items, width, { ...options, diagnostics: { evaluatedLines: 0, peakActiveNodes: 0 } })
      expect(breakParagraphOnce(items, width, options)).toEqual(strict)
      expect(prepared.breakParagraphOnce(width, options)).toEqual(strict)
      for (const emergencyStretch of [0, 60, "auto"] as const) {
        const layout = { ...options, emergencyStretch }
        const expected = breakParagraph(items, width, { ...layout, diagnostics: { evaluatedLines: 0, peakActiveNodes: 0 } })
        expect(breakParagraph(items, width, layout)).toEqual(expected)
        expect(prepared.breakParagraph(width, layout)).toEqual(expected)
      }
    }
  })
}
